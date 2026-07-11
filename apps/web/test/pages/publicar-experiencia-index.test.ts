/**
 * @file publicar-experiencia-index.test.ts
 * @description Source-read tests for the public "Publicá tu experiencia" lead
 * form page (HOS-134).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicar-experiencia/index.astro'),
    'utf8'
);

describe('publicar-experiencia/index.astro', () => {
    it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
        expect(src).toContain('Astro.locals.locale');
        expect(src).not.toContain('Astro.params.lang');
    });
    it('uses createTranslations for i18n', () => {
        expect(src).toContain('createTranslations(locale)');
    });
    it('mounts the CommerceLead island, not a PlanSelector', () => {
        expect(src).toContain("from '@/components/gastronomy/CommerceLead.client'");
        expect(src).toContain('CommerceLead');
        expect(src).not.toContain('PlanSelector');
    });
    it('hydrates the form with client:load', () => {
        expect(src).toContain('client:load');
    });
    it('passes locale, destinations, and domain="experience" to the island', () => {
        expect(src).toContain('locale={locale}');
        expect(src).toContain('destinations={destinations}');
        expect(src).toContain('domain="experience"');
    });
    it('does NOT redirect unauthenticated visitors (public page)', () => {
        expect(src).not.toContain('if (!user)');
    });
    it('SSR-fetches city destinations and degrades to empty on failure', () => {
        expect(src).toContain('destinationsApi.list');
        expect(src).toContain("destinationType: 'CITY'");
        expect(src).toContain('destinationsResult.ok');
    });
    it('does NOT set prerender=true (must be SSR)', () => {
        expect(src).not.toContain('prerender = true');
    });
    it('uses the commerce.lead.experience.* namespace (not commerce.plans.*)', () => {
        expect(src).toContain('commerce.lead.experience.title');
        expect(src).toContain('commerce.lead.experience.subtitle');
        expect(src).not.toContain('commerce.plans');
    });
    it('is indexable (noindex explicitly false, like publicar-restaurante)', () => {
        expect(src).toContain('noindex={false}');
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
