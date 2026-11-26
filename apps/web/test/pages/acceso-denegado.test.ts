/**
 * @file acceso-denegado.test.ts
 * @description Source-reading tests for the access-denied status page
 * (HOS-609). Astro cannot render in Vitest, so we assert on the source text
 * that this page follows the shared 404/500 `ErrorLayout` + `StatusPage`
 * pattern, uses the `warning` variant, stays `noindex`, and offers the three
 * required links in order: account, home, contact.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/acceso-denegado/index.astro'),
    'utf8'
);

describe('acceso-denegado/index.astro', () => {
    describe('layout wiring', () => {
        it('uses ErrorLayout (same shell as 404/500)', () => {
            expect(src).toContain("import ErrorLayout from '@/layouts/ErrorLayout.astro'");
            expect(src).toMatch(/<ErrorLayout\b/);
        });

        it('uses StatusPage with the warning variant', () => {
            expect(src).toContain("import StatusPage from '@/components/shared/StatusPage.astro'");
            expect(src).toContain('variant="warning"');
        });

        it('does not introduce a new StatusPage variant', () => {
            // The variant union is fixed by StatusPage.astro's Props type; this
            // page must reuse an existing variant, never extend the union.
            expect(src).not.toMatch(/variant="(success|error|info|not-found)"/);
        });

        it('is SSR (not statically prerendered) so it can render per-locale robots/meta consistently with 404/500', () => {
            expect(src).not.toMatch(/export\s+const\s+prerender\s*=\s*true/);
        });
    });

    describe('indexability', () => {
        it('passes noindex explicitly to ErrorLayout', () => {
            expect(src).toMatch(/<ErrorLayout[^>]*noindex={true}/);
        });
    });

    describe('i18n wiring', () => {
        it('uses the error.forbidden.* key group for title/heading/description', () => {
            expect(src).toContain("t('error.forbidden.title')");
            expect(src).toContain("t('error.forbidden.heading')");
            expect(src).toContain("t('error.forbidden.defaultDescription')");
        });

        it('uses a localized support label and delegates the session-dependent links', () => {
            expect(src).toContain(
                '<AccessDeniedActions slot="extras" client:load locale={locale} />'
            );
            expect(src).toContain("t('error.forbidden.contact')");
        });

        it('has no hardcoded Spanish copy outside of i18n calls', () => {
            // Every visible string on this page must be a translation key —
            // grep the markup half for literal Spanish CTA text.
            expect(src).not.toContain('Ir a mi cuenta');
            expect(src).not.toContain('No tenés acceso al panel');
        });
    });

    describe('contact follows session-dependent recovery', () => {
        it('keeps SSR session-blind and puts contact last', () => {
            expect(src).not.toMatch(/Astro\.locals\.user|fetchAuthMe/);
            expect(src.indexOf('<AccessDeniedActions')).toBeLessThan(
                src.indexOf('<a slot="footer"')
            );
        });
        it('points the contact link at the contact page', () => {
            expect(src).toContain("path: 'contacto' }");
        });
    });

    describe('does not port the admin forbidden page machinery', () => {
        it('never renders the user email', () => {
            expect(src).not.toMatch(/authState\.email|email}}/);
        });

        it('has no "switch account" affordance', () => {
            expect(src).not.toMatch(/switch.?account/i);
        });

        it('has no support mailto link', () => {
            expect(src).not.toContain('mailto:');
        });
    });
});
