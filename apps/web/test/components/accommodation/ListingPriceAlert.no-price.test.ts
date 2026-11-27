/**
 * @file ListingPriceAlert.no-price.test.ts
 * @description HOS-2671: a listing without a price («Precio a consultar») must not offer the
 * price-alert control to any viewer kind, because the API refuses the subscription.
 *
 * `.astro` files cannot be rendered by vitest in this repo, so the decision lives in the pure
 * `canOfferPriceAlert` helper (behaviour) and the source checks pin that the component and both
 * page mounts actually use it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canOfferPriceAlert } from '@/lib/listing-contact/listing-contact-price';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../../src', rel), 'utf8');

describe('canOfferPriceAlert', () => {
    it('offers the alert for a priced listing', () => {
        expect(
            canOfferPriceAlert({
                price: { amount: 20000, currency: 'ARS', unitLabelKey: null, onRequest: false }
            })
        ).toBe(true);
    });

    it.each([
        ['null price', null],
        ['null amount', { amount: null, currency: null, unitLabelKey: null, onRequest: true }],
        ['zero amount', { amount: 0, currency: 'ARS', unitLabelKey: null, onRequest: true }],
        ['onRequest flag', { amount: 5000, currency: 'ARS', unitLabelKey: null, onRequest: true }]
    ])('does not offer it for %s', (_label, price) => {
        expect(canOfferPriceAlert({ price })).toBe(false);
    });
});

describe('ListingPriceAlert wiring', () => {
    it('renders nothing when the alert cannot be offered', () => {
        const src = read('components/accommodation/ListingPriceAlert.astro');
        expect(src).toContain('canOfferPriceAlert({ price })');
        expect(src).toMatch(/\{offered && \(\s*<div class:list/);
    });

    it('passes the listing price from both mounts in the detail page', () => {
        const page = read('pages/[lang]/alojamientos/[slug].astro');
        const mounts = page.match(/<ListingPriceAlert\b[^>]*\/>/g) ?? [];
        expect(mounts).toHaveLength(2);
        for (const mount of mounts) expect(mount).toContain('price={contactPrice}');
    });
});
