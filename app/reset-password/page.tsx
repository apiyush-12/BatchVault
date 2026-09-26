import { UpdatePasswordForm } from "@/features/authentication/components/update-password-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Set a new password — BatchVault" };

/**
 * Deliberately outside the `(auth)` group. A recovery-session user reaching
 * this page from the reset-password email link has a genuine active session
 * — the `(auth)` layout's "already signed in, go away" guard would send them
 * straight back out before they could set a new password, so this page owns
 * its own check instead (a stale/already-used link means no session at all).
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user === null) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-5 py-10">
        <h1 className="text-heading-lg font-semibold">Link expired</h1>
        <p className="text-body text-foreground-muted">
          This password reset link is invalid or has already been used.
          Request a new one from the sign-in page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading-lg font-semibold">Set a new password</h1>
      </header>
      <UpdatePasswordForm />
    </div>
  );
}
