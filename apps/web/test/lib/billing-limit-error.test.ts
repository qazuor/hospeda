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
 * HOS-723 → HOS-1637 — the at-limit toast carries the plan upgrade only.
 *
 * HOS-723 made the toast lead with an add-on offer for the four limits an
 * add-on raised, pointing at `/mi-cuenta/addons/?focus=…`. That page was
 * removed with the old billing (HOS-1637, AC:B13a:20), so every limit now gets
 * the single plan action, and no limit links to the removed page.
 */

/** Where the plan upgrade points. */
const PLAN_HREF_ES = '/es/mi-cuenta/suscripcion/';

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

describe('HOS-1637 — the at-limit CTA is the plan upgrade, never the removed add-on page', () => {
    it('points EVERY known limit at the plan upgrade', () => {
        // Non-vacuity: the allowlist is not empty.
        expect(KNOWN_LIMIT_KEYS.size).toBeGreaterThan(10);
        for (const limitKey of KNOWN_LIMIT_KEYS) {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey as string),
                locale: 'es'
            });

            expect(payload.action.href).toBe(PLAN_HREF_ES);
            expect(payload.action.label.length).toBeGreaterThan(0);
            expect(JSON.stringify(payload)).not.toContain('mi-cuenta/addons');
        }
    });

    it('does so for the four limits that used to lead with an add-on', () => {
        for (const limitKey of [
            'max_accommodations',
            'max_photos_per_accommodation',
            'max_gastronomies',
            'max_experiences'
        ]) {
            const payload = buildLimitReachedPayloadFromDetails({
                details: detailsFor(limitKey),
                locale: 'es'
            });

            expect(payload.action.href).toBe(PLAN_HREF_ES);
            expect(payload).not.toHaveProperty('secondaryAction');
        }
    });

    it('builds the plan link inside the active locale, not a hardcoded /es/', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: detailsFor('max_accommodations'),
            locale: 'en'
        });

        expect(payload.action.href).toBe('/en/mi-cuenta/suscripcion/');
    });

    it('keeps the plan action when the error body carries no details', () => {
        const payload = buildLimitReachedPayloadFromDetails({
            details: undefined,
            locale: 'es'
        });

        expect(payload.action.href).toBe(PLAN_HREF_ES);
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
