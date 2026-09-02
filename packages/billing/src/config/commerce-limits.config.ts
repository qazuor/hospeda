/**
 * The vertical ↔ limit-key ↔ product-domain correspondence (HOS-688 §6.8).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * Commerce billing is per-owner and per-vertical, so three questions get asked
 * over and over across `apps/api`:
 *
 *   1. which `LimitKey` caps this vertical?          → {@link LIMIT_KEY_BY_COMMERCE_VERTICAL}
 *   2. which subscription domain owns this key?      → {@link productDomainForLimitKey}
 *   3. which plan supplies this key's base value?    → the two above, together
 *
 * Answering any of them at the call site is how the cap silently stops
 * existing: every layer beneath resolves an unknown key to `-1` ("unlimited")
 * and none of them raises. So they are answered exactly once, here.
 *
 * And answered without a default (HOS-1078). This file used to carry the
 * warning above AND an `?? ACCOMMODATION` three lines below it, which is the
 * same failure one layer up: an unknown key got a confident, wrong answer.
 * {@link PRODUCT_DOMAIN_BY_LIMIT_KEY} is now exhaustive over `LimitKey` and
 * {@link productDomainForLimitKey} returns `undefined` for anything else.
 *
 * §6.8 G-2 forbids branching *behaviour* by domain — `if (domain ===
 * 'experience') { require approval }`. A `Record<domain, LimitKey>` lookup is
 * explicitly NOT that, and AC-7 says so: it is one code path reading a
 * different value.
 *
 * A FOURTH question joined these three (HOS-1079): given only a
 * `CommerceVertical` — no `LimitKey` in hand yet — which product domain does
 * it map to? {@link commerceVerticalToProductDomain} answers it by composing
 * the two exhaustive maps above rather than restating the
 * gastronomy/experience associations a third time: `LIMIT_KEY_BY_COMMERCE_VERTICAL`
 * turns the vertical into its `LimitKey`, then `PRODUCT_DOMAIN_BY_LIMIT_KEY`
 * turns that into the domain. It replaced five copies, across `apps/api`, of
 * a `vertical === 'gastronomy' ? GASTRONOMY : EXPERIENCE` ternary that
 * silently answered `EXPERIENCE` for any other value — `'accommodation'`
 * included.
 * ---
 *
 * @module config/commerce-limits
 */

import { ProductDomainEnum, type ProductDomainValue } from '@repo/schemas';
import { LimitKey } from '../types/plan.types.js';

/**
 * The two commerce verticals, spelled the way both
 * `commerce_listing_subscriptions.entity_type` and
 * `billing_subscriptions.product_domain` spell them.
 *
 * The collision is deliberate (see `ProductDomainEnum`'s doc): it makes a link
 * row's domain a pure function of its own entity type.
 */
export type CommerceVertical = 'gastronomy' | 'experience';

/**
 * The listing cap of each commerce vertical.
 *
 * Exhaustive over {@link CommerceVertical} by type, so a third vertical is a
 * compile error here rather than an uncapped listing in production.
 */
export const LIMIT_KEY_BY_COMMERCE_VERTICAL: Readonly<Record<CommerceVertical, LimitKey>> = {
    gastronomy: LimitKey.MAX_GASTRONOMIES,
    experience: LimitKey.MAX_EXPERIENCES
} as const;

/**
 * The billing product domain that owns each cap — EXHAUSTIVELY (HOS-1078).
 *
 * `Record<LimitKey, …>` rather than `Partial<…>` on purpose: a twentieth
 * `LimitKey` is a compile error here, which is the only mechanism that survives
 * somebody adding a key and forgetting this file. It replaces a two-entry map
 * plus an `?? ACCOMMODATION` default, and the default was the bug: an unmapped
 * key — a typo, a new key, a mis-configured add-on row — resolved silently to
 * the accommodation domain, went to read an accommodation plan that does not
 * declare it, and came back `-1`, i.e. unlimited. The file's own header (above)
 * warns about exactly that, and the `??` contradicted it three lines down.
 *
 * Writing `accommodation` seventeen times is the point: every one of them is a
 * decision somebody made, not a value that fell out of a default.
 */
const PRODUCT_DOMAIN_BY_LIMIT_KEY: Readonly<Record<LimitKey, ProductDomainValue>> = {
    // Commerce verticals — the two keys that are NOT accommodation.
    [LimitKey.MAX_GASTRONOMIES]: ProductDomainEnum.GASTRONOMY,
    [LimitKey.MAX_EXPERIENCES]: ProductDomainEnum.EXPERIENCE,

    // Accommodation domain — host caps.
    [LimitKey.MAX_ACCOMMODATIONS]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_ACTIVE_PROMOTIONS]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_PROPERTIES]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_STAFF_ACCOUNTS]: ProductDomainEnum.ACCOMMODATION,

    // Accommodation domain — tourist caps. They ride on the accommodation
    // subscription too: `loadEntitlements` reads one domain, and the tourist
    // plans live in it (see `subscriptionMatchesDomain`, which reads a null
    // `product_domain` as accommodation).
    [LimitKey.MAX_FAVORITES]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_ACTIVE_ALERTS]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_COMPARE_ITEMS]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_SEARCH_HISTORY_ENTRIES]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_COLLECTIONS]: ProductDomainEnum.ACCOMMODATION,

    // Accommodation domain — AI monthly quotas.
    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_AI_CHAT_PER_MONTH]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_AI_SEARCH_PER_MONTH]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_AI_SUPPORT_PER_MONTH]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_AI_TRANSLATE_PER_MONTH]: ProductDomainEnum.ACCOMMODATION,
    [LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH]: ProductDomainEnum.ACCOMMODATION
};

/**
 * Resolves which subscription domain supplies a limit key's base value.
 *
 * This is what stops the addon recalculator and the entitlement loader from
 * reading a gastronomy cap off the owner's ACCOMMODATION plan — where the key
 * is absent, so the base resolves to zero (or, one layer down, to unlimited).
 *
 * Returns `undefined` rather than defaulting (HOS-1078). Every `LimitKey` is
 * mapped, so `undefined` means the caller passed a string that is not a limit
 * key at all — a typo, or a `billing_addons.affects_limit_key` row that no
 * longer matches anything. The old `?? 'accommodation'` turned that into a
 * plausible-looking answer nobody could see was wrong; `undefined` makes the
 * caller decide, and TypeScript makes it impossible to skip.
 *
 * Callers must fail CLOSED on `undefined`: do not raise a cap, do not offer the
 * add-on. Never substitute `'accommodation'` at the call site — that is the
 * `??` again, one level up.
 *
 * @param limitKey - The limit key being resolved.
 * @returns The owning product domain, or `undefined` when the argument is not a
 *   known `LimitKey`.
 *
 * @example
 * ```ts
 * productDomainForLimitKey(LimitKey.MAX_GASTRONOMIES);   // 'gastronomy'
 * productDomainForLimitKey(LimitKey.MAX_ACCOMMODATIONS); // 'accommodation'
 * productDomainForLimitKey('max_gastronomys');           // undefined
 * ```
 */
export function productDomainForLimitKey(
    limitKey: LimitKey | string
): ProductDomainValue | undefined {
    return PRODUCT_DOMAIN_BY_LIMIT_KEY[limitKey as LimitKey];
}

/**
 * Resolves the billing product domain of a commerce vertical.
 *
 * Replaces the `vertical === 'gastronomy' ? ProductDomainEnum.GASTRONOMY :
 * ProductDomainEnum.EXPERIENCE` ternary that used to be copied at five call
 * sites across `apps/api` (HOS-1079). That ternary type-checked cleanly
 * everywhere it was fed an already-narrow {@link CommerceVertical}, but
 * carried no defense of its own: nothing stopped a future caller from
 * widening the parameter to a bare `string` and silently inheriting "anything
 * that is not gastronomy is experience".
 *
 * Deliberately does NOT restate the gastronomy/experience → domain
 * associations in a map of its own (that would be a second copy of the same
 * fact {@link PRODUCT_DOMAIN_BY_LIMIT_KEY} already holds — HOS-1078's own
 * fix for exactly that kind of drift). Instead it composes the two existing
 * exhaustive maps: {@link LIMIT_KEY_BY_COMMERCE_VERTICAL} turns the vertical
 * into its `LimitKey`, and {@link PRODUCT_DOMAIN_BY_LIMIT_KEY} turns that
 * into the domain. Both indexes are total over their key type, so — unlike
 * {@link productDomainForLimitKey}'s `LimitKey | string` input — the result
 * here is never `undefined`.
 *
 * @param vertical - The commerce vertical.
 * @returns Its `billing_subscriptions.product_domain` value.
 */
export function commerceVerticalToProductDomain(vertical: CommerceVertical): ProductDomainValue {
    return PRODUCT_DOMAIN_BY_LIMIT_KEY[LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical]];
}

/**
 * Narrows an unchecked string to a {@link CommerceVertical}, throwing for
 * anything else.
 *
 * One call site receives a commerce vertical as a raw, unchecked `string`
 * rather than an already-narrowed type: `commerce-reconcile.service.ts`
 * reading it back off a subscription's JSONB `metadata` column. Feeding that
 * straight into the binary ternary {@link commerceVerticalToProductDomain}
 * replaced meant an `'accommodation'` value — or plain metadata corruption —
 * was silently answered as `'experience'` (HOS-1079). This is the guard that
 * was missing.
 *
 * @param value - The unchecked value to narrow.
 * @param context - A short label identifying the caller, folded into the
 *   thrown error so a failure is traceable back to its call site.
 * @returns `value`, narrowed to {@link CommerceVertical}.
 * @throws {Error} When `value` is not `'gastronomy'` or `'experience'`.
 */
export function parseCommerceVertical(value: string, context: string): CommerceVertical {
    if (value === 'gastronomy' || value === 'experience') {
        return value;
    }
    throw new Error(`${context}: unsupported commerce vertical '${value}'`);
}
