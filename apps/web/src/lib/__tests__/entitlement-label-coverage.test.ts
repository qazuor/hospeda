/**
 * @file entitlement-label-coverage.test.ts
 * @description Regression guard for H-49: every catalog entitlement has a
 * localized label in each supported locale. `EntitlementKeyEnum` from
 * `@repo/schemas` enumerates the catalog keys; this test catches labels missing
 * from every locale, which parity checks cannot detect.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EntitlementKeyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

/** Every value the `EntitlementKeyEnum` enum actually defines. */
const ALL_ENTITLEMENT_KEYS = Object.values(EntitlementKeyEnum) as readonly string[];

function readEntitlementLabels(locale: Locale): Record<string, string> {
    const raw = readFileSync(resolve(LOCALES_DIR, locale, 'billing.json'), 'utf8');
    const parsed = JSON.parse(raw) as { entitlement?: Record<string, string> };
    return parsed.entitlement ?? {};
}

describe('H-49 — every EntitlementKeyEnum has a billing.entitlement label in all locales', () => {
    it('reads a non-empty entitlement enum and a non-empty locale dictionary', () => {
        // A silent empty read looks exactly like "nothing missing". Guard the
        // instrument before trusting what it reports.
        expect(ALL_ENTITLEMENT_KEYS.length).toBeGreaterThan(50);
        for (const locale of LOCALES) {
            expect(Object.keys(readEntitlementLabels(locale)).length).toBeGreaterThan(20);
        }
    });

    it.each(
        LOCALES
    )('names a billing.entitlement.<key> label for every EntitlementKeyEnum (%s)', (locale) => {
        const labels = readEntitlementLabels(locale);
        const missing = ALL_ENTITLEMENT_KEYS.filter((key) => !(key in labels));

        expect(
            missing,
            `These EntitlementKeyEnum values have no billing.entitlement.<key> label in ` +
                `locales/${locale}/billing.json, so getEntitlementName() falls back to ` +
                `the English config name for EVERY locale (H-49):\n` +
                `${missing.map((key) => `  ${key}`).join('\n')}\n` +
                'Add a real translation under "entitlement" in ' +
                `packages/i18n/src/locales/${locale}/billing.json.`
        ).toEqual([]);
    });
});

describe('TEST:1626:5 — catalog entitlement label coverage', () => {
    it('includes all five owner-approved D-3 keys in the enum instrument', () => {
        const d3Keys = [
            'partner_public_page',
            'partner_carousel_presence',
            'recover_own_listing',
            'subscribe_to_plan',
            'activate_trial'
        ];

        expect(d3Keys.filter((key) => !ALL_ENTITLEMENT_KEYS.includes(key))).toEqual([]);
    });
});
