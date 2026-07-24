/**
 * @file colaborar-editores.test.ts
 * @description Source-reading tests for the /colaborar/editores page
 * (HOS-277 G-5 — migrated off the non-persisting `ContributionForm`).
 *
 * Asserts:
 *   - SSR (HOS-74): no prerender/getStaticPaths; locale from Astro.locals.locale
 *   - Recruitment + cross-incentive copy through t() with alliance-leads.editor.* keys
 *   - Mounts AllianceLead with kind="editor" (not the old ContributionForm)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/colaborar/editores/index.astro'),
    'utf8'
);

describe('colaborar/editores/index.astro (editor recruitment page, HOS-277)', () => {
    describe('rendering mode (SSR — HOS-74)', () => {
        it('does NOT set prerender = true (SSR so the middleware CSP header reaches it)', () => {
            expect(src).not.toContain('export const prerender = true');
        });

        it('does NOT declare getStaticPaths (lang resolved at request time under SSR)', () => {
            expect(src).not.toContain('getStaticPaths');
        });

        it('reads the locale from Astro.locals.locale (validated by middleware)', () => {
            expect(src).toContain('Astro.locals.locale');
        });
    });

    describe('form mount (HOS-277 G-5)', () => {
        it('mounts the AllianceLead island with kind="editor"', () => {
            expect(src).toContain("from '@/components/alliance/AllianceLead.client'");
            expect(src).toMatch(/<AllianceLead[^>]*kind="editor"/s);
            expect(src).toMatch(/<AllianceLead[^>]*client:load/s);
            expect(src).toMatch(/<AllianceLead[^>]*locale=\{locale\}/s);
        });

        it('does NOT import or mount the old non-persisting ContributionForm', () => {
            expect(src).not.toContain("from '@/components/contributions/ContributionForm.client'");
            expect(src).not.toMatch(/<ContributionForm\b/);
            expect(src).not.toContain('presetType="editor_application"');
        });
    });

    describe('i18n', () => {
        it('resolves landing copy from the alliance-leads.editor namespace via t()', () => {
            expect(src).toContain('createTranslations');
            expect(src).toMatch(/t\(\s*'alliance-leads\.editor\./);
        });
    });

    describe('cross-incentive copy (HOS-277 §6.6, NG-2)', () => {
        it('renders the cross-incentive block sourced from i18n only', () => {
            expect(src).toContain('alliance-leads.editor.crossIncentive.title');
            expect(src).toContain('alliance-leads.editor.crossIncentive.body');
        });

        it('contains no billing logic wiring (no imports, no entitlement/discount calculation)', () => {
            expect(src).not.toContain('@repo/billing');
            expect(src).not.toMatch(/entitlement/i);
            expect(src).not.toMatch(/discount\s*[=(]/i);
            expect(src).not.toContain('EntitlementKey');
        });
    });

    describe('layout', () => {
        it('renders BaseLayout, SEOHead and Breadcrumbs, matching the sumate/* landings molde', () => {
            expect(src).toContain('BaseLayout');
            expect(src).toContain('SEOHead');
            expect(src).toContain('Breadcrumbs');
        });
    });
});
