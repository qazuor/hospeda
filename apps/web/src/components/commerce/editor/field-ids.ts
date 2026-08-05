/**
 * @file field-ids.ts
 * @description The commerce owner editor's id namespace and its sub-control
 * suffixes (HOS-385).
 *
 * Companion to `@/components/host/editor/field-ids`. This replaces the 18-row
 * `field-input-ids.ts` lookup table: that table mapped every field to a
 * free-form id string, so ANY row could be wrong and a wrong row failed
 * silently. Here the id is derived from the Zod key by `buildFieldId`, and only
 * the genuine exceptions are declared — so the worst a mistake can do is
 * mis-target within one field's own family, never point at an unrelated element
 * or at nothing at all.
 *
 * ## Why commerce renames more ids than accommodation did
 *
 * This editor validates against a schema with NESTED blocks, so several of its
 * Zod keys are dotted paths (`contactInfo.workEmail`,
 * `socialNetworks.facebook`). `buildFieldId` normalises the dots to hyphens, and
 * the hand-written ids never encoded the parent at all — `ce-workEmail`,
 * `ce-social-facebook`. Derivation therefore renames 8 ids here against
 * accommodation's 1. Ids are internal (no deep links, no external consumers), so
 * this is safe at runtime; the cost lands on tests that query by id.
 */

/** Id namespace for every field in the commerce owner editor. */
export const COMMERCE_FIELD_PREFIX = 'ce';

/**
 * Zod keys whose focus target is a suffixed sub-control.
 *
 * `contactInfo.mobilePhone` is ONE Zod field rendered as TWO controls (a country
 * combobox plus a number input). The number is the right focus target: it is the
 * one the error message describes.
 *
 * Read this constant from BOTH the render site and the focus site. Passing a
 * suffix ad-hoc at either end is what would let them disagree, and a
 * disagreement here is invisible — `focusFirstInvalidField` resolves ids with
 * `document.getElementById`, so a miss is a no-op with no throw and no warning.
 */
export const COMMERCE_FIELD_ID_SUFFIXES: Readonly<Record<string, string>> = {
    'contactInfo.mobilePhone': 'number'
} as const;
