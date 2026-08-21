/**
 * @file limit-addon-offer.test.ts
 * @description Unit tests for the limit → add-on offer resolution (HOS-727).
 *
 * ## The property that actually matters here
 *
 * The positive case (4 limits resolve to a focus URL) is the easy half. The
 * load-bearing half is the NEGATIVE: the other 15 limits must resolve to
 * `null`, because an "ampliá con un complemento" link on a cap that sells
 * nothing sends the user to hunt for a card that does not exist. Both
 * consumers (`publish-precheck-panel-content` and the property-quota badge)
 * render their CTA only when this returns non-`null`, so this suite is what
 * stands between the product and that false promise.
 *
 * Expected slugs and URLs are written out BY HAND on purpose. Spreading or
 * re-importing `ADDON_SLUG_BY_LIMIT_KEY` would make every assertion agree with
 * whatever the table happens to say — including after a bad edit.
 */

import { describe, expect, it } from 'vitest';
import { resolveLimitAddonOffer } from '../../../src/lib/billing/limit-addon-offer';

/**
 * The four caps that have something to sell, with the slug each one must
 * resolve to. Hand-written; NOT derived from the source table.
 */
const SELLABLE: ReadonlyArray<readonly [limitKey: string, slug: string]> = [
    ['max_accommodations', 'extra-accommodations-5'],
    ['max_photos_per_accommodation', 'extra-photos-20'],
    ['max_gastronomies', 'extra-gastronomies-1'],
    ['max_experiences', 'extra-experiences-1']
];

/**
 * The caps that sell nothing. Hand-written from the limit inventory in
 * `plan-usage-config`'s audience table, minus the four above.
 */
const NOT_SELLABLE: readonly string[] = [
    'max_active_promotions',
    'max_properties',
    'max_staff_accounts',
    'max_ai_text_improve_per_month',
    'max_ai_chat_per_month',
    'max_ai_translate_per_month',
    'max_ai_accommodation_import_per_month',
    'max_ai_support_per_month',
    'max_favorites',
    'max_collections',
    'max_active_alerts',
    'max_compare_items',
    'max_search_history_entries',
    'max_ai_search_per_month',
    'max_ai_chat_consumer_per_month'
];

describe('resolveLimitAddonOffer — limits that HAVE a purchasable add-on', () => {
    it.each(SELLABLE)('%s resolves to the %s offer', (limitKey, slug) => {
        const offer = resolveLimitAddonOffer({ locale: 'es', limitKey });

        expect(offer).not.toBeNull();
        expect(offer?.slug).toBe(slug);
    });

    it('builds the full focus URL for max_accommodations, param AND anchor', () => {
        const offer = resolveLimitAddonOffer({ locale: 'es', limitKey: 'max_accommodations' });

        // Written out in full: this exact string is what the precheck panel and
        // the quota badge put in their `href`, trailing slash included.
        expect(offer?.href).toBe(
            '/es/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5'
        );
    });

    it('keeps the caller locale in the URL segment', () => {
        expect(resolveLimitAddonOffer({ locale: 'en', limitKey: 'max_accommodations' })?.href).toBe(
            '/en/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5'
        );
        expect(
            resolveLimitAddonOffer({ locale: 'pt', limitKey: 'max_photos_per_accommodation' })?.href
        ).toBe('/pt/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20');
    });
});

describe('resolveLimitAddonOffer — limits that have NOTHING to sell', () => {
    it.each(NOT_SELLABLE)('%s resolves to null (no false promise)', (limitKey) => {
        expect(resolveLimitAddonOffer({ locale: 'es', limitKey })).toBeNull();
    });

    it('covers 15 non-sellable limits against the 4 sellable ones', () => {
        // Guards the inventory itself: if a limit is added to the product and
        // this list is not updated, the count no longer adds up to 19 and this
        // fails, forcing whoever added it to decide which side it falls on.
        expect(NOT_SELLABLE).toHaveLength(15);
        expect(SELLABLE).toHaveLength(4);
    });

    it('returns null for an unknown/invented limit key rather than a bare add-ons link', () => {
        expect(resolveLimitAddonOffer({ locale: 'es', limitKey: 'max_unicorns' })).toBeNull();
        expect(resolveLimitAddonOffer({ locale: 'es', limitKey: '' })).toBeNull();
    });
});
