import Link from "next/link";

import { AuthShell } from "@/components/shell/auth-shell";
import { SignUpForm } from "@/features/authentication/components/sign-up-form";

export const metadata = { title: "Create your account — BatchVault" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Your batch's private archive is waiting. This takes about a minute."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
