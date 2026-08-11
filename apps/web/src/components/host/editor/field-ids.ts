/**
 * @file field-ids.ts
 * @description The accommodation editor's id namespace and its sub-control
 * suffixes (HOS-385).
 *
 * This replaces the 21-row `field-input-ids.ts` lookup table. The difference is
 * not cosmetic: that table mapped every field to a free-form id string, so ANY
 * row could be wrong and a wrong row failed silently. Here the id is derived
 * from the Zod key by `buildFieldId`, and only the genuine exceptions are
 * declared — so the worst a mistake can do is mis-target within one field's own
 * family, never point at an unrelated element or at nothing at all.
 */

/** Id namespace for every field in the accommodation editor. */
export const ACCOMMODATION_FIELD_PREFIX = 'acc';

/**
 * Zod keys whose focus target is a suffixed sub-control.
 *
 * `phone` and `whatsapp` are ONE Zod field each but render as TWO controls (a
 * country combobox plus a number input). The number is the right focus target:
 * it is the one the error message describes.
 *
 * Read this constant from BOTH the render site and the focus site. Passing a
 * suffix ad-hoc at either end is what would let them disagree, and a
 * disagreement here is invisible — `focusFirstInvalidField` resolves ids with
 * `document.getElementById`, so a miss is a no-op with no throw and no warning.
 */
export const ACCOMMODATION_FIELD_ID_SUFFIXES: Readonly<Record<string, string>> = {
    phone: 'number',
    whatsapp: 'number'
} as const;
