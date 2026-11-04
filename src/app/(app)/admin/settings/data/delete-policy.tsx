"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { SettingToggle } from "@/components/ui/setting-toggle";
import { Button } from "@/components/ui/button";
import { setDeletePolicy } from "@/lib/actions/data-trash";

export function DeletePolicy({ canEdit, opsCanPurge, retentionDays }: { canEdit: boolean; opsCanPurge: boolean; retentionDays: number }) {
  const router = useRouter();
  const [days, setDays] = useState(String(retentionDays));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 365;

  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4 shadow-sm">
      <SettingToggle
        label="Ops managers can permanently delete"
        description="Off: only the super admin can delete leads and contacts for good, empty the trash or erase a person's data. Ops managers and Data-only users can always move records to the trash."
        checked={opsCanPurge}
        disabled={!canEdit}
        disabledReason={!canEdit ? "Only the super admin can change this." : undefined}
        testId="toggle-ops-purge"
        confirm={{
          when: "on",
          title: "Let ops managers delete permanently?",
          body: "Ops managers will be able to delete leads, contacts and call history for good, empty the trash and erase people's data. Every delete is still in the audit log.",
          confirmLabel: "Allow it",
        }}
        onSave={async (on) => {
          const r = await setDeletePolicy({ opsCanPurge: on, retentionDays });
          if (!r.error) router.refresh();
          return r;
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-3 py-3">
        <div className="min-w-0">
          <label htmlFor="trash-days" className="text-sm font-medium text-ink">
            Keep deleted records in the trash for
          </label>
          <p className="mt-0.5 text-xs text-muted">Between 1 and 365 days. After that they are deleted for good, automatically.</p>
          {error && (
            <p role="alert" className="mt-1 text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="trash-days"
            type="number"
            min={1}
            max={365}
            value={days}
            disabled={!canEdit || pending}
            onChange={(e) => {
              setDays(e.target.value);
              setSaved(false);
            }}
            className="h-9 w-20 rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
            aria-invalid={!valid}
          />
          <span className="text-sm text-muted">days</span>
          {canEdit && (
            <Button
              size="sm"
              disabled={pending || !valid || n === retentionDays}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await setDeletePolicy({ opsCanPurge, retentionDays: n });
                  if (r.error) {
                    setError(r.error);
                    return;
                  }
                  setSaved(true);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null} {saved ? "Saved" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
