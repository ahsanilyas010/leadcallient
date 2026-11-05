// Shared by the delete dialogs (client) and the delete actions (server).

// Typed confirmation for permanently deleting more than one record.
export const PURGE_CONFIRM_WORD = "DELETE";
// Typed confirmation for erasing one person's data (data-subject request).
export const ERASE_CONFIRM_WORD = "ERASE";
// How long an import can be undone (migration 117, undo_import()).
export const IMPORT_UNDO_DAYS = 7;
// Default trash retention (workspaces.trash_retention_days).
export const DEFAULT_TRASH_DAYS = 30;
