import Link from "next/link";

import { AuthShell } from "@/components/shell/auth-shell";
import { Button } from "@/components/ui/button";
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
      <AuthShell
        title="Link expired"
        description="This password reset link is invalid or has already been used."
      >
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-foreground-muted">
            Request a new one from the sign-in page and open it on this device.
          </p>
          <Button asChild variant="secondary">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" description="Choose something you don't use anywhere else.">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
