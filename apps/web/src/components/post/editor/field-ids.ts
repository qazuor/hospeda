/**
 * @file field-ids.ts
 * @description The post editor's id namespace and its sub-control suffixes
 * (HOS-374 Phase 2 2C-2).
 *
 * Same contract as the accommodation editor's `field-ids.ts`: the DOM id is
 * DERIVED from the Zod key by `buildFieldId`, so the render site and the
 * focus-on-error site cannot disagree. Only genuine exceptions — one Zod key
 * rendered as several controls — are declared here.
 */

/** Id namespace for every field in the post editor. */
export const POST_FIELD_PREFIX = 'post';

/**
 * Zod keys whose focus target is a suffixed sub-control.
 *
 * Empty today: every post field renders as exactly one control. It exists (and
 * is passed to `useZodForm`) so adding a multi-control field later is a
 * one-line change here rather than a new plumbing path — and so the constant is
 * read from BOTH ends from day one, which is what keeps them in sync.
 */
export const POST_FIELD_ID_SUFFIXES: Readonly<Record<string, string>> = {} as const;
