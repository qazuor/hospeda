/**
 * The entitlements each commerce vertical's catalogue grants (HOS-1074).
 *
 * ---
 * WHY THIS FILE EXISTS, AND WHY THE ANSWER LIVES IN CODE
 *
 * HOS-1074's central hazard is an ORDERING one: the six commerce plan rows in
 * every already-seeded environment carry `entitlements: []`, and
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * INSERTS ONLY — an existing row is skipped wholesale. So a gate that reads its
 * grant off the DATABASE would refuse every commerce owner on staging and
 * production from the moment it deploys until the data-migration lands. That is
 * not a hypothetical: it is the failure the issue is written around.
 *
 * The fix is not "run the migration first". It is to make the grant and the
 * gate the SAME artifact: an entitlement set is a `'capability'` field in
 * Model C (`config/model-c-field-split.ts`), which means **config wins and the
 * database follows** — the exact inverse of a price or a cap, where the
 * database wins because an operator decided it. So the floor is read from here,
 * from the binary that also carries the gate, and the DB row can only ever ADD
 * to it (see `commerceVerticalEntitlementMiddleware`). A lagging row cannot
 * lock anyone out, because it is never consulted for the floor.
 *
 * ## Why a vertical-keyed map instead of literals in `plans.config.ts`
 *
 * Two consumers need the same fact and must not be able to disagree:
 *
 *   1. `plans.config.ts` — what `commerceVerticalTier` stamps on all three
 *      tiers of the vertical, which is what the seeder writes into
 *      `billing_plans.entitlements` for a fresh database.
 *   2. `apps/api/src/middlewares/commerce-entitlement.ts` — the floor the gate
 *      resolves for a caller whose subscription plan row has not caught up (or
 *      who has no subscription at all, which is the normal state of an owner
 *      still filling in a DRAFT listing before paying).
 *
 * If (2) read a narrower set than (1) granted, the platform would refuse a
 * capability the catalogue advertises. Answering once, here, makes that
 * impossible rather than merely unlikely — the same reasoning
 * `commerce-limits.config.ts` states for the vertical ↔ limit-key map.
 *
 * @module config/commerce-entitlements
 */

import { EntitlementKey } from '../types/entitlement.types.js';
import type { CommerceVertical } from './commerce-limits.config.js';

/**
 * The entitlement keys every tier of a commerce vertical grants (HOS-1074).
 *
 * Exhaustive over {@link CommerceVertical} by type, so a third vertical is a
 * compile error here rather than a catalogue that silently grants nothing —
 * which, given that the limit engine resolves an unknown key as *unlimited*
 * and the entitlement engine resolves an absent key as *refused*, are two
 * different silent failures in two different directions.
 *
 * Uniform across the three tiers of a vertical ON PURPOSE. Editing and
 * publishing your own listing is not a tier differentiator, in either
 * catalogue: all six accommodation plans grant
 * {@link EntitlementKey.EDIT_ACCOMMODATION_INFO} and
 * {@link EntitlementKey.PUBLISH_ACCOMMODATIONS}, and these two pairs are the
 * commerce mirror of that decision. What separates the tiers is the cap and
 * (later) the feature keys layered above these.
 */
export const ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: Readonly<
    Record<CommerceVertical, readonly EntitlementKey[]>
> = {
    gastronomy: [EntitlementKey.EDIT_GASTRONOMY_INFO, EntitlementKey.PUBLISH_GASTRONOMY],
    experience: [EntitlementKey.EDIT_EXPERIENCE_INFO, EntitlementKey.PUBLISH_EXPERIENCE]
} as const;

/**
 * Every entitlement key owned by a commerce vertical, across both verticals.
 *
 * Exists so a consumer can ask "is this key a commerce key?" without
 * re-deriving the union at the call site — the same reason
 * `isCommerceSubscription()` exists next to `subscriptionMatchesDomain()`.
 */
export const ALL_COMMERCE_ENTITLEMENT_KEYS: readonly EntitlementKey[] = Object.values(
    ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL
).flat();

/**
 * The entitlement keys one commerce vertical grants.
 *
 * @param vertical - The commerce vertical.
 * @returns Its entitlement keys. Never empty, never `undefined`.
 */
export function entitlementKeysForCommerceVertical(
    vertical: CommerceVertical
): readonly EntitlementKey[] {
    return ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL[vertical];
}
