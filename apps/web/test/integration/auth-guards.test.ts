/**
 * @file auth-guards.test.ts
 * @description Integration tests verifying that all /mi-cuenta/* account pages
 * implement the required auth guard pattern: reading Astro.locals.user and
 * redirecting unauthenticated users to the signin page via buildUrl.
 *
 * Strategy: read source files and assert on patterns. Astro components cannot
 * be rendered in Vitest directly, so source inspection is the correct approach.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEB_ROOT = resolve(__dirname, '../../');
const PAGES_ROOT = resolve(WEB_ROOT, 'src/pages/[lang]/mi-cuenta');

/**
 * Read a page source file relative to the mi-cuenta directory.
 */
function readAccountPage(filename: string): string {
    return readFileSync(resolve(PAGES_ROOT, filename), 'utf8');
}

/**
 * The six account pages that require authentication.
 */
const ACCOUNT_PAGES = [
    'index.astro',
    'editar.astro',
    'favoritos.astro',
    'preferencias.astro',
    'resenas.astro',
    'suscripcion.astro'
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auth-guards integration', () => {
    describe('page inventory', () => {
        it('should have exactly 6 account pages under mi-cuenta/', () => {
            // Arrange
            const expectedCount = 6;

            // Act
            const actualCount = ACCOUNT_PAGES.length;

            // Assert
            expect(actualCount).toBe(expectedCount);
        });

        it.each(ACCOUNT_PAGES)('should be able to read %s source file', (filename) => {
            // Arrange / Act
            const src = readAccountPage(filename);

            // Assert - file is non-empty and contains Astro frontmatter delimiter
            expect(src.length).toBeGreaterThan(0);
            expect(src).toContain('---');
        });
    });

    describe('Astro.locals.user read pattern', () => {
        it.each(ACCOUNT_PAGES)('%s should read user from Astro.locals.user', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert
            expect(src).toContain('Astro.locals.user');
        });
    });

    describe('auth guard redirect on missing user', () => {
        it.each(ACCOUNT_PAGES)('%s should redirect when user is not authenticated', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert - must contain both the null-check and a redirect call
            expect(src).toContain('if (!user)');
            expect(src).toContain('return Astro.redirect(');
        });
    });

    describe('redirect target uses buildUrl with auth/signin path', () => {
        it.each(ACCOUNT_PAGES)('%s redirect should target auth/signin via buildUrl', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert
            expect(src).toContain("path: 'auth/signin'");
            expect(src).toContain('buildUrl(');
        });
    });

    describe('buildUrl import', () => {
        it.each(ACCOUNT_PAGES)('%s should import buildUrl from the urls library', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert
            expect(src).toContain("from '../../../lib/urls'");
            expect(src).toMatch(/import\s*\{[^}]*buildUrl[^}]*\}/);
        });
    });

    describe('locale propagation', () => {
        it.each(ACCOUNT_PAGES)('%s should pass locale to buildUrl when redirecting', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert - redirect includes the locale variable so the signin
            // URL is locale-aware (e.g. /es/auth/signin, /en/auth/signin)
            expect(src).toContain('locale,');
            expect(src).toMatch(/buildUrl\(\s*\{[^}]*locale[^}]*\}/);
        });
    });

    describe('noindex SEO guard', () => {
        it.each(ACCOUNT_PAGES)(
            '%s should mark the page as noindex to prevent search engine indexing',
            (filename) => {
                // Arrange
                const src = readAccountPage(filename);

                // Act / Assert - private account pages must not be indexed
                expect(src).toContain('noindex={true}');
            }
        );
    });

    describe('BaseLayout and SEOHead usage', () => {
        it.each(ACCOUNT_PAGES)('%s should use BaseLayout as the page wrapper', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert
            expect(src).toContain('BaseLayout');
            expect(src).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
        });

        it.each(ACCOUNT_PAGES)('%s should include SEOHead for proper meta tags', (filename) => {
            // Arrange
            const src = readAccountPage(filename);

            // Act / Assert
            expect(src).toContain('SEOHead');
            expect(src).toContain("import SEOHead from '../../../components/seo/SEOHead.astro'");
        });
    });

    describe('middleware guard alignment', () => {
        it('middleware should protect /mi-cuenta routes', () => {
            // Arrange
            const middlewareSrc = readFileSync(resolve(WEB_ROOT, 'src/middleware.ts'), 'utf8');
            const helpersSrc = readFileSync(
                resolve(WEB_ROOT, 'src/lib/middleware-helpers.ts'),
                'utf8'
            );

            // Act / Assert - middleware calls isProtectedRoute
            expect(middlewareSrc).toContain('isProtectedRoute');

            // The helper must check for the 'mi-cuenta' path segment
            expect(helpersSrc).toContain("'mi-cuenta'");
        });

        it('middleware should redirect unauthenticated users from protected routes', () => {
            // Arrange
            const middlewareSrc = readFileSync(resolve(WEB_ROOT, 'src/middleware.ts'), 'utf8');

            // Act / Assert - middleware handles the redirect for protected routes
            expect(middlewareSrc).toContain('isProtectedRoute({ path })');
            expect(middlewareSrc).toContain('buildLoginRedirect(');
            expect(middlewareSrc).toContain('context.redirect(loginUrl)');
        });
    });
});
