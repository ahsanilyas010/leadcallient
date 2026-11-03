-- The vendor's own workspace (slug 'assorted', seeded by
-- src/lib/seed/run.ts) is not a paying tenant and should never hit the
-- agent seat cap. Rather than add a column, use int4 max as the
-- "unlimited" sentinel: every `used >= seat_limit` check stays false and
-- the app (src/lib/plan.ts: UNLIMITED_SEATS / fmtSeats) shows it as
-- "Unlimited".
--
-- The guard trigger only lets the service role or a platform admin touch
-- seat_limit, and a migration runs as neither, so switch it off around the
-- update exactly like migration 96 did.
alter table workspaces disable trigger workspaces_guard_self_update;
update workspaces set seat_limit = 2147483647 where slug = 'assorted';
alter table workspaces enable trigger workspaces_guard_self_update;
