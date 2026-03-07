/**
 * @file account-sub-pages.test.ts
 * @description Source-content tests for all mi-cuenta sub-pages:
 * - editar.astro (ProfileEditForm island)
 * - favoritos.astro (UserFavoritesList island)
 * - preferencias.astro (PreferenceToggles island)
 * - suscripcion.astro (SubscriptionDashboard island)
 * - resenas.astro (UserReviewsList island)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editarSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/editar.astro'),
    'utf8'
);

const favoritosSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/favoritos.astro'),
    'utf8'
);

const preferenciasSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/preferencias.astro'),
    'utf8'
);

const suscripcionSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion.astro'),
    'utf8'
);

const resenasSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/resenas.astro'),
    'utf8'
);

// ---------------------------------------------------------------------------
// Shared assertions applied to every account sub-page
// ---------------------------------------------------------------------------

/**
 * Asserts common patterns that every protected account sub-page must satisfy.
 */
function describeSharedAccountPage(name: string, src: string): void {
    describe(`${name} — shared patterns`, () => {
        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(src).toContain('SEOHead');
        });

        it('sets noindex to prevent search engine indexing', () => {
            expect(src).toContain('noindex={true}');
        });

        it('reads user from Astro.locals.user', () => {
            expect(src).toContain('Astro.locals.user');
        });

        it('redirects to signin when user is absent', () => {
            expect(src).toContain("path: 'auth/signin'");
        });

        it('uses createT for i18n', () => {
            expect(src).toContain('createT');
        });

        it('renders Breadcrumb', () => {
            expect(src).toContain('Breadcrumb');
        });

        it('includes mi-cuenta path in breadcrumb', () => {
            expect(src).toContain("path: 'mi-cuenta'");
        });

        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });
    });
}

// ---------------------------------------------------------------------------
// editar.astro — ProfileEditForm island
// ---------------------------------------------------------------------------

describeSharedAccountPage('mi-cuenta/editar.astro', editarSrc);

describe('mi-cuenta/editar.astro — ProfileEditForm island', () => {
    it('imports ProfileEditForm from account components', () => {
        expect(editarSrc).toContain('ProfileEditForm');
        expect(editarSrc).toContain("from '../../../components/account/ProfileEditForm.client'");
    });

    it('hydrates ProfileEditForm with client:load', () => {
        expect(editarSrc).toContain('client:load');
    });

    it('passes userId to ProfileEditForm', () => {
        expect(editarSrc).toContain('userId={user.id}');
    });

    it('passes initialName to ProfileEditForm', () => {
        expect(editarSrc).toContain('initialName={user.name}');
    });

    it('passes email to ProfileEditForm', () => {
        expect(editarSrc).toContain('email={user.email}');
    });

    it('passes locale to ProfileEditForm', () => {
        expect(editarSrc).toContain('locale={locale}');
    });

    it('extracts initialBio from user profile with safe fallback', () => {
        expect(editarSrc).toContain('initialBio');
        expect(editarSrc).toContain("''");
    });

    it('includes mi-cuenta/editar path in breadcrumb', () => {
        expect(editarSrc).toContain("path: 'mi-cuenta/editar'");
    });
});

// ---------------------------------------------------------------------------
// favoritos.astro — UserFavoritesList island
// ---------------------------------------------------------------------------

describeSharedAccountPage('mi-cuenta/favoritos.astro', favoritosSrc);

describe('mi-cuenta/favoritos.astro — UserFavoritesList island', () => {
    it('imports UserFavoritesList from account components', () => {
        expect(favoritosSrc).toContain('UserFavoritesList');
        expect(favoritosSrc).toContain(
            "from '../../../components/account/UserFavoritesList.client'"
        );
    });

    it('hydrates UserFavoritesList with client:visible', () => {
        expect(favoritosSrc).toContain('client:visible');
    });

    it('passes locale to UserFavoritesList', () => {
        expect(favoritosSrc).toContain('locale={locale}');
    });

    it('renders h1 heading', () => {
        expect(favoritosSrc).toContain('<h1');
    });

    it('includes mi-cuenta/favoritos path in breadcrumb', () => {
        expect(favoritosSrc).toContain("path: 'mi-cuenta/favoritos'");
    });
});

// ---------------------------------------------------------------------------
// preferencias.astro — PreferenceToggles island
// ---------------------------------------------------------------------------

describeSharedAccountPage('mi-cuenta/preferencias.astro', preferenciasSrc);

describe('mi-cuenta/preferencias.astro — PreferenceToggles island', () => {
    it('imports PreferenceToggles from account components', () => {
        expect(preferenciasSrc).toContain('PreferenceToggles');
        expect(preferenciasSrc).toContain(
            "from '../../../components/account/PreferenceToggles.client'"
        );
    });

    it('hydrates PreferenceToggles with client:load', () => {
        expect(preferenciasSrc).toContain('client:load');
    });

    it('passes userId to PreferenceToggles', () => {
        expect(preferenciasSrc).toContain('userId={user.id}');
    });

    it('passes initialSettings to PreferenceToggles', () => {
        expect(preferenciasSrc).toContain('initialSettings={initialSettings}');
    });

    it('builds initialSettings with notification defaults', () => {
        expect(preferenciasSrc).toContain('initialSettings');
        expect(preferenciasSrc).toContain('notifications');
        expect(preferenciasSrc).toContain('allowEmails');
    });

    it('extracts darkMode setting from user settings', () => {
        expect(preferenciasSrc).toContain('darkMode');
    });

    it('extracts language setting with locale fallback', () => {
        expect(preferenciasSrc).toContain('language');
    });

    it('includes mi-cuenta/preferencias path in breadcrumb', () => {
        expect(preferenciasSrc).toContain("path: 'mi-cuenta/preferencias'");
    });
});

// ---------------------------------------------------------------------------
// suscripcion.astro — SubscriptionDashboard island
// ---------------------------------------------------------------------------

describeSharedAccountPage('mi-cuenta/suscripcion.astro', suscripcionSrc);

describe('mi-cuenta/suscripcion.astro — SubscriptionDashboard island', () => {
    it('imports SubscriptionDashboard from account components', () => {
        expect(suscripcionSrc).toContain('SubscriptionDashboard');
        expect(suscripcionSrc).toContain(
            "from '../../../components/account/SubscriptionDashboard.client'"
        );
    });

    it('hydrates SubscriptionDashboard with client:load', () => {
        expect(suscripcionSrc).toContain('client:load');
    });

    it('passes locale to SubscriptionDashboard', () => {
        expect(suscripcionSrc).toContain('locale={locale}');
    });

    it('renders h1 heading', () => {
        expect(suscripcionSrc).toContain('<h1');
    });

    it('includes mi-cuenta/suscripcion path in breadcrumb', () => {
        expect(suscripcionSrc).toContain("path: 'mi-cuenta/suscripcion'");
    });
});

// ---------------------------------------------------------------------------
// resenas.astro — UserReviewsList island
// ---------------------------------------------------------------------------

describeSharedAccountPage('mi-cuenta/resenas.astro', resenasSrc);

describe('mi-cuenta/resenas.astro — UserReviewsList island', () => {
    it('imports UserReviewsList from account components', () => {
        expect(resenasSrc).toContain('UserReviewsList');
        expect(resenasSrc).toContain("from '../../../components/account/UserReviewsList.client'");
    });

    it('hydrates UserReviewsList with client:visible', () => {
        expect(resenasSrc).toContain('client:visible');
    });

    it('passes locale to UserReviewsList', () => {
        expect(resenasSrc).toContain('locale={locale}');
    });

    it('renders h1 heading', () => {
        expect(resenasSrc).toContain('<h1');
    });

    it('includes mi-cuenta/resenas path in breadcrumb', () => {
        expect(resenasSrc).toContain("path: 'mi-cuenta/resenas'");
    });
});
