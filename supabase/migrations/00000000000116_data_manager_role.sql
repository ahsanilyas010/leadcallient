-- The Data-only seat: for staff who work with leads and contacts but never
-- make or take calls (lead managers, list buyers, data entry, back office).
-- Its own migration because a new enum value can't be used in the
-- transaction that adds it; migration 117 gives the role its access.
alter type app_role add value if not exists 'data_manager';
