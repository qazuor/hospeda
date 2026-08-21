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
