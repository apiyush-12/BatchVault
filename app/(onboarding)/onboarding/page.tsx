import { AuthShell } from "@/components/shell/auth-shell";
import { OnboardingForm } from "@/features/profiles/components/onboarding-form";
import { getOwnAvatarUrl } from "@/features/profiles/queries";

export const metadata = { title: "Complete your profile — BatchVault" };

export default async function OnboardingPage() {
  const avatarUrl = await getOwnAvatarUrl();

  return (
    <AuthShell
      title="Complete your profile"
      description="Add your name so classmates recognise you. Next you can create a batch or join one with an invite link. You can change all of this later."
    >
      <OnboardingForm initialAvatarUrl={avatarUrl} />
    </AuthShell>
  );
}
