import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DeleteAccountForm } from "@/features/profiles/components/delete-account-form";
import { ProfileSettingsForm } from "@/features/profiles/components/profile-settings-form";
import { getOwnAvatarUrl, getOwnProfile } from "@/features/profiles/queries";

export const metadata = { title: "Account settings — BatchVault" };

export default async function SettingsPage() {
  const [profile, avatarUrl] = await Promise.all([
    getOwnProfile(),
    getOwnAvatarUrl(),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Home
        </Link>
        <h1 className="text-heading-lg font-semibold">Account settings</h1>
      </header>

      {profile !== null && (
        <ProfileSettingsForm
          initialDisplayName={profile.displayName}
          initialBio={profile.bio}
          initialAvatarUrl={avatarUrl}
        />
      )}

      <DeleteAccountForm />
    </div>
  );
}
