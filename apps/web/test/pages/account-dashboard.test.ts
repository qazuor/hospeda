/**
 * @file account-dashboard.test.ts
 * @description Source-content tests for mi-cuenta/index.astro.
 * Validates layout, auth guard, navigation cards linking to all sub-pages,
 * stat cards, i18n, and semantic token usage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/index.astro'),
    'utf8'
);

describe('mi-cuenta/index.astro — account dashboard', () => {
    describe('layout and SEO', () => {
        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(src).toContain('SEOHead');
        });

        it('sets noindex to prevent indexing of private pages', () => {
            expect(src).toContain('noindex={true}');
        });

        it('passes locale to BaseLayout', () => {
            expect(src).toContain('locale={locale}');
        });

        it('has canonical URL', () => {
            expect(src).toContain('canonicalUrl');
        });
    });

    describe('auth guard', () => {
        it('reads user from Astro.locals', () => {
            expect(src).toContain('Astro.locals.user');
        });

        it('redirects to signin when user is absent', () => {
            expect(src).toContain("path: 'auth/signin'");
        });
    });

    describe('imports and dependencies', () => {
        it('imports createT from i18n', () => {
            expect(src).toContain('createT');
        });

        it('imports buildUrl', () => {
            expect(src).toContain('buildUrl');
        });

        it('imports icons from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('UserIcon');
            expect(src).toContain('FavoriteIcon');
            expect(src).toContain('StarIcon');
            expect(src).toContain('CreditCardIcon');
            expect(src).toContain('SettingsIcon');
        });

        it('imports Breadcrumb', () => {
            expect(src).toContain('Breadcrumb');
        });
    });

    describe('user header', () => {
        it('generates initials from user name', () => {
            expect(src).toContain('initials');
            expect(src).toContain('.toUpperCase()');
        });

        it('renders user name in greeting', () => {
            expect(src).toContain('user.name');
        });

        it('renders user email', () => {
            expect(src).toContain('user.email');
        });
    });

    describe('navigation sidebar', () => {
        it('defines navItems array with links to all sub-pages', () => {
            expect(src).toContain('navItems');
        });

        it('links to edit profile sub-page', () => {
            expect(src).toContain("path: 'mi-cuenta/editar'");
        });

        it('links to favorites sub-page', () => {
            expect(src).toContain("path: 'mi-cuenta/favoritos'");
        });

        it('links to reviews sub-page', () => {
            expect(src).toContain("path: 'mi-cuenta/resenas'");
        });

        it('links to subscription sub-page', () => {
            expect(src).toContain("path: 'mi-cuenta/suscripcion'");
        });

        it('links to preferences sub-page', () => {
            expect(src).toContain("path: 'mi-cuenta/preferencias'");
        });

        it('renders nav with aria-label', () => {
            expect(src).toContain('aria-label="Navegación de cuenta"');
        });
    });

    describe('stat cards', () => {
        it('renders stat card with id stat-favorites', () => {
            expect(src).toContain('id="stat-favorites"');
        });

        it('renders stat card with id stat-reviews', () => {
            expect(src).toContain('id="stat-reviews"');
        });

        it('renders stat card with id stat-subscription', () => {
            expect(src).toContain('id="stat-subscription"');
        });

        it('uses aria-live="polite" on dynamic stat counters', () => {
            expect(src).toContain('aria-live="polite"');
        });
    });

    describe('client-side stats loading', () => {
        it('includes a <script> for client-side stat loading', () => {
            expect(src).toContain('<script>');
        });

        it('fetches from /api/v1/protected endpoint', () => {
            expect(src).toContain('/api/v1/protected');
        });

        it('uses credentials: include for auth cookie forwarding', () => {
            expect(src).toContain("credentials: 'include'");
        });

        it('imports getApiUrl from env lib', () => {
            expect(src).toContain('getApiUrl');
        });
    });

    describe('navigation cards grid', () => {
        it('renders sections area with aria-label', () => {
            expect(src).toContain('aria-label="Secciones de cuenta"');
        });

        it('renders navItems in the cards grid too', () => {
            const cardGridMatches = (src.match(/navItems\.map/g) ?? []).length;
            expect(cardGridMatches).toBeGreaterThanOrEqual(2);
        });
    });

    describe('semantic tokens — no hardcoded colors', () => {
        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('uses semantic token bg-card', () => {
            expect(src).toContain('bg-card');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });

        it('uses semantic token border-border', () => {
            expect(src).toContain('border-border');
        });
    });

    describe('breadcrumb', () => {
        it('renders Breadcrumb component', () => {
            expect(src).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('includes mi-cuenta path in breadcrumb', () => {
            expect(src).toContain("path: 'mi-cuenta'");
        });
    });
});
