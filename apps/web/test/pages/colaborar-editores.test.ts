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

        // An island has no access to Astro.locals, so the signed-in visitor has
        // to be handed down as a prop for the name/email prefill. Only name and
        // email: island props are serialized into the page source.
        it('forwards the signed-in visitor to the island for prefill', () => {
            expect(src).toContain('Astro.locals.user');
            expect(src).toMatch(/<AllianceLead[^>]*currentUser=\{currentUser\}/s);
            expect(src).toContain('Astro.locals.user.name');
            expect(src).toContain('Astro.locals.user.email');
            expect(src).not.toContain('Astro.locals.user.id');
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

        // Regression: in the hero it added ~154px above the form, which on a
        // 1366x800 screen was enough to push the form off-screen entirely. It
        // is a secondary offer aimed at a subset of visitors, so it belongs
        // after the primary CTA, not ahead of it.
        it('renders after the form section, not inside the hero', () => {
            const formIndex = src.indexOf('<AllianceLead');
            const crossIncentiveIndex = src.indexOf('alliance-leads.editor.crossIncentive.title');

            expect(formIndex).toBeGreaterThan(-1);
            expect(crossIncentiveIndex).toBeGreaterThan(formIndex);
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

        // Regression: mounting `Breadcrumbs` is not the same as rendering one.
        // `buildBreadcrumbTrail` drops the last item (this page's own <h1>) and
        // returns an empty trail when only "Inicio" would remain, so passing
        // just the page title emitted zero HTML.
        it('passes the /colaborar/ parent level so the trail actually renders', () => {
            expect(src).toContain('contributions.hub.title');
            expect(src).toMatch(/label:\s*t\(\s*'contributions\.hub\.title'/s);
        });

        // Unlike the /sumate/ landings, this parent page really exists, so the
        // level is a link rather than plain context text.
        it('links the parent level to the existing /colaborar/ page', () => {
            expect(src).toMatch(/path:\s*'colaborar'/);
        });

        it('wraps the breadcrumb in a container (the component brings none)', () => {
            expect(src).toContain('class="sumate__breadcrumbs"');
            expect(src).toMatch(/\.sumate__breadcrumbs\s*\{[^}]*max-width/s);
        });

        // Regression: the full --space-section on both sections pushed the form
        // below the fold on a 1366x800 screen.
        it('does not pad the hero and form sections with the full --space-section', () => {
            expect(src).not.toContain('padding-block: var(--space-section, 120px)');
        });
    });
});
