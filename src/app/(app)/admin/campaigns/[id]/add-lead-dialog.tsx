"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { createManualLead, type ActionResult } from "@/lib/actions/leads";
import { countryToRegion } from "@/lib/campaign-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const initialState: ActionResult = {};
const NONE = "__none__";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add lead"}
    </Button>
  );
}

export function AddLeadDialog({
  campaignId,
  campaignCountry,
  agents,
  screeningRequired = false,
}: {
  campaignId: string;
  campaignCountry: string | null;
  agents: { id: string; name: string }[];
  screeningRequired?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createManualLead, initialState);
  const [assignedTo, setAssignedTo] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      if (state.note) toast.success(state.note);
      router.refresh();
    }
  }, [state.ok, state.note, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Add lead
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>
            The number is checked against the suppression list and this campaign&rsquo;s existing leads.{" "}
            {screeningRequired ? "The lead is not dialable until it has been screened. " : ""}
            Leave the phone blank to save a contact that still needs a number.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="campaign_id" value={campaignId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_first_name">First name</Label>
              <Input id="al_first_name" name="first_name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_last_name">Last name</Label>
              <Input id="al_last_name" name="last_name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_company">Company</Label>
              <Input id="al_company" name="company_name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_email">Email</Label>
              <Input id="al_email" name="email" type="email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_phone">Phone</Label>
              <Input id="al_phone" name="phone" placeholder="+44 7700 900123" mono />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_country">Phone region</Label>
              <Input id="al_country" name="country" defaultValue={countryToRegion(campaignCountry)} placeholder="GB / US / PK" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_city">City</Label>
              <Input id="al_city" name="city" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_region">County / state</Label>
              <Input id="al_region" name="region" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="al_postcode">Postcode</Label>
              <Input id="al_postcode" name="postcode" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="al_assign">Assign to</Label>
            <Select value={assignedTo || undefined} onValueChange={(v) => setAssignedTo(v === NONE ? "" : v)}>
              <SelectTrigger id="al_assign">
                <SelectValue placeholder="Leave unassigned (shared pool)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Leave unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="assigned_to" value={assignedTo} />
          </div>

          {state.error && <p className="rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
