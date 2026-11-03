import Link from "next/link";

import { AuthShell } from "@/components/shell/auth-shell";
import { ForgotPasswordForm } from "@/features/authentication/components/forgot-password-form";

export const metadata = { title: "Reset your password — BatchVault" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Tell us your email and we'll send a link to choose a new one."
      footer={
        <p>
          <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
