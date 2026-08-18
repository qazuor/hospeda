/**
 * @fileoverview
 * Regression tests for the partner checkout return page.
 *
 * A partner is an EXTERNAL brand with no Hospeda account: an admin generates
 * the payment link (`apps/api/src/routes/partners/admin/send-link.ts`) and
 * sends it out. Until this fix the MercadoPago `back_url` pointed at
 * `${HOSPEDA_ADMIN_URL}/partners`, so the person who had just paid landed on
 * the admin login screen — a wall, on the last screen of a paid checkout.
 *
 * This page is the public landing that replaces it. Three properties are pinned
 * here because each one is a way the page silently stops serving that buyer:
 * the page must EXIST (a `back_url` pointing at a missing route is the Finding
 * #8 class of bug), it must not send them behind a session wall, and every
 * string must resolve in all three locales — a key missing from a locale file
 * renders the raw dotted key in production.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/partners/checkout/pending.astro');

const LOCALES = ['es', 'en', 'pt'] as const;

/** Resolves a dotted i18n key against the locale JSON file of its namespace. */
function resolveKey(locale: string, dottedKey: string): unknown {
    const [namespace, ...rest] = dottedKey.split('.');
    const file = resolve(
        __dirname,
        `../../../../packages/i18n/src/locales/${locale}/${namespace}.json`
    );
    if (!existsSync(file)) return undefined;
    let node: unknown = JSON.parse(readFileSync(file, 'utf8'));
    for (const segment of rest) {
        if (typeof node !== 'object' || node === null) return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

describe('partner checkout return page', () => {
    it('exists as a public Astro route', () => {
        // A back_url pointing at a route that does not exist is rewritten by
        // Astro's locale middleware into the 404 surface (Finding #8).
        expect(existsSync(PAGE_PATH)).toBe(true);
    });

    it('renders through the marketing layout and the shared checkout result block', () => {
        const src = readFileSync(PAGE_PATH, 'utf8');
        expect(src).toContain('MarketingLayout');
        expect(src).toContain('CheckoutResult');
    });

    it('never sends the buyer behind a session wall', () => {
        const src = readFileSync(PAGE_PATH, 'utf8');
        // `/mi-cuenta` and the admin panel both require a session this buyer can
        // never have. Asserted on the CTA targets themselves (not on the file
        // text, which legitimately names the old admin URL in its history note):
        // every link the page offers must be one of the two public destinations
        // it builds locally.
        const ctaTargets = [...src.matchAll(/href:\s*([A-Za-z0-9_]+),/g)].map(
            (match) => match[1] as string
        );
        expect(ctaTargets.length).toBeGreaterThan(0);
        expect(new Set(ctaTargets)).toEqual(new Set(['homeUrl', 'contactUrl']));
        expect(src).toContain('const homeUrl = buildUrl({ locale });');
        expect(src).toContain("const contactUrl = buildUrl({ locale, path: 'contacto' });");
    });

    it('does not claim the listing is already live', () => {
        const src = readFileSync(PAGE_PATH, 'utf8');
        // The charge is confirmed asynchronously by the webhook; the copy must
        // describe that intermediate state, not a completed publication.
        expect(src).toContain('pending');
        expect(src.toLowerCase()).not.toContain('ya estás publicad');
    });

    it('resolves every i18n key it uses in es, en and pt', () => {
        const src = readFileSync(PAGE_PATH, 'utf8');
        const keys = [...src.matchAll(/\bt\(\s*'([^']+)'/g)].map((match) => match[1] as string);

        expect(keys.length).toBeGreaterThan(0);

        for (const locale of LOCALES) {
            for (const key of keys) {
                expect(
                    typeof resolveKey(locale, key),
                    `missing i18n key '${key}' in locale '${locale}' — renders as the raw key in production`
                ).toBe('string');
            }
        }
    });
});
