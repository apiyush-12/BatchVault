export interface Profile {
  id: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";
