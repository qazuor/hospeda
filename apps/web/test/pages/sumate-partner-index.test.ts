/**
 * @file sumate-partner-index.test.ts
 * @description Source-read tests for the public "Convertite en partner"
 * alliance-lead landing (HOS-277).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/sumate/partner/index.astro'),
    'utf8'
);

describe('sumate/partner/index.astro', () => {
    it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
        expect(src).toContain('Astro.locals.locale');
        expect(src).not.toContain('Astro.params.lang');
    });
    it('uses createTranslations for i18n', () => {
        expect(src).toContain('createTranslations(locale)');
    });
    it('mounts the AllianceLead island with kind="partner"', () => {
        expect(src).toContain("from '@/components/alliance/AllianceLead.client'");
        expect(src).toMatch(/<AllianceLead[^>]*kind="partner"/s);
    });
    it('hydrates the form with client:load', () => {
        expect(src).toContain('client:load');
    });
    it('passes locale to the island', () => {
        expect(src).toContain('locale={locale}');
    });
    it('does NOT redirect unauthenticated visitors (public page)', () => {
        expect(src).not.toContain('if (!user)');
    });
    it('does NOT set prerender=true (must be SSR)', () => {
        expect(src).not.toContain('prerender = true');
    });
    it('uses the alliance-leads.partner.* namespace', () => {
        expect(src).toContain('alliance-leads.partner.title');
        expect(src).toContain('alliance-leads.partner.subtitle');
        expect(src).toContain('alliance-leads.partner.benefits');
    });
    it('renders a breadcrumb, BaseLayout and SEOHead', () => {
        expect(src).toContain('Breadcrumbs');
        expect(src).toContain('BaseLayout');
        expect(src).toContain('SEOHead');
    });
    it('uses CSS custom properties for spacing', () => {
        expect(src).toContain('var(--');
    });
});
