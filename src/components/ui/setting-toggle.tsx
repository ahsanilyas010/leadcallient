"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ToggleConfirm {
  // Ask only when switching to this state (a big effect usually goes one way).
  when: "on" | "off" | "both";
  title: string;
  body: string;
  confirmLabel: string;
}

// One on/off setting: a label, helper text saying what it does, the switch
// and its state in words. Changing it saves straight away (no Save button)
// and says "Saved"; a failed save puts it back and says why. A setting with a
// big effect asks first.
export function SettingToggle({
  label,
  description,
  checked,
  onSave,
  confirm,
  disabled,
  disabledReason,
  onLabel = "On",
  offLabel = "Off",
  testId,
  compact = false,
}: {
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onSave: (next: boolean) => Promise<{ error?: string } | void>;
  confirm?: ToggleConfirm;
  disabled?: boolean;
  disabledReason?: string;
  onLabel?: string;
  offLabel?: string;
  testId?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [on, setOn] = useState(checked);
  const [asking, setAsking] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Follow the server's value when it changes (after a refresh).
  useEffect(() => setOn(checked), [checked]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  function save(next: boolean) {
    setError(null);
    setSaved(false);
    setOn(next);
    start(async () => {
      const r = await onSave(next);
      if (r && r.error) {
        setOn(!next);
        setError(r.error);
        return;
      }
      setSaved(true);
    });
  }

  function request(next: boolean) {
    if (confirm && (confirm.when === "both" || (confirm.when === "on") === next)) {
      setAsking(next);
      return;
    }
    save(next);
  }

  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={`flex items-start justify-between gap-4 ${compact ? "py-1.5" : "py-3"}`} data-testid={testId}>
      <div className="min-w-0">
        <label htmlFor={id} className={`font-medium text-ink ${compact ? "text-sm" : "text-sm"}`}>
          {label}
        </label>
        {description && (
          <p id={descId} className="mt-0.5 text-xs text-muted">
            {description}
          </p>
        )}
        {disabled && disabledReason && <p className="mt-0.5 text-xs text-muted">{disabledReason}</p>}
        {error && (
          <p id={errId} role="alert" className="mt-1 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="min-w-[3.5rem] text-right text-xs" aria-live="polite">
          {pending ? (
            <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted" aria-label="Saving" />
          ) : saved ? (
            <span className="inline-flex items-center gap-1 font-medium text-brand-green-text">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          ) : (
            <span className={on ? "font-semibold text-brand-blue" : "text-muted"}>{on ? onLabel : offLabel}</span>
          )}
        </span>
        <Switch
          id={id}
          checked={on}
          onCheckedChange={request}
          disabled={disabled || pending}
          aria-describedby={[descId, errId].filter(Boolean).join(" ") || undefined}
        />
      </div>

      {confirm && (
        <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setAsking(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const next = asking;
                  setAsking(null);
                  if (next !== null) save(next);
                }}
              >
                {confirm.confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
