/**
 * @file beta-201-tourist-upsell-links.test.ts
 * @description Source-reading guards for the two BETA-201 surfaces whose upsell
 * target is UNCONDITIONALLY the tourist plans page (they gate tourist-only
 * entitlements every owner plan already inherits, so their audience is always a
 * free-tier tourist): the accommodation detail page's WhatsApp upsell. (The
 * PriceAlertButton locked state this file also pinned was removed with the
 * old billing's client-side gate, HOS-1637.)
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

const slugSrc = readFileSync(
    resolve(__dirname, '../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

describe('BETA-201 — tourist-only upsell links point at the tourist plans page', () => {
    // The case now matches `PRICING_PAGE_PATH_BY_AUDIENCE.tourist` instead of a
    // URL literal (HOS-1032). What BETA-201 fixed — and what these must keep
    // failing on — is the AUDIENCE: a free-tier tourist sent to the owner
    // catalogue cannot buy anything on the page they land on. The URL itself has
    // moved twice since, and both times every literal here was rewritten without
    // either assertion ever catching a defect. The paths are frozen once, in
    // `test/lib/pricing-page-paths.test.ts`.
    it('accommodation detail WhatsApp upsell links to the TOURIST plans page, not the owner one', () => {
        expect(slugSrc).toMatch(/whatsappPlansHref[^\n]*PRICING_PAGE_PATH_BY_AUDIENCE\.tourist/);
        expect(slugSrc).not.toMatch(/whatsappPlansHref[^\n]*PRICING_PAGE_PATH_BY_AUDIENCE\.owner/);
    });

    it('the upsell does not spell a retired URL by hand', () => {
        // The other half: reading the map is only a guarantee while nothing goes
        // back to writing the path out. Both of these URLs are 301s now, so a
        // literal here would send an upsell through a redirect.
        expect(slugSrc).not.toContain('suscriptores/planes/turistas');
        expect(slugSrc).not.toContain('suscriptores/planes/anfitriones');
    });
});
