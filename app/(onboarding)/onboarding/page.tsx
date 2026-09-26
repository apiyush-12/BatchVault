import { OnboardingForm } from "@/features/profiles/components/onboarding-form";
import { getOwnAvatarUrl } from "@/features/profiles/queries";

export const metadata = { title: "Complete your profile — BatchVault" };

export default async function OnboardingPage() {
  const avatarUrl = await getOwnAvatarUrl();

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading-lg font-semibold">Complete your profile</h1>
        <p className="text-body-sm text-foreground-muted">
          A quick step before your batch is ready.
        </p>
      </header>

      <OnboardingForm initialAvatarUrl={avatarUrl} />
    </div>
  );
}
