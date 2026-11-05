"use client";

import { useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SettingToggle } from "@/components/ui/setting-toggle";
import { savePreference } from "@/lib/actions/preferences";

// Show or hide the columns of a list view. Each switch saves straight away,
// for this person only, and is remembered on every device.
export function ColumnPicker({
  list,
  columns,
  hidden,
  onChange,
}: {
  list: "leads" | "contacts";
  columns: { key: string; label: string }[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = columns.length - columns.filter((c) => hidden.includes(c.key)).length;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid="column-picker">
        <Columns3 className="h-3.5 w-3.5" /> Columns ({shown}/{columns.length})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Show or hide columns</DialogTitle>
            <DialogDescription>Saved for you only. Hidden columns are still in the data and in exports.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] divide-y divide-line overflow-y-auto pr-1">
            {columns.map((c) => (
              <SettingToggle
                key={c.key}
                compact
                label={c.label}
                checked={!hidden.includes(c.key)}
                onLabel="Shown"
                offLabel="Hidden"
                onSave={async (on) => {
                  const next = on ? hidden.filter((h) => h !== c.key) : [...hidden, c.key];
                  onChange(next);
                  const r = await savePreference({ key: "hiddenColumns", list, value: next });
                  if (r.error) onChange(hidden);
                  return r;
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
