import Link from "next/link";

import { SignUpForm } from "@/features/authentication/components/sign-up-form";

export const metadata = { title: "Create your account — BatchVault" };

export default function SignUpPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading-lg font-semibold">Create your account</h1>
        <p className="text-body-sm text-foreground-muted">
          Your batch&rsquo;s private archive is waiting.
        </p>
      </header>

      <SignUpForm />

      <p className="text-body-sm text-foreground-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
