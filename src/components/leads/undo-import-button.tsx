"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { undoImport } from "@/lib/actions/data-trash";
import { Button } from "@/components/ui/button";

// Undo one import from Data > Import history: everything it created goes to
// the trash, where it can still be restored.
export function UndoImportButton({ runId, label }: { runId: string; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      aria-label={`Undo the import of ${label}`}
      onClick={() => {
        if (!window.confirm(`Undo the import of ${label}? Every lead and contact it created goes to the trash, where you can restore them. Leads it updated keep their changes.`)) return;
        start(async () => {
          const r = await undoImport(runId);
          if (r.error) {
            toast.error(r.error);
            return;
          }
          toast.success(`Undone: ${r.leads ?? 0} lead${r.leads === 1 ? "" : "s"} and ${r.contacts ?? 0} contact${r.contacts === 1 ? "" : "s"} moved to the trash.`);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Undo
    </Button>
  );
}
