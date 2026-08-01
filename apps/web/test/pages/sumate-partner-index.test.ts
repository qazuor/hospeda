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
    // An island has no access to Astro.locals, so the signed-in visitor has to
    // be handed down as a prop for the name/email prefill.
    it('forwards the signed-in visitor to the island for prefill', () => {
        expect(src).toContain('Astro.locals.user');
        expect(src).toContain('currentUser={currentUser}');
    });
    // Island props are serialized into the page source; only the two fields the
    // form actually seeds belong there.
    it('forwards only name and email, never the user id', () => {
        expect(src).toContain('Astro.locals.user.name');
        expect(src).toContain('Astro.locals.user.email');
        expect(src).not.toContain('Astro.locals.user.id');
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
    // Regression: mounting `Breadcrumbs` is not the same as rendering one.
    // `buildBreadcrumbTrail` drops the last item (this page's own <h1>) and
    // returns an empty trail when only "Inicio" would remain, so passing just
    // the page title emitted zero HTML. The parent level is what makes it real.
    it('passes a parent level so the trail actually renders', () => {
        expect(src).toContain('alliance-leads.breadcrumb.joinUs');
        expect(src).toMatch(/items=\{\[\s*\{[^}]*joinUs[^}]*\}\s*,\s*\{\s*label:\s*title\s*\}/s);
    });
    // There is no /sumate/ index page: linking this level would 404.
    it('does not link the Sumate level to a page that does not exist', () => {
        expect(src).not.toMatch(/joinUs[^)]*\)\s*,\s*path:/s);
    });
    it('wraps the breadcrumb in a container (the component brings none)', () => {
        expect(src).toContain('class="sumate__breadcrumbs"');
        expect(src).toMatch(/\.sumate__breadcrumbs\s*\{[^}]*max-width/s);
    });
    // Regression: at --space-section (120px) top and bottom, plus another
    // 120px above the form section, the form started below the fold on a
    // 1366x800 screen.
    it('does not pad the hero and form sections with the full --space-section', () => {
        expect(src).not.toContain('padding-block: var(--space-section, 120px)');
    });
    it('uses CSS custom properties for spacing', () => {
        expect(src).toContain('var(--');
    });
});
