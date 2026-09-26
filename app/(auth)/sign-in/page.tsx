import Link from "next/link";

import { SignInForm } from "@/features/authentication/components/sign-in-form";

export const metadata = { title: "Sign in — BatchVault" };

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading-lg font-semibold">Sign in</h1>
        <p className="text-body-sm text-foreground-muted">
          Welcome back to your batch&rsquo;s archive.
        </p>
      </header>

      <SignInForm />

      <div className="flex flex-col gap-2 text-body-sm text-foreground-muted">
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
