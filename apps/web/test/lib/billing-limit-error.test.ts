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
 * HOS-723 — the at-limit toast leads with the add-on that raises THIS limit,
 * and offers one only when it exists.
 *
 * ## What "primary" means here, and why it is asserted directly
 *
 * The payload's two fields map onto the toast's `action` / `secondaryAction`,
 * and `action` IS the primary slot — it gets the filled pill and, since
 * HOS-723, renders first. So "the add-on is primary" is not a styling opinion
 * to eyeball: it is the assertion `payload.action.href` points at the add-on
 * while `payload.secondaryAction.href` points at the subscription page. Both
 * halves are needed. Asserting only that the add-on appears somewhere passed
 * just as well when it sat in the secondary slot, which is the exact state this
 * change moved away from.
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

/** Where the plan upgrade always points, whichever slot it occupies. */
const PLAN_HREF_ES = '/es/mi-cuenta/suscripcion/';

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

describe('HOS-723 — the at-limit CTA leads with the add-on that raises that limit', () => {
    for (const { limitKey, slug } of ADDON_LIMIT_EXPECTATIONS) {
        it(`makes ${slug} the PRIMARY action when ${limitKey} is reached`, () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey),
                locale: 'es'
            });

            // The add-on occupies the primary slot. Full href: the focus query
            // param AND the fragment, both of which decide whether the user
            // lands on the right card or on a catalog they have to search.
            expect(payload.action.href).toBe(`/es/mi-cuenta/addons/?focus=${slug}#addon-${slug}`);

            // The label is real translated copy, not the hardcoded fallback.
            const expectedLabel = createT('es')(
                'account.subscription.usage.buyAddon',
                '__MISSING__'
            );
            expect(expectedLabel).not.toBe('__MISSING__');
            expect(payload.action.label).toBe(expectedLabel);

            // The plan upgrade is DEMOTED, not dropped — still reachable, one
            // step down. Without this half the inversion could silently become
            // "replace the plan with the add-on".
            expect(payload.secondaryAction).toBeDefined();
            expect(payload.secondaryAction?.href).toBe(PLAN_HREF_ES);
            expect(payload.secondaryAction?.label.length).toBeGreaterThan(0);

            // And the two are genuinely different destinations, so a helper that
            // returned the same action twice could not pass.
            expect(payload.action.href).not.toBe(payload.secondaryAction?.href);
        });
    }

    for (const limitKey of NO_ADDON_LIMIT_KEYS) {
        it(`keeps the plan PRIMARY and only for ${limitKey}, which no add-on raises`, () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey),
                locale: 'es'
            });

            // The plan keeps the primary slot, exactly as before HOS-723.
            expect(payload.action.href).toBe(PLAN_HREF_ES);
            // A false promise is worse than no offer: there is no add-on card
            // for this limit, so pointing at the add-ons page sends the user
            // hunting for something that does not exist.
            expect(payload.secondaryAction).toBeUndefined();
        });
    }

    it('keeps the plan primary and only, for an unknown limit key', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: detailsFor('max_definitely_not_a_real_key'),
            locale: 'es'
        });

        expect(payload.action.href).toBe(PLAN_HREF_ES);
        expect(payload.secondaryAction).toBeUndefined();
    });

    it('keeps the plan primary and only, when the error body carries no details', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: undefined,
            locale: 'es'
        });

        expect(payload.action.href).toBe(PLAN_HREF_ES);
        expect(payload.secondaryAction).toBeUndefined();
    });

    it('builds the add-on link inside the active locale, not a hardcoded /es/', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: detailsFor('max_accommodations'),
            locale: 'en'
        });

        expect(payload.action.href).toBe(
            '/en/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5'
        );
        expect(payload.secondaryAction?.href).toBe('/en/mi-cuenta/suscripcion/');
    });

    it('the plan upgrade is reachable for EVERY known limit, in one slot or the other', () => {
        for (const limitKey of KNOWN_LIMIT_KEYS) {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey as string),
                locale: 'es'
            });

            const planHrefs = [payload.action.href, payload.secondaryAction?.href];

            // Invariant 1 of the payload contract: a limit toast is never a
            // dead end. Demoting the plan must never become dropping it.
            expect(planHrefs).toContain(PLAN_HREF_ES);
        }
    });

    it('exactly these four limits lead with an add-on, and no others', () => {
        const addonLed = [...KNOWN_LIMIT_KEYS].filter((limitKey) =>
            buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey as string),
                locale: 'es'
            }).action.href.includes('/mi-cuenta/addons/')
        );

        // Frozen on purpose: a fifth purchasable add-on is a product decision
        // that must be made here deliberately, not inherited from a table edit.
        expect(addonLed.sort()).toEqual(
            ADDON_LIMIT_EXPECTATIONS.map((entry) => entry.limitKey as string).sort()
        );
    });
});

/**
 * HOS-754 — the at-limit toast `message` field must resolve the CLDR
 * `message_one`/`message_other` copy that 8 of the 19 known limits carry,
 * instead of always rendering the hardcoded generic fallback string.
 *
 * ## Root cause this covers
 *
 * `buildFromDetails` used to resolve a flat `billing.limit.<key>.message` key.
 * None of the 19 known limits has a flat `.message` entry — the 8 "complete"
 * ones only have `message_one`/`message_other` (CLDR plural), and the other
 * 11 have no message entry at all. So the flat lookup NEVER matched, for any
 * limit, and `message` always fell through to the hardcoded generic string
 * regardless of `limitKey`.
 *
 * ## Why the expected strings are hand-written, not derived
 *
 * Per the repo's i18n-guard trap: asserting "the key resolves to something
 * non-generic" or spreading a module constant into the expectation is blind
 * to the actual copy — a broken interpolation or a wrong plural branch would
 * still pass. The strings below are copied verbatim from
 * `packages/i18n/src/locales/{es,en,pt}/billing.json` with the interpolation
 * already applied by hand, so a regression in either the resolution logic or
 * the JSON content fails this test.
 */
describe('HOS-754 — limit toast message uses the CLDR plural entry, not the generic fallback', () => {
    describe('a complete limit (max_favorites) resolves its own singular/plural message', () => {
        it('renders the singular (maxAllowed = 1) message in es', () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 1,
                    maxAllowed: 1,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                },
                locale: 'es'
            });

            expect(payload.message).toBe(
                'Ya guardaste 1 de 1 favorito en tu plan. Actualizalo para guardar más.'
            );
        });

        it('renders the plural (maxAllowed = 3) message in es', () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 3,
                    maxAllowed: 3,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                },
                locale: 'es'
            });

            expect(payload.message).toBe(
                'Ya guardaste 3 de 3 favoritos en tu plan. Actualizalo para guardar más.'
            );
        });

        it('renders the singular (maxAllowed = 1) message in en', () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 1,
                    maxAllowed: 1,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                },
                locale: 'en'
            });

            expect(payload.message).toBe(
                "You've saved 1 of 1 favorite in your plan. Upgrade to save more."
            );
        });

        it('renders the plural (maxAllowed = 3) message in en', () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 3,
                    maxAllowed: 3,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                },
                locale: 'en'
            });

            expect(payload.message).toBe(
                "You've saved 3 of 3 favorites in your plan. Upgrade to save more."
            );
        });

        it('renders the singular (maxAllowed = 1) message in pt', () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 1,
                    maxAllowed: 1,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                },
                locale: 'pt'
            });

            expect(payload.message).toBe(
                'Você já salvou 1 de 1 favorito no seu plano. Faça um upgrade para salvar mais.'
            );
        });

        it('renders the plural (maxAllowed = 3) message in pt', () => {
            const payload = buildLimitReachedPayloadFromDetails({
                details: {
                    limitKey: 'max_favorites',
                    currentCount: 3,
                    maxAllowed: 3,
                    usagePercent: 100,
                    upgradeAudience: 'tourist'
                },
                locale: 'pt'
            });

            expect(payload.message).toBe(
                'Você já salvou 3 de 3 favoritos no seu plano. Faça um upgrade para salvar mais.'
            );
        });
    });

    it('a partial limit (max_active_alerts, title-only) still falls back to the generic message', () => {
        // max_active_alerts is one of the 11 KNOWN_LIMIT_KEYS with ONLY a
        // `.title` entry — no `.message`/`.message_one`/`.message_other` in
        // any locale. This must keep degrading cleanly to the generic
        // message, not throw and not render a raw i18n key.
        const payload = buildLimitReachedPayloadFromDetails({
            details: {
                limitKey: 'max_active_alerts',
                currentCount: 3,
                maxAllowed: 3,
                usagePercent: 100,
                upgradeAudience: 'tourist'
            },
            locale: 'es'
        });

        expect(payload.message).toBe(
            'Alcanzaste el límite de tu plan. Actualizalo para continuar.'
        );
    });
});
