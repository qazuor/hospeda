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
    it('PriceAlertButton locked state links to suscriptores/turistas, not the owner page', () => {
        // PRICE_ALERTS is a tourist entitlement; the locked state is only shown
        // to free-tier tourists, so the upgrade CTA must target the tourist page.
        expect(priceAlertSrc).toMatch(/upgradeHref[^\n]*'suscriptores\/turistas'/);
        expect(priceAlertSrc).not.toContain("path: 'suscriptores/planes'");
    });

    it('accommodation detail WhatsApp upsell links to suscriptores/turistas, not the owner page', () => {
        expect(slugSrc).toMatch(/whatsappPlansHref[^\n]*'suscriptores\/turistas'/);
        expect(slugSrc).not.toMatch(/whatsappPlansHref[^\n]*'suscriptores\/planes'/);
    });
});
