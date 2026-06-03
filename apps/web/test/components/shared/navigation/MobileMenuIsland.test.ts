/**
 * @file MobileMenuIsland.test.ts
 * @description Source-level tests for the mobile menu Server Island CTA
 * (SPEC-182 T-016). Astro components cannot be rendered in Vitest, so the
 * host-mode CTA wiring is asserted by inspecting the source (per the web
 * CLAUDE.md "Astro component test" pattern).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/navigation/MobileMenuIsland.astro'),
    'utf8'
);

describe('MobileMenuIsland.astro — host-mode CTA (SPEC-182)', () => {
    it('derives host mode from the server session role (D3: role === HOST)', () => {
        expect(src).toContain("serverUser?.role === 'HOST'");
    });

    it('resolves the admin panel URL from env', () => {
        expect(src).toContain('getAdminUrl()');
    });

    it('only enters host mode when the admin URL is configured', () => {
        expect(src).toMatch(/role === 'HOST' && Boolean\(adminUrl\)/);
    });

    it('keeps the /publicar funnel as the non-host CTA target', () => {
        expect(src).toContain("buildUrl({ locale, path: '/publicar/' })");
    });

    it('uses the host-mode label for hosts and the owner CTA otherwise', () => {
        expect(src).toContain("t('nav.hostModeCta', 'Modo anfitrión')");
        expect(src).toContain("t('nav.ownerCta')");
    });

    it('passes the computed label and href to the MobileMenu island', () => {
        expect(src).toContain('ctaLabel={ctaLabel}');
        expect(src).toContain('ctaHref={ctaHref}');
    });
});
