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
    'contactInfo.mobilePhone': 'number',
    /**
     * `durationMinutes` is ONE Zod field rendered as TWO controls as well
     * (HOS-898): an hours box and a minutes box that `buildPatchPayload` joins
     * into the single stored integer. The MINUTES box is the focus target,
     * because it is the one the schema's message describes — the column and the
     * error are both in minutes.
     */
    durationMinutes: 'minutes'
} as const;

/**
 * Zod keys of this editor that are ONE group of controls rather than one
 * labelled input, so `useZodForm` must roll their nested errors up (HOS-814).
 *
 * `openingHours` is 7 days x N shifts under a single key. Zod reports a bad
 * window at `openingHours.days.mon.shifts.0.close`, which neither the section's
 * `<FieldError>` nor `focusFirstInvalidField` reads — both derive from the bare
 * `openingHours`. Listing it here is what makes a rejected schedule mark a
 * field at all.
 *
 * Module-level and frozen on purpose: it feeds a `useCallback` dependency list,
 * so a fresh array per render would rebuild `validate` on every keystroke.
 */
export const OPENING_HOURS_AGGREGATE_FIELDS: ReadonlyArray<string> = ['openingHours'] as const;
