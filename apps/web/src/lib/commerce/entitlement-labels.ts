/**
 * @file entitlement-labels.ts
 * @description Presentation-only label map for the commerce entitlement keys
 * that can appear in a tier's "what this adds" list (HOS-1119).
 *
 * Mirrors `missing-field-labels.ts`'s shape: the CELL (which entitlements a
 * tier adds over a cheaper one) is derived data
 * (`deriveCommercePlanTierDiffs`), but the LABEL for each entitlement key is
 * hand-written copy, so it lives here rather than being invented at render
 * time from the raw `EntitlementKey` string value.
 *
 * Deliberately does not import `EntitlementKey` from `@repo/billing` — the
 * keys here are plain string literals matching its wire values, kept in sync
 * by `packages/schemas/test` guards elsewhere in the repo. Importing the enum
 * itself would pull `@repo/billing` into every client island that renders a
 * tier picker, which the static guard
 * (`apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`)
 * forbids.
 *
 * @module lib/commerce/entitlement-labels
 */

/**
 * i18n key SUFFIX (under `commerce.owner.entitlements.*`) for each
 * entitlement key that can show up in a tier's "adds" list. An entitlement
 * with no entry here falls back to its raw key (see
 * `COMMERCE_ENTITLEMENT_FALLBACK_LABEL`) rather than being hidden — an
 * unlabeled addition is still real and should not silently disappear from
 * the picker.
 */
export const COMMERCE_ENTITLEMENT_I18N_SUFFIX: Record<string, string> = {
    manage_gastronomy_menu: 'manageGastronomyMenu'
};

/**
 * Spanish fallback label per entitlement key, passed as `t()`'s fallback arg.
 */
export const COMMERCE_ENTITLEMENT_FALLBACK_LABEL: Record<string, string> = {
    manage_gastronomy_menu: 'Carta estructurada'
};
