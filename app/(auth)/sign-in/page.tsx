import Link from "next/link";

import { AuthShell } from "@/components/shell/auth-shell";
import { FormMessage } from "@/components/ui/form-message";
import { SignInForm } from "@/features/authentication/components/sign-in-form";

export const metadata = { title: "Sign in — BatchVault" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string | string[] }>;
}) {
  // Set only by the auth callback when an emailed link couldn't be used.
  const { link } = await searchParams;
  const linkFailed = link === "invalid";

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
      {linkFailed && (
        <FormMessage tone="error" className="mb-5">
          That email link has expired, was already used, or was opened on a different device. If you&apos;ve
          already verified your email, sign in below. Otherwise open the link on the device you signed up
          on, or create your account again to get a new one.
        </FormMessage>
      )}
      <SignInForm />
    </AuthShell>
  );
}
