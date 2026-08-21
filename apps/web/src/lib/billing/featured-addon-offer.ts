/**
 * @file featured-addon-offer.ts
 * @description The two visibility add-ons offered to a host who cannot feature
 * this listing yet (HOS-728).
 *
 * `visibility-boost-7d` / `-30d` are a third of the sellable catalog and had NO
 * discovery path: they raise no quota (so they never appear in the plan usage
 * panel), they block no action (so they never appear in a cap notice), and the
 * add-ons page is in no menu. The one place that names the capability —
 * `FeaturedToggleSection` — rendered `null` for exactly the hosts who would buy
 * them.
 *
 * Kept OUT of the island so the slug/href pairing is unit-testable without
 * rendering, and so nobody re-concatenates the focus URL by hand:
 * {@link buildAddonFocusUrl} is the single builder (HOS-729).
 *
 * ## Why the slugs are literals here
 *
 * `apps/web` islands deliberately never import `@repo/billing` — its barrel
 * drags `@repo/logger`, which reads `process.env` at module scope and throws
 * during hydration. See the static guard
 * `apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`.
 * `addon-focus.ts` hardcodes the same slugs for the same reason.
 *
 * ## Scope: ONE accommodation, not the account
 *
 * An add-on grant is written to `featured_listing_addon_grants`
 * (`purchaseId` → `accommodationId`) and features exactly ONE listing; only a
 * PLAN grant is owner-wide. That asymmetry is the thing a buyer can get wrong
 * and feel cheated by, so the copy that states it is part of the fix, not
 * decoration — see `account.addons.featuredOffer.scope`.
 */

import { buildAddonFocusUrl } from '@/lib/billing/addon-focus';
import type { SupportedLocale } from '@/lib/i18n';

/**
 * Slugs of the add-ons that grant `FEATURED_LISTING` for a single
 * accommodation, in the order the offer shows them (shortest first).
 */
export const FEATURED_LISTING_ADDON_SLUGS = [
    'visibility-boost-7d',
    'visibility-boost-30d'
] as const;

/** One of the two visibility-boost add-on slugs. */
export type FeaturedListingAddonSlug = (typeof FEATURED_LISTING_ADDON_SLUGS)[number];

/**
 * English defaults from `@repo/billing`'s add-on definitions, mirrored here
 * because islands cannot import that package (see the file header). Used only
 * as the `t()` fallback when `account.addons.catalog.<slug>.name` is missing.
 */
const NAME_FALLBACK_BY_SLUG: Readonly<Record<FeaturedListingAddonSlug, string>> = {
    'visibility-boost-7d': 'Visibility Boost (7 days)',
    'visibility-boost-30d': 'Visibility Boost (30 days)'
};

/** One offered add-on: what to call it and where to send the host. */
export interface FeaturedAddonOffer {
    /** The add-on slug. */
    readonly slug: FeaturedListingAddonSlug;
    /** Focus URL for the add-ons page, built by {@link buildAddonFocusUrl}. */
    readonly href: string;
    /** English default name, used as the i18n fallback. */
    readonly nameFallback: string;
}

/**
 * Builds the two visibility add-on offers for a locale.
 *
 * @param params.locale - Active locale, for the URL's locale segment.
 * @returns Both offers, shortest duration first.
 */
export function buildFeaturedAddonOffers({
    locale
}: {
    readonly locale: SupportedLocale;
}): readonly FeaturedAddonOffer[] {
    return FEATURED_LISTING_ADDON_SLUGS.map((slug) => ({
        slug,
        href: buildAddonFocusUrl({ locale, slug }),
        nameFallback: NAME_FALLBACK_BY_SLUG[slug]
    }));
}
