import { FadeIn } from "@/components/motion/fade-in";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
    <FadeIn className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 pb-10">
      <PageHeader
        title="Account settings"
        description="How you appear to your classmates, across every batch you're in."
      />

      {profile !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Your name and photo show beside everything you share.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSettingsForm
              initialDisplayName={profile.displayName}
              initialBio={profile.bio}
              initialAvatarUrl={avatarUrl}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Follow your device, or pick a side. Saved on this device only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <DeleteAccountForm />
    </FadeIn>
  );
}
