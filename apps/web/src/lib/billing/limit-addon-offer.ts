/**
 * @file limit-addon-offer.ts
 * @description Puts the add-on first on a limit-reached notice when the catalog sells one for the
 * limit hit (HOS-2677, owner decision 27/11/2026). The decision is `findLimitAddonOffer` (the same
 * module the publish cap uses, HOS-2632); this file only reads the offers, builds the labelled
 * link and reorders the payload: add-on first, plan change second. Any failure leaves the
 * plan-only payload untouched.
 *
 * @module lib/billing/limit-addon-offer
 */

import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import {
    type CapAddonCatalogOffer,
    capAddonHref,
    findLimitAddonOffer,
    LIMIT_KEY_VERTICAL
} from '@/lib/billing/addon-cap-offer';
import { getAddonName } from '@/lib/billing/addon-purchase';
import type { LimitReachedDetails, LimitReachedToastPayload } from '@/lib/billing-limit-error';
import { formatPrice } from '@/lib/format-utils';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildVerticalSubscriptionUrl } from '@/lib/publish/publish-page-paths';

/** How long a limit notice waits for the catalog read before showing the plan change alone. */
export const OFFERS_READ_BUDGET_MS = 2500;

/** i18n key of the add-on action label on a limit notice (`billing.limit` is client-loaded). */
export const LIMIT_ADDON_CTA_KEY = 'billing.limit.addonCta';

/**
 * Reorders a plan-only limit payload so the add-on leads. Pure: no network.
 *
 * @param input.payload - The plan-only payload from `buildLimitReachedPayload*`.
 * @param input.limitKey - The limit key the API reported.
 * @param input.offers - The catalog offers.
 * @param input.locale - Active UI locale.
 * @returns The payload with the add-on in `action` and the plan change in `secondaryAction`, or
 * the payload unchanged when the catalog sells no add-on for the limit.
 */
export function applyLimitAddonOffer(input: {
    readonly payload: LimitReachedToastPayload;
    readonly limitKey: string;
    readonly offers: readonly CapAddonCatalogOffer[];
    readonly locale: SupportedLocale;
}): LimitReachedToastPayload {
    const { payload, limitKey, offers, locale } = input;
    const found = findLimitAddonOffer({ offers, limitKey });
    if (!found) return payload;
    const t = createT(locale);
    const label = t(LIMIT_ADDON_CTA_KEY, undefined, {
        name: getAddonName({ offer: { ...found, description: null }, t }),
        price: formatPrice({ amount: found.price / 100, currency: found.currency, locale })
    });
    return {
        ...payload,
        action: {
            label,
            href: capAddonHref({
                subscriptionUrl: buildVerticalSubscriptionUrl({
                    locale,
                    vertical: found.vertical
                }),
                vertical: found.vertical
            })
        },
        secondaryAction: payload.action
    };
}

/**
 * Reads the add-on catalog and, when it sells one for the limit hit, leads the payload with it.
 * Never throws and never blocks the plan change: a limit key with no vertical skips the network
 * entirely, and a failed read returns the plan-only payload.
 *
 * @param input.payload - The plan-only payload from `buildLimitReachedPayload*`.
 * @param input.details - The `details` of the LIMIT_REACHED error (`unknown`, guarded here).
 * @param input.locale - Active UI locale.
 * @param input.fetchOffers - Offers reader; defaults to `billingAddonApi.offers`.
 * @returns The payload to hand to `addToast`.
 */
export async function withLimitAddonOffer(input: {
    readonly payload: LimitReachedToastPayload;
    readonly details: unknown;
    readonly locale: SupportedLocale;
    readonly fetchOffers?: () => ReturnType<typeof billingAddonApi.offers>;
}): Promise<LimitReachedToastPayload> {
    const { payload, details, locale, fetchOffers = () => billingAddonApi.offers() } = input;
    const limitKey = (details as Partial<LimitReachedDetails> | null | undefined)?.limitKey;
    if (typeof limitKey !== 'string' || !LIMIT_KEY_VERTICAL[limitKey]) return payload;
    try {
        // The notice must not wait on a slow catalog read: past the budget it goes out plan-only.
        const result = await Promise.race([
            fetchOffers(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), OFFERS_READ_BUDGET_MS))
        ]);
        if (result === null) return payload;
        if (!result.ok) return payload;
        return applyLimitAddonOffer({ payload, limitKey, offers: result.data.items, locale });
    } catch {
        // The plan change stays as the only way out.
        return payload;
    }
}
