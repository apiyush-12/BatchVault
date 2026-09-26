import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestUser,
  deleteAvatarObject,
  deleteTestUser,
  seedAvatarObject,
  signInTestUser,
  type TestUser,
} from "./support/auth-fixtures";
import { supabaseAnonKey, supabaseApiUrl } from "./support/db";

/**
 * Avatar Storage authorization, called directly against the Storage REST API
 * by path with real bearer tokens (testing.md §3.6; security.md §6.1) — not
 * through the app. Phase 1 has no shared-batch clause yet, so avatar
 * visibility here is strictly self-only (phases.md Phase 1).
 */

let owner: TestUser;
let other: TestUser;
let ownerToken: string;
let otherToken: string;
const OBJECT_PATH = () => `${owner.id}/http-test-avatar`;

function objectUrl(path: string): string {
  return `${supabaseApiUrl()}/storage/v1/object/avatars/${path}`;
}

async function getObject(bearer: string | null): Promise<Response> {
  return fetch(objectUrl(OBJECT_PATH()), {
    headers: {
      apikey: supabaseAnonKey(),
      ...(bearer !== null ? { Authorization: `Bearer ${bearer}` } : {}),
    },
  });
}

beforeAll(async () => {
  owner = await createTestUser();
  other = await createTestUser();
  [ownerToken, otherToken] = await Promise.all([
    signInTestUser(owner),
    signInTestUser(other),
  ]);
  await seedAvatarObject(OBJECT_PATH());
});

afterAll(async () => {
  await deleteAvatarObject(OBJECT_PATH()).catch(() => undefined);
  await Promise.all([deleteTestUser(owner.id), deleteTestUser(other.id)]);
});

describe("avatar Storage authorization (HTTP, direct)", () => {
  it("refuses an unauthenticated request", async () => {
    const response = await getObject(null);
    expect(response.status).not.toBe(200);
  });

  it("lets the owner read their own avatar object", async () => {
    const response = await getObject(ownerToken);
    expect(response.status).toBe(200);
  });

  it("refuses another authenticated user — Phase 1 has no shared-batch clause yet", async () => {
    const response = await getObject(otherToken);
    expect(response.status).not.toBe(200);
  });

  it("refuses an unauthenticated upload to the owner's path", async () => {
    const response = await fetch(objectUrl(`${owner.id}/http-test-upload-attempt`), {
      method: "POST",
      headers: { apikey: supabaseAnonKey(), "Content-Type": "application/octet-stream" },
      body: new Uint8Array([9, 9, 9]),
    });
    expect(response.status).not.toBe(200);
  });

  it("refuses another authenticated user uploading into the owner's path", async () => {
    const response = await fetch(objectUrl(`${owner.id}/http-test-upload-by-other`), {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${otherToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array([9, 9, 9]),
    });
    expect(response.status).not.toBe(200);
  });

  it("lets the owner upload into their own path", async () => {
    const path = `${owner.id}/http-test-own-upload`;
    const response = await fetch(objectUrl(path), {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${ownerToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array([9, 9, 9]),
    });
    expect(response.status).toBe(200);
    await deleteAvatarObject(path);
  });
});
