/**
 * @file beta-201-tourist-upsell-links.test.ts
 * @description Source-reading guards for the two BETA-201 surfaces whose upsell
 * target is UNCONDITIONALLY the tourist plans page (they gate tourist-only
 * entitlements every owner plan already inherits, so their audience is always a
 * free-tier tourist): the PriceAlertButton locked state and the accommodation
 * detail page's WhatsApp upsell.
 *
 * These are constant-routing changes (no new conditional logic), so a source
 * guard is the proportionate check — mirrors the .astro source-test convention
 * in test/pages/checkout-pages.test.ts. The role-aware checkout surfaces are
 * covered separately (helper in src/lib/__tests__/account-roles.test.ts, wiring
 * in test/pages/checkout-pages.test.ts).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const priceAlertSrc = readFileSync(
    resolve(__dirname, '../src/components/accommodation/PriceAlertButton.tsx'),
    'utf8'
);

const slugSrc = readFileSync(
    resolve(__dirname, '../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

describe('BETA-201 — tourist-only upsell links point at the tourist plans page', () => {
    // Both cases now match `PRICING_PAGE_PATH_BY_AUDIENCE.tourist` instead of a
    // URL literal (HOS-1032). What BETA-201 fixed — and what these must keep
    // failing on — is the AUDIENCE: a free-tier tourist sent to the owner
    // catalogue cannot buy anything on the page they land on. The URL itself has
    // moved twice since, and both times every literal here was rewritten without
    // either assertion ever catching a defect. The paths are frozen once, in
    // `test/lib/pricing-page-paths.test.ts`.
    it('PriceAlertButton locked state links to the TOURIST plans page, not the owner one', () => {
        // PRICE_ALERTS is a tourist entitlement; the locked state is only shown
        // to free-tier tourists, so the upgrade CTA must target the tourist page.
        expect(priceAlertSrc).toMatch(/upgradeHref[^\n]*PRICING_PAGE_PATH_BY_AUDIENCE\.tourist/);
        expect(priceAlertSrc).not.toMatch(/upgradeHref[^\n]*PRICING_PAGE_PATH_BY_AUDIENCE\.owner/);
    });

    it('accommodation detail WhatsApp upsell links to the TOURIST plans page, not the owner one', () => {
        expect(slugSrc).toMatch(/whatsappPlansHref[^\n]*PRICING_PAGE_PATH_BY_AUDIENCE\.tourist/);
        expect(slugSrc).not.toMatch(/whatsappPlansHref[^\n]*PRICING_PAGE_PATH_BY_AUDIENCE\.owner/);
    });

    it('neither upsell spells a retired URL by hand', () => {
        // The other half: reading the map is only a guarantee while nothing goes
        // back to writing the path out. Both of these URLs are 301s now, so a
        // literal here would send an upsell through a redirect.
        for (const src of [priceAlertSrc, slugSrc]) {
            expect(src).not.toContain('suscriptores/planes/turistas');
            expect(src).not.toContain('suscriptores/planes/anfitriones');
        }
    });
});
