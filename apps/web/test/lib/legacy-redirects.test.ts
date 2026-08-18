/**
 * @file legacy-redirects.test.ts
 * @description Unit tests for the pure `resolveLegacyRedirectTarget` resolver
 * (H-110) — the single place that composes the web app's legacy URL aliases
 * (messages, blog, author, and the three facet-landing legacy-English-slug
 * redirects) into their fully-resolved final destination, so a chained link
 * (e.g. `/blog/categoria/gastronomy/`) resolves in ONE redirect instead of
 * two. `middleware.test.ts` covers the same behavior end-to-end through the
 * real `onRequest` handler; these tests exercise the pure resolver directly.
 */

import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS,
    EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS,
    POST_CATEGORY_LEGACY_ENGLISH_SLUGS
} from '../../src/lib/facet-slugs';
import { resolveLegacyRedirectTarget } from '../../src/lib/legacy-redirects';

describe('resolveLegacyRedirectTarget — no match', () => {
    it('returns undefined for an ordinary route', () => {
        expect(resolveLegacyRedirectTarget({ path: '/es/alojamientos/' })).toBeUndefined();
    });

    it('returns undefined for an already-canonical facet landing', () => {
        expect(
            resolveLegacyRedirectTarget({ path: '/es/alojamientos/tipo/cabana/' })
        ).toBeUndefined();
    });
});

describe('resolveLegacyRedirectTarget — messages alias (308)', () => {
    it('resolves the bare alias', () => {
        expect(resolveLegacyRedirectTarget({ path: '/es/mi-cuenta/messages/' })).toEqual({
            target: '/es/mi-cuenta/consultas/',
            status: 308
        });
    });

    it('preserves a deep conversation-id tail', () => {
        expect(resolveLegacyRedirectTarget({ path: '/en/mi-cuenta/messages/abc123/' })).toEqual({
            target: '/en/mi-cuenta/consultas/abc123/',
            status: 308
        });
    });
});

describe('resolveLegacyRedirectTarget — /blog alias (301), composed with post-category (H-110)', () => {
    it('resolves the bare alias with no composition (not a category path)', () => {
        expect(resolveLegacyRedirectTarget({ path: '/es/blog/' })).toEqual({
            target: '/es/publicaciones/',
            status: 301
        });
    });

    it('resolves a post detail link with no composition', () => {
        expect(resolveLegacyRedirectTarget({ path: '/es/blog/una-nota/' })).toEqual({
            target: '/es/publicaciones/una-nota/',
            status: 301
        });
    });

    it('composes with the post-category legacy-slug redirect in ONE resolved target', () => {
        expect(resolveLegacyRedirectTarget({ path: '/es/blog/categoria/gastronomy/' })).toEqual({
            target: '/es/publicaciones/categoria/gastronomia/',
            status: 301
        });
    });

    it.each(
        Object.entries(POST_CATEGORY_LEGACY_ENGLISH_SLUGS)
    )('composes every legacy post-category slug: /blog/categoria/%s/ -> /publicaciones/categoria/%s/', (englishSlug, spanishSlug) => {
        expect(resolveLegacyRedirectTarget({ path: `/pt/blog/categoria/${englishSlug}/` })).toEqual(
            {
                target: `/pt/publicaciones/categoria/${spanishSlug}/`,
                status: 301
            }
        );
    });

    it('does NOT rewrite the category segment when it is already the canonical Spanish slug (no self-redirect)', () => {
        expect(resolveLegacyRedirectTarget({ path: '/es/blog/categoria/gastronomia/' })).toEqual({
            target: '/es/publicaciones/categoria/gastronomia/',
            status: 301
        });
    });

    it('does NOT rewrite an unrecognized category segment (leaves it for the landing page 404)', () => {
        expect(
            resolveLegacyRedirectTarget({ path: '/es/blog/categoria/not-a-real-category/' })
        ).toEqual({
            target: '/es/publicaciones/categoria/not-a-real-category/',
            status: 301
        });
    });
});

describe('resolveLegacyRedirectTarget — publicaciones/autor alias (301)', () => {
    it('resolves a bare author slug', () => {
        expect(
            resolveLegacyRedirectTarget({ path: '/es/publicaciones/autor/carmen-silva/' })
        ).toEqual({
            target: '/es/autores/carmen-silva/',
            status: 301
        });
    });
});

describe('resolveLegacyRedirectTarget — facet-landing legacy-English-slug redirects (301 each)', () => {
    it.each(
        Object.entries(ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS)
    )('accommodation type: /alojamientos/tipo/%s/ -> /alojamientos/tipo/%s/', (englishSlug, spanishSlug) => {
        expect(
            resolveLegacyRedirectTarget({ path: `/es/alojamientos/tipo/${englishSlug}/` })
        ).toEqual({
            target: `/es/alojamientos/tipo/${spanishSlug}/`,
            status: 301
        });
    });

    it.each(
        Object.entries(EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS)
    )('event category: /eventos/categoria/%s/ -> /eventos/categoria/%s/', (englishSlug, spanishSlug) => {
        expect(
            resolveLegacyRedirectTarget({ path: `/es/eventos/categoria/${englishSlug}/` })
        ).toEqual({
            target: `/es/eventos/categoria/${spanishSlug}/`,
            status: 301
        });
    });

    it.each(
        Object.entries(POST_CATEGORY_LEGACY_ENGLISH_SLUGS)
    )('post category (direct, no /blog prefix): /publicaciones/categoria/%s/ -> /publicaciones/categoria/%s/', (englishSlug, spanishSlug) => {
        expect(
            resolveLegacyRedirectTarget({ path: `/es/publicaciones/categoria/${englishSlug}/` })
        ).toEqual({
            target: `/es/publicaciones/categoria/${spanishSlug}/`,
            status: 301
        });
    });

    it('preserves a /page/<n>/ tail alongside the slug rewrite', () => {
        expect(
            resolveLegacyRedirectTarget({ path: '/es/eventos/categoria/gastronomy/page/2/' })
        ).toEqual({
            target: '/es/eventos/categoria/gastronomia/page/2/',
            status: 301
        });
    });
});

describe('resolveLegacyRedirectTarget — never resolves a path to itself (loop safety)', () => {
    it('every canonical Spanish facet slug is a documented no-op, not (re-)matched by any legacy map', () => {
        for (const spanishSlug of Object.values(ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS)) {
            expect(
                resolveLegacyRedirectTarget({ path: `/es/alojamientos/tipo/${spanishSlug}/` })
            ).toBeUndefined();
        }
        for (const spanishSlug of Object.values(EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS)) {
            expect(
                resolveLegacyRedirectTarget({ path: `/es/eventos/categoria/${spanishSlug}/` })
            ).toBeUndefined();
        }
        for (const spanishSlug of Object.values(POST_CATEGORY_LEGACY_ENGLISH_SLUGS)) {
            expect(
                resolveLegacyRedirectTarget({ path: `/es/publicaciones/categoria/${spanishSlug}/` })
            ).toBeUndefined();
        }
    });
});
