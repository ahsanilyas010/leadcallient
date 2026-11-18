-- Free-for-life is over: a workspace gets a 30-day trial (3 agent seats) and
-- then access is closed until the owner approves it (after the customer has
-- paid by bank transfer). See src/lib/access.ts for the rule the app applies.
--
-- 1. access_approved_at   set by the owner console when a company is approved
--                         to continue; overrides the trial clock.
-- 2. trial_notice_sent_at set once the "trial ends within 2 days" email has
--                         gone out, so the daily cron never emails twice.
-- 3. Existing customers: anyone still on the old free plan gets at least
--    2 days' notice from the moment this migration runs; anyone who already
--    pays is approved so nothing changes for them.

alter table workspaces
  add column if not exists access_approved_at timestamptz,
  add column if not exists trial_notice_sent_at timestamptz;

-- Same guard as migration 120, now also covering the two new owner-only
-- columns (a customer's own session must not be able to approve itself).
create or replace function guard_workspace_self_update() returns trigger
language plpgsql as $$
begin
  if is_platform_admin() or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.seat_limit is distinct from old.seat_limit
     or new.data_seat_limit is distinct from old.data_seat_limit
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.billing_status is distinct from old.billing_status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.billing_amount is distinct from old.billing_amount
     or new.billing_currency is distinct from old.billing_currency
     or new.billing_cycle is distinct from old.billing_cycle
     or new.next_due_date is distinct from old.next_due_date
     or new.access_approved_at is distinct from old.access_approved_at
     or new.trial_notice_sent_at is distinct from old.trial_notice_sent_at
  then
    raise exception 'plan, seats, status, trial, approval and billing fields can only be changed by the service role or a platform admin';
  end if;
  if (new.ops_can_purge is distinct from old.ops_can_purge
      or new.trash_retention_days is distinct from old.trash_retention_days)
     and auth_role() is distinct from 'super_admin'
  then
    raise exception 'only a super admin can change who may permanently delete, or how long trash is kept';
  end if;
  return new;
end;
$$;

-- A migration runs as neither the service role nor a platform admin, so the
-- guard has to be switched off around the data fix (as migrations 96, 115
-- and 120 did).
alter table workspaces disable trigger workspaces_guard_self_update;

-- Already paying (a paid plan, a live Stripe subscription, or a payment in the
-- owner's ledger): approved.
update workspaces w
   set access_approved_at = now()
 where w.access_approved_at is null
   and not w.is_demo
   and w.seat_limit < 2147483647
   and (
     w.plan = 'paid'
     or w.stripe_subscription_id is not null
     or w.billing_status = 'active'
     or exists (select 1 from platform_ledger l where l.workspace_id = w.id and l.kind = 'payment')
   );

-- Everyone else on the old free plan: keep whatever trial time they still
-- have, but never less than 2 days from now. That is the notice period; their
-- access closes when trial_ends_at passes. Demo and Assorted's own
-- (unlimited-seat) workspaces have no trial and are left alone.
update workspaces w
   set trial_ends_at = greatest(coalesce(w.trial_ends_at, now()), now() + interval '2 days'),
       trial_notice_sent_at = null
 where w.access_approved_at is null
   and not w.is_demo
   and w.seat_limit < 2147483647;

alter table workspaces enable trigger workspaces_guard_self_update;
