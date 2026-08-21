/**
 * @file billing-limit-error.test.ts
 * @description HOS-690 AC-24 — touching the gastronomy (or experience) limit
 * shows its own copy, not the generic fallback, in all three locales.
 *
 * ## Why this is real evidence, not the HOS-700 trap
 *
 * HOS-700's own incident report documents that the pre-existing limit/gate
 * tests mount a HAND-ROLLED `app.onError` that forwards `error.details`
 * unconditionally — so those suites stayed green through the entire bug where
 * production `handleRouteError` stripped `details` and every limit rendered
 * the same generic toast. That trap is on the API side (verified separately
 * by `apps/api/test/route-factory/error-details-scope.test.ts`, which DOES go
 * through the real `createSimpleRoute` route factory).
 *
 * On the web side, once `details.limitKey` reaches the client, what matters
 * is exactly the two facts AC-23's guard already enforces structurally:
 *
 *   1. `'max_gastronomies'` / `'max_experiences'` are in `KNOWN_LIMIT_KEYS` —
 *      otherwise `buildFromDetails` substitutes `'generic'` before `t()` is
 *      ever called, and no locale file would matter.
 *   2. `billing.limit.<key>.title` resolves to real, non-generic copy in
 *      es/en/pt — verified here by calling the REAL `createT` against the
 *      REAL locale files (no mocked translator, no hand-rolled fallback map),
 *      so a regression in either the allowlist or the JSON is caught by this
 *      file rather than only by the structural guard.
 */

import { describe, expect, it } from 'vitest';
import { buildLimitReachedPayloadFromDetails, KNOWN_LIMIT_KEYS } from '@/lib/billing-limit-error';
import { createT, SUPPORTED_LOCALES } from '@/lib/i18n';

const GENERIC_TITLE_ES = 'Límite del plan alcanzado';

describe('HOS-690 AC-24 — gastronomy/experience limits render their own copy', () => {
    it('max_gastronomies and max_experiences are gated into KNOWN_LIMIT_KEYS', () => {
        expect(KNOWN_LIMIT_KEYS.has('max_gastronomies')).toBe(true);
        expect(KNOWN_LIMIT_KEYS.has('max_experiences')).toBe(true);
    });

    for (const limitKey of ['max_gastronomies', 'max_experiences'] as const) {
        for (const locale of SUPPORTED_LOCALES) {
            it(`resolves a non-generic title for ${limitKey} in ${locale}`, () => {
                const t = createT(locale);
                // Sanity: the real translator actually has a value for this key —
                // if the JSON were missing it, `t()` would fall through to the
                // fallback argument below and the "not generic" assertion would
                // pass vacuously. Comparing against the fallback rules that out.
                const resolvedDirectly = t(`billing.limit.${limitKey}.title`, '__MISSING__');
                expect(resolvedDirectly).not.toBe('__MISSING__');

                const payload = buildLimitReachedPayloadFromDetails({
                    details: {
                        limitKey,
                        currentCount: 1,
                        maxAllowed: 1,
                        usagePercent: 100,
                        upgradeAudience: 'host'
                    },
                    locale
                });

                expect(payload.title).toBe(resolvedDirectly);
                if (locale === 'es') {
                    expect(payload.title).not.toBe(GENERIC_TITLE_ES);
                }
            });
        }
    }

    it('an unknown limit key still falls back to generic (allowlist is not vacuous)', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: {
                limitKey: 'max_definitely_not_a_real_key',
                currentCount: 1,
                maxAllowed: 1,
                usagePercent: 100,
                upgradeAudience: 'host'
            },
            locale: 'es'
        });

        expect(payload.title).toBe(GENERIC_TITLE_ES);
    });
});

/**
 * HOS-723 — the at-limit toast offers the add-on that raises THIS limit, and
 * only when one exists.
 *
 * ## Why these assertions and not easier ones
 *
 * The fixture below spells the four slugs out by hand instead of iterating
 * `ADDON_SLUG_BY_LIMIT_KEY`. Deriving the expectation from the same table the
 * implementation reads makes the test agree with whatever that table says,
 * including a typo — it would still pass with `extra-accommodations-500`.
 *
 * Likewise the href is compared in full, not with `toContain('addons')`: the
 * whole point of routing through `buildAddonFocusUrl` (HOS-729) is the
 * `?focus=` parameter and the `#addon-` fragment, and a substring match on the
 * path is blind to losing either. Nothing here is mocked — the real `createT`,
 * the real locale JSON, the real URL builder — so a broken import surfaces as a
 * failure rather than as an `undefined` that silently satisfies a loose
 * assertion.
 */

/** The four limits an add-on raises today, with the slug each must offer. */
const ADDON_LIMIT_EXPECTATIONS = [
    { limitKey: 'max_accommodations', slug: 'extra-accommodations-5' },
    { limitKey: 'max_photos_per_accommodation', slug: 'extra-photos-20' },
    { limitKey: 'max_gastronomies', slug: 'extra-gastronomies-1' },
    { limitKey: 'max_experiences', slug: 'extra-experiences-1' }
] as const;

/**
 * Limits that must NOT be offered an add-on. Each is a real, live limit key —
 * a made-up key would only prove the unknown-key path, not that a genuine
 * limit with no purchasable add-on stays silent.
 */
const NO_ADDON_LIMIT_KEYS = [
    'max_favorites',
    'max_active_promotions',
    'max_staff_accounts',
    'max_collections',
    'max_ai_chat_per_month'
] as const;

/** A LIMIT_REACHED `details` payload sitting exactly at the cap. */
function detailsFor(limitKey: string) {
    return {
        limitKey,
        currentCount: 5,
        maxAllowed: 5,
        usagePercent: 100,
        upgradeAudience: 'host' as const
    };
}

describe('HOS-723 — the at-limit CTA offers the add-on that raises that limit', () => {
    for (const { limitKey, slug } of ADDON_LIMIT_EXPECTATIONS) {
        it(`offers ${slug} when ${limitKey} is reached`, () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey),
                locale: 'es'
            });

            expect(payload.addonAction).toBeDefined();
            // Full href: the focus query param AND the fragment, both of which
            // decide whether the user lands on the right card or on a catalog.
            expect(payload.addonAction?.href).toBe(
                `/es/mi-cuenta/addons/?focus=${slug}#addon-${slug}`
            );

            // The label is real translated copy, not the hardcoded fallback.
            const expectedLabel = createT('es')(
                'account.subscription.usage.buyAddon',
                '__MISSING__'
            );
            expect(expectedLabel).not.toBe('__MISSING__');
            expect(payload.addonAction?.label).toBe(expectedLabel);

            // The plan upgrade is NOT replaced — both ways out are offered.
            expect(payload.action.href).toBe('/es/mi-cuenta/suscripcion/');
            expect(payload.action.label.length).toBeGreaterThan(0);
        });
    }

    for (const limitKey of NO_ADDON_LIMIT_KEYS) {
        it(`offers NO add-on for ${limitKey}, which no add-on raises`, () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey),
                locale: 'es'
            });

            // A false promise is worse than no offer: there is no add-on card
            // for this limit, so pointing at the add-ons page sends the user
            // hunting for something that does not exist.
            expect(payload.addonAction).toBeUndefined();
            // The plan upgrade still stands — the toast is never a dead end.
            expect(payload.action.href).toBe('/es/mi-cuenta/suscripcion/');
        });
    }

    it('offers no add-on for an unknown limit key', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: detailsFor('max_definitely_not_a_real_key'),
            locale: 'es'
        });

        expect(payload.addonAction).toBeUndefined();
    });

    it('offers no add-on when the error body carries no details at all', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: undefined,
            locale: 'es'
        });

        expect(payload.addonAction).toBeUndefined();
        expect(payload.action.href).toBe('/es/mi-cuenta/suscripcion/');
    });

    it('builds the add-on link inside the active locale, not a hardcoded /es/', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: detailsFor('max_accommodations'),
            locale: 'en'
        });

        expect(payload.addonAction?.href).toBe(
            '/en/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5'
        );
    });

    it('exactly these four limits carry an add-on offer, and no others', () => {
        const offered = [...KNOWN_LIMIT_KEYS].filter(
            (limitKey) =>
                buildLimitReachedPayloadFromDetails({
                    details: detailsFor(limitKey as string),
                    locale: 'es'
                }).addonAction !== undefined
        );

        // Frozen on purpose: a fifth purchasable add-on is a product decision
        // that must be made here deliberately, not inherited from a table edit.
        expect(offered.sort()).toEqual(
            ADDON_LIMIT_EXPECTATIONS.map((entry) => entry.limitKey as string).sort()
        );
    });
});
