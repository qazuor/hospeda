/**
 * @file field-ids.ts
 * @description The event editor's id namespace and its sub-control suffixes
 * (HOS-374 Phase 2 2C-3).
 *
 * Same contract as the post and accommodation editors: the DOM id is DERIVED
 * from the Zod key by `buildFieldId`, so the render site and the focus-on-error
 * site cannot disagree. Only genuine exceptions are declared here.
 */

/** Id namespace for every field in the event editor. */
export const EVENT_FIELD_PREFIX = 'event';

/**
 * Zod keys whose focus target is a suffixed sub-control.
 *
 * Empty today: every event field renders as exactly one control. It is still
 * read from BOTH ends (render and focus), so adding a multi-control field later
 * is a one-line change rather than a new plumbing path.
 */
export const EVENT_FIELD_ID_SUFFIXES: Readonly<Record<string, string>> = {} as const;
