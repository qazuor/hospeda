/**
 * @file publicar.test.ts
 * @description Source-reading tests for the host-onboarding landing page. The
 * Astro page cannot be rendered in Vitest, so we assert on the source text to
 * lock in the existing-host SSR redirect. HOS-609 removed the `?from=admin`
 * eyebrow this page used to render for tourists bounced from the admin panel
 * (see `apps/web/test/pages/acceso-denegado.test.ts` for the page that
 * replaced it) — the coverage for that eyebrow was removed alongside it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/publicar/index.astro'), 'utf8');

describe('publicar/index.astro', () => {
    describe('existing-host redirect (marketing landing only)', () => {
        it('only runs the redirect check for authenticated users', () => {
            // The owned-count fetch is gated behind isAuthenticated so guests always
            // see the landing.
            const redirectIdx = src.indexOf('owned-accommodations fetch returned non-ok');
            const authGateIdx = src.lastIndexOf('if (isAuthenticated) {', redirectIdx);
            expect(authGateIdx).toBeGreaterThan(-1);
            expect(authGateIdx).toBeLessThan(redirectIdx);
        });

        it('fetches the owned-accommodation count via the pageSize=1 endpoint', () => {
            expect(src).toContain('/api/v1/protected/accommodations?page=1&pageSize=1');
            expect(src).toContain('data?.pagination?.total');
        });

        it('redirects to mi-cuenta/propiedades only when owned count > 0 (NOT by role)', () => {
            expect(src).toMatch(/total\s*>\s*0/);
            expect(src).toContain(
                "Astro.redirect(buildUrl({ locale, path: 'mi-cuenta/propiedades' }))"
            );
            // Criterion must be owned-count, not a role check.
            const redirectBlock = src.slice(
                src.indexOf('Redirect existing hosts'),
                src.indexOf("path: 'mi-cuenta/propiedades' }))") + 40
            );
            expect(redirectBlock).not.toContain('role ===');
        });

        // HOS-311: this redirect is exactly why `HostLandingCta`'s host branch
        // must NOT point at the properties list. Every authenticated actor with
        // >=1 owned accommodation is bounced there server-side, so the only
        // host who reaches the island's CTA has ZERO properties — an empty list
        // would be a dead click before the wizard.
        it('makes the properties list the SSR destination for a host who already has listings', () => {
            const redirectBlock = src.slice(
                src.indexOf('Redirect existing hosts'),
                src.indexOf('const isTrialExpired')
            );
            expect(redirectBlock).toMatch(/total\s*>\s*0/);
            expect(redirectBlock).toContain("path: 'mi-cuenta/propiedades' })");
        });

        // The island is `client:only="react"`, so there is NO server-rendered
        // markup and Better Auth's session always starts pending on this page —
        // which is what the component's own JSDoc documents. Pinned so the
        // directive and the doc cannot silently diverge again.
        it('hydrates the CTA island with client:only="react" (no SSR role hint)', () => {
            expect(src).toMatch(/<HostLandingCta\s+client:only="react"/);
        });

        it('wraps the fetch in try/catch so it is non-fatal (renders landing on error)', () => {
            const block = src.slice(
                src.indexOf('Redirect existing hosts'),
                src.indexOf('const isTrialExpired')
            );
            expect(block).toContain('try {');
            expect(block).toContain('catch (error)');
            expect(block).toContain('logger.warn');
        });
    });
});
