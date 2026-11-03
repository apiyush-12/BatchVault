import Link from "next/link";

import { AuthShell } from "@/components/shell/auth-shell";
import { SignInForm } from "@/features/authentication/components/sign-in-form";

export const metadata = { title: "Sign in — BatchVault" };

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to step back into your batch's archive."
      footer={
        <>
          <p>
            <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </p>
          <p>
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
          </p>
        </>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
