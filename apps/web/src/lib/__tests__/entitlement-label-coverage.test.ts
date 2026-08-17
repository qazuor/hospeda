/**
 * @file entitlement-label-coverage.test.ts
 * @description Regression guard for H-49 — entitlement labels rendering in
 * English regardless of locale.
 *
 * `getEntitlementName()` (`@/lib/billing-i18n`) resolves
 * `billing.entitlement.<key>`, falling back to the English `name` field from
 * `packages/billing/src/config/entitlements.config.ts` when the key is
 * missing. That fallback is what shipped for 9 of the 39 `EntitlementKey`
 * values — `multi_property_management`, `consolidated_analytics`,
 * `centralized_booking`, `staff_management`, `can_use_collections`,
 * `vip_promotions_access`, `ai_support`, `ai_translate`, and
 * `ai_accommodation_import` had no `billing.entitlement.*` entry in ANY
 * locale, so `/es/` and `/pt/` pricing surfaces rendered the English label
 * verbatim. The failure is invisible by construction: `t()` never throws,
 * the fallback is well-formed English prose, and the existing
 * `check-locales` / key-coverage guards only audit that es/en/pt stay in
 * sync WITH EACH OTHER — they cannot see a key that is absent from all
 * three at once.
 *
 * This guard asks the one question those guards do not: does every
 * `EntitlementKey` enum value have a `billing.entitlement.<key>` translation
 * in es, en, AND pt? It is deliberately narrower than
 * `plan-copy-veracity.test.ts` (which asks whether FREE-FORM marketing prose
 * honestly claims entitlements plans grant) — this one only asks whether the
 * structured per-entitlement LABEL exists, for every locale, for every key.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EntitlementKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

/** Every value the `EntitlementKey` enum actually defines. */
const ALL_ENTITLEMENT_KEYS = Object.values(EntitlementKey) as readonly string[];

function readEntitlementLabels(locale: Locale): Record<string, string> {
    const raw = readFileSync(resolve(LOCALES_DIR, locale, 'billing.json'), 'utf8');
    const parsed = JSON.parse(raw) as { entitlement?: Record<string, string> };
    return parsed.entitlement ?? {};
}

describe('H-49 — every EntitlementKey has a billing.entitlement label in all locales', () => {
    it('reads a non-empty entitlement enum and a non-empty locale dictionary', () => {
        // A silent empty read looks exactly like "nothing missing". Guard the
        // instrument before trusting what it reports.
        expect(ALL_ENTITLEMENT_KEYS.length).toBeGreaterThan(30);
        for (const locale of LOCALES) {
            expect(Object.keys(readEntitlementLabels(locale)).length).toBeGreaterThan(20);
        }
    });

    it.each(
        LOCALES
    )('names a billing.entitlement.<key> label for every EntitlementKey (%s)', (locale) => {
        const labels = readEntitlementLabels(locale);
        const missing = ALL_ENTITLEMENT_KEYS.filter((key) => !(key in labels));

        expect(
            missing,
            `These EntitlementKey values have no billing.entitlement.<key> label in ` +
                `locales/${locale}/billing.json, so getEntitlementName() falls back to ` +
                `the English config name for EVERY locale (H-49):\n` +
                `${missing.map((key) => `  ${key}`).join('\n')}\n` +
                'Add a real translation under "entitlement" in ' +
                `packages/i18n/src/locales/${locale}/billing.json.`
        ).toEqual([]);
    });
});
