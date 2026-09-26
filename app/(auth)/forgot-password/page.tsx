import Link from "next/link";

import { ForgotPasswordForm } from "@/features/authentication/components/forgot-password-form";

export const metadata = { title: "Reset your password — BatchVault" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading-lg font-semibold">Reset your password</h1>
        <p className="text-body-sm text-foreground-muted">
          We&rsquo;ll email you a link to choose a new one.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="text-body-sm text-foreground-muted">
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
