"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { ownerAccessWithToken, type OwnerPinState } from "@/lib/actions/owner-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Sign in</>}
    </Button>
  );
}

export function AccessForm() {
  const [state, action] = useActionState(ownerAccessWithToken, { step: "email" } as OwnerPinState);
  return (
    <Card>
      <CardContent className="pt-4">
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token">Access token</Label>
            <Input id="token" name="token" type="password" autoComplete="off" required autoFocus />
          </div>
          {state.error && (
            <p className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger" role="alert">
              {state.error}
            </p>
          )}
          <Submit />
        </form>
      </CardContent>
    </Card>
  );
}
