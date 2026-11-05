"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDataSeats, setWorkspaceStatus } from "@/lib/actions/platform";

export function SuspendButton({ workspaceId, status }: { workspaceId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const suspended = status === "suspended";

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setWorkspaceStatus(workspaceId, suspended ? "active" : "suspended");
          router.refresh();
        })
      }
      className={`text-xs font-semibold hover:underline disabled:opacity-60 ${suspended ? "text-brand-green-text" : "text-danger"}`}
    >
      {pending ? "Working..." : suspended ? "Reactivate" : "Suspend"}
    </button>
  );
}

// Sets how many Data-only seats a workspace has (blank or "unlimited" is not
// offered: Assorted's own workspaces are set by migration).
export function DataSeatsEditor({ workspaceId, seats }: { workspaceId: string; seats: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      className="text-xs font-semibold text-brand-blue hover:underline disabled:opacity-60"
      onClick={() => {
        const raw = window.prompt("How many Data-only seats should this workspace have?", String(seats));
        if (raw === null) return;
        const n = Number(raw.trim());
        if (!Number.isInteger(n) || n < 0) {
          window.alert("Enter a whole number of seats (0 or more).");
          return;
        }
        startTransition(async () => {
          const r = await setDataSeats(workspaceId, n);
          if (r.error) window.alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? "Saving..." : "Set"}
    </button>
  );
}
