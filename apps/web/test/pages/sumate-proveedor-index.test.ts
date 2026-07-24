/**
 * @file sumate-proveedor-index.test.ts
 * @description Source-read tests for the public "Sumate como proveedor"
 * alliance-lead landing (HOS-277).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/sumate/proveedor/index.astro'),
    'utf8'
);

describe('sumate/proveedor/index.astro', () => {
    it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
        expect(src).toContain('Astro.locals.locale');
        expect(src).not.toContain('Astro.params.lang');
    });
    it('mounts the AllianceLead island with kind="service_provider"', () => {
        expect(src).toContain("from '@/components/alliance/AllianceLead.client'");
        expect(src).toMatch(/<AllianceLead[^>]*kind="service_provider"/s);
    });
    it('hydrates the form with client:load', () => {
        expect(src).toContain('client:load');
    });
    it('does NOT set prerender=true (must be SSR)', () => {
        expect(src).not.toContain('prerender = true');
    });
    it('uses the alliance-leads.serviceProvider.* namespace', () => {
        expect(src).toContain('alliance-leads.serviceProvider.title');
        expect(src).toContain('alliance-leads.serviceProvider.subtitle');
        expect(src).toContain('alliance-leads.serviceProvider.benefits');
    });
    it('renders a breadcrumb, BaseLayout and SEOHead', () => {
        expect(src).toContain('Breadcrumbs');
        expect(src).toContain('BaseLayout');
        expect(src).toContain('SEOHead');
    });
});
