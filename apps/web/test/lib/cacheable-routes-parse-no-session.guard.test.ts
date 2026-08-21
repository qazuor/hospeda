/**
 * @file cacheable-routes-parse-no-session.guard.test.ts
 * @description Static guard for HOS-369 W1-2a: a route family that may be
 * edge-cached must not have its session parsed.
 *
 * ## Why this exists, and why it is not the page-level guard
 *
 * `cacheable-pages-are-session-blind.guard.test.ts` proves that no cacheable
 * PAGE reads the visitor. That is necessary and it is not sufficient, because a
 * page is not the whole response: every page renders inside `BaseLayout` →
 * `Header` + `Footer`, and the shell reads the visitor too. Astro serializes
 * island props into the document, so `UserMenu`'s `initialUser` and
 * `NewsletterForm`'s `userEmail` are literal text in the HTML — a visitor's
 * name and e-mail, in the body, on a page destined for a shared cache.
 *
 * That gap survived Wave B0 precisely because the page guard could not see it:
 * it swept `src/pages` and `src/components`, and the shell lives in
 * `src/layouts`. Extending that guard to layouts would have been the obvious
 * move and it is the wrong one — the shell MUST read the visitor on
 * `/mi-cuenta` and `/auth`. The layouts are not the defect.
 *
 * The real invariant is upstream of all of it: `Astro.locals.user` is populated
 * only on the segments listed in `SESSION_OPTIONAL_SEGMENTS` (plus the
 * protected/auth ones). Keep a cacheable family off that list and every
 * consumer — the shell, any future component, one nobody has written yet —
 * gets `null` by construction. So this guard checks a SET INTERSECTION rather
 * than source text, which means it cannot be defeated by a spelling
 * (`Astro.locals.user`, `const { user } = Astro.locals`, or the aliased
 * `const locals = Astro.locals as …` that hid the `Footer` read for a whole
 * wave).
 *
 * ## What this guard does NOT cover
 *
 * - **Whether a family SHOULD be cacheable.** {@link CACHEABLE_ROUTE_FAMILIES}
 *   is maintained by hand. Adding a Cache Rule for a path that is not listed
 *   here is invisible to this test.
 * - **The Cloudflare side.** Cache eligibility and the session-cookie bypass
 *   live in a Cache Rule, not in this repo.
 * - **Non-segment session reads.** A page that resolves the session itself from
 *   the cookie (as `suscriptores/checkout` does) bypasses this mechanism
 *   entirely; the page guard's `cookieHeader` detector is what catches those.
 */

import { describe, expect, it } from 'vitest';

import { AUTH_SEGMENTS, PROTECTED_SEGMENTS, SESSION_OPTIONAL_SEGMENTS } from '@/lib/routes';

/**
 * Route families whose HTML is meant to be shared from the edge cache.
 *
 * These are the public catalog families Wave B0 de-personalized. Each entry is
 * the second path segment, i.e. `/{locale}/{segment}/…`, matching how
 * `SESSION_OPTIONAL_SEGMENTS` is compared.
 */
const CACHEABLE_ROUTE_FAMILIES: ReadonlyArray<string> = [
    'alojamientos',
    'destinos',
    'eventos',
    'publicaciones',
    'gastronomia',
    'experiencias',
    // HOS-690: the two commerce vertical landings lost the CommerceLead form
    // (and with it the only reason either page read the session), so both
    // moved off `SESSION_OPTIONAL_SEGMENTS` and onto this list.
    'publicar-restaurante',
    'publicar-experiencia'
];

describe('HOS-369 W1-2a — cacheable route families parse no session', () => {
    it('has families to check at all', () => {
        // Non-vacuity: an empty list would satisfy every assertion below.
        expect(CACHEABLE_ROUTE_FAMILIES.length).toBeGreaterThan(3);
    });

    it('no cacheable family is session-optional', () => {
        const violations = CACHEABLE_ROUTE_FAMILIES.filter((family) =>
            (SESSION_OPTIONAL_SEGMENTS as ReadonlyArray<string>).includes(family)
        );

        expect(violations).toEqual([]);
    });

    it('no cacheable family is protected or part of the auth flow', () => {
        // Both of those also parse the session, by a different code path.
        const gated = [
            ...(PROTECTED_SEGMENTS as ReadonlyArray<string>),
            ...(AUTH_SEGMENTS as ReadonlyArray<string>)
        ];
        const violations = CACHEABLE_ROUTE_FAMILIES.filter((family) => gated.includes(family));

        expect(violations).toEqual([]);
    });

    it('the segments that DO stay session-optional are all non-cacheable', () => {
        // The other direction, so the list cannot be emptied to pass. Each
        // remaining entry needs a reason it is exempt from caching.
        const reasons: Readonly<Record<string, string>> = {
            feedback: 'A report is attributed to its author.',
            guest: 'The guest area is per-visitor by definition.',
            publicar: 'The host onboarding funnel branches on having an account.'
        };

        for (const segment of SESSION_OPTIONAL_SEGMENTS) {
            expect(
                reasons[segment],
                `${segment} is session-optional with no recorded reason — if it is now a ` +
                    'cacheable family it must be removed from the list, not documented here'
            ).toBeDefined();
        }
    });

    it('fails when a cacheable family is added back', () => {
        // Reversion check: the guard is only worth anything if it reports the
        // exact regression it exists to prevent.
        const regressed = [...SESSION_OPTIONAL_SEGMENTS, 'alojamientos'];
        const violations = CACHEABLE_ROUTE_FAMILIES.filter((family) => regressed.includes(family));

        expect(violations).toEqual(['alojamientos']);
    });
});
