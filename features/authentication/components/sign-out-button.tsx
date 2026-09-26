import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

import { signOutAction } from "../actions";

/** A plain `<form>` action, so sign-out works even without client JS. */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </Button>
    </form>
  );
}
