/**
 * Preserves the commerce label coverage guard while the tier catalogue is
 * rebuilt. The V2 catalogue must add a renderable-key comparison here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    COMMERCE_ENTITLEMENT_FALLBACK_LABEL,
    COMMERCE_ENTITLEMENT_I18N_SUFFIX
} from '../commerce/entitlement-labels';

// HOS-1352: transitional until V3 (HOS-1357), see PR — removed catalogue-to-commerce-label coverage guard.
const LOCALES = ['es', 'en', 'pt'] as const;
const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

describe('commerce entitlement labels (HOS-1178)', () => {
    it('has a fallback and a translated label for every mapped key', () => {
        const entries = Object.entries(COMMERCE_ENTITLEMENT_I18N_SUFFIX);
        expect(entries.length).toBeGreaterThan(3);
        for (const [key] of entries) {
            expect(COMMERCE_ENTITLEMENT_FALLBACK_LABEL[key], key).toBeTruthy();
        }
        for (const locale of LOCALES) {
            const json = JSON.parse(
                readFileSync(resolve(LOCALES_DIR, locale, 'commerce.json'), 'utf8')
            ) as { owner?: { entitlements?: Record<string, string> } };
            for (const [key, suffix] of entries) {
                expect(json.owner?.entitlements?.[suffix], `${locale}: ${key}`).toBeTruthy();
            }
        }
    });
});
