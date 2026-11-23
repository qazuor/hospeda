/**
 * @file directorio-proveedores-categories.test.ts
 * @description The two `mi-cuenta` provider pages show ALL of the provider's
 * categories as badges, through the shared component and without a «+N» cap
 * (HOS-919 AC-5.1, D3). Source-level: `.astro` pages cannot be rendered in
 * Vitest. The session-blind guard
 * (`cacheable-pages-are-session-blind.guard.test.ts`) is run alongside: the
 * badges read the provider payload, never the session.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES = [['register usage', '[slug]/registrar-uso/index.astro']] as const;

/**
 * The detail page moved to the account kit (HOS-2472): its categories are
 * StatusPills inside the ProviderDetail island, covered by
 * `directorio-proveedores-detail.test.ts`.
 */
const read = (rel: string): string =>
    readFileSync(
        resolve(__dirname, `../../src/pages/[lang]/mi-cuenta/directorio-proveedores/${rel}`),
        'utf8'
    );

describe.each(PAGES)('mi-cuenta provider %s page — categories', (_name, rel) => {
    const src = read(rel);

    it('renders the shared badge list with every category of the provider', () => {
        expect(src).toContain('TradeCategoryBadges');
        expect(src).toMatch(/categories=\{provider\.categories\}/);
    });

    it('does not cap the list (the detail pages show all)', () => {
        const usage = /<TradeCategoryBadges[\s\S]*?\/>/.exec(src)?.[0] ?? '';
        expect(usage).not.toContain('max=');
    });

    it('no longer reads the single `category` or the legacy i18n labels', () => {
        expect(src).not.toMatch(/provider\.category\b/);
        expect(src).not.toContain('host-trades.categories');
    });

    it('ships no JavaScript for the badges (no client directive)', () => {
        const usage = /<TradeCategoryBadges[\s\S]*?\/>/.exec(src)?.[0] ?? '';
        expect(usage).not.toMatch(/client:/);
    });
});
