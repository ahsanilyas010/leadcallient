"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { requestOwnerPin, verifyOwnerPin, type OwnerPinState } from "@/lib/actions/owner-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  );
}

export function OwnerLoginForm() {
  const [requestState, requestAction] = useActionState(requestOwnerPin, { step: "email" } as OwnerPinState);
  const [verifyState, verifyAction] = useActionState(verifyOwnerPin, { step: "pin" } as OwnerPinState);
  const onPinStep = requestState.step === "pin";
  const email = requestState.email ?? "";

  return (
    <Card>
      <CardContent className="pt-4">
        {!onPinStep ? (
          <form action={requestAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={email} />
            </div>
            {requestState.error && (
              <p className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger" role="alert">
                {requestState.error}
              </p>
            )}
            <Submit>
              <Mail className="h-4 w-4" /> Email me a PIN
            </Submit>
          </form>
        ) : (
          <form action={verifyAction} className="flex flex-col gap-4">
            <input type="hidden" name="email" value={email} />
            <p className="rounded-md bg-brand-blue-tint px-3 py-2 text-xs text-brand-blue" role="status">
              {requestState.notice}
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin">PIN for {email}</Label>
              <Input
                id="pin"
                name="pin"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={12}
                required
                autoFocus
                className="text-center font-mono text-lg tracking-[0.4em]"
              />
            </div>
            {verifyState.error && (
              <p className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger" role="alert">
                {verifyState.error}
              </p>
            )}
            <Submit>
              <KeyRound className="h-4 w-4" /> Sign in
            </Submit>
            <button
              type="button"
              className="text-xs font-medium text-brand-blue hover:underline"
              onClick={() => window.location.reload()}
            >
              Use a different email or resend
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
