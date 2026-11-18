"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { signUp, type SignupState } from "@/lib/actions/signup";
import { readAttribution, type Attribution } from "@/components/marketing/attribution";
import { trackPixel } from "@/components/marketing/meta-pixel";
import { cn } from "@/lib/utils";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 aria-[invalid=true]:border-danger";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gold-gradient text-base font-semibold text-ink shadow-lg shadow-gold/25 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" /> Creating your workspace…
        </>
      ) : (
        <>
          Start my 30-day free trial <ArrowRight className="h-5 w-5" />
        </>
      )}
    </button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<SignupState, FormData>(signUp, {});
  const [showPw, setShowPw] = useState(false);
  const [attribution, setAttribution] = useState<Attribution>({});
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => setAttribution(readAttribution()), []);

  useEffect(() => {
    if (state.ok && !done.current) {
      done.current = true;
      trackPixel("CompleteRegistration", { content_name: "Free trial workspace", status: true });
      router.push("/start");
    }
  }, [state.ok, router]);

  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {Object.entries(attribution).map(([k, val]) => (val ? <input key={k} type="hidden" name={k} value={val} /> : null))}
      {/* Honeypot — hidden from people, filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Your name" error={fe.full_name}>
          <input id="full_name" name="full_name" autoComplete="name" required defaultValue={v.full_name} aria-invalid={!!fe.full_name} className={inputCls} placeholder="Jordan Smith" />
        </Field>
        <Field id="company" label="Company" error={fe.company}>
          <input id="company" name="company" autoComplete="organization" required defaultValue={v.company} aria-invalid={!!fe.company} className={inputCls} placeholder="Acme Contact Centre" />
        </Field>
      </div>
      <Field id="email" label="Work email" error={fe.email}>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={v.email} aria-invalid={!!fe.email} className={inputCls} placeholder="you@company.com" />
      </Field>
      <Field id="password" label="Password" error={fe.password} hint="At least 8 characters.">
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={!!fe.password}
            className={cn(inputCls, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted hover:text-ink"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--brand-blue)]" aria-invalid={!!fe.agree} />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-brand-blue hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-brand-blue hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {fe.agree && (
        <p className="-mt-2 text-xs text-danger" role="alert">
          {fe.agree}
        </p>
      )}

      {state.error && (
        <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <Submit />
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
