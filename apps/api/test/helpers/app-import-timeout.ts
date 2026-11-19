/**
 * A cold dynamic import of the whole app can take over 30 seconds on a loaded
 * CI runner (HOS-2219). Use this only for a hook or test whose body imports
 * `src/app` dynamically. Global timeouts deliberately remain unchanged so
 * genuine hangs elsewhere still fail fast.
 */
export const APP_IMPORT_TIMEOUT_MS = 120_000;
