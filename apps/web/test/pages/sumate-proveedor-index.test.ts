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
    // An island has no access to Astro.locals, so the signed-in visitor has to
    // be handed down as a prop for the name/email prefill. Only name and email:
    // island props are serialized into the page source.
    it('forwards the signed-in visitor to the island for prefill', () => {
        expect(src).toContain('Astro.locals.user');
        expect(src).toContain('currentUser={currentUser}');
        expect(src).toContain('Astro.locals.user.name');
        expect(src).toContain('Astro.locals.user.email');
        expect(src).not.toContain('Astro.locals.user.id');
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
    // Regression: mounting `Breadcrumbs` is not the same as rendering one — it
    // drops the last item and emits nothing when only "Inicio" would remain.
    it('passes a parent level so the trail actually renders, unlinked', () => {
        expect(src).toContain('alliance-leads.breadcrumb.joinUs');
        expect(src).toMatch(/items=\{\[\s*\{[^}]*joinUs[^}]*\}\s*,\s*\{\s*label:\s*title\s*\}/s);
        expect(src).not.toMatch(/joinUs[^)]*\)\s*,\s*path:/s);
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
