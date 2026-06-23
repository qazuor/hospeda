/**
 * @file api-error-key-coverage.test.ts
 * @description CI guard: ensures every value of `ServiceErrorCode` has a
 * corresponding `common.apiError.<CODE>` translation in all three locales
 * (es, en, pt).
 *
 * When a new code is added to `ServiceErrorCode` without adding its i18n
 * keys, this test fails with a clear list of missing locale/key pairs so the
 * author knows exactly what to add.
 *
 * All tests follow the AAA (Arrange-Act-Assert) pattern.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { trans } from '../src/config';

/** The three locales that must have complete apiError coverage. */
const LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Returns the dot-notation key used in the `trans` flat map for a given
 * ServiceErrorCode value.
 *
 * @param code - A `ServiceErrorCode` enum value.
 * @returns Dot-notation key, e.g. `'common.apiError.NOT_FOUND'`.
 */
function apiErrorKey(code: string): string {
    return `common.apiError.${code}`;
}

describe('ServiceErrorCode i18n coverage guard', () => {
    // Arrange: collect all enum values once
    const allCodes = Object.values(ServiceErrorCode);

    it('should cover every ServiceErrorCode in all three locales (es, en, pt)', () => {
        // Arrange
        const missing: string[] = [];

        for (const code of allCodes) {
            const key = apiErrorKey(code);
            for (const locale of LOCALES) {
                const value = trans[locale]?.[key];
                if (typeof value !== 'string' || value.trim().length === 0) {
                    missing.push(`[${locale}] ${key}`);
                }
            }
        }

        // Assert — fail with a clear actionable message listing every gap
        expect(
            missing,
            [
                'Missing or empty apiError translations detected.',
                'For each entry below, add the key to the matching locale file',
                '(packages/i18n/src/locales/<locale>/common.json → apiError object):',
                ...missing.map((m) => `  • ${m}`)
            ].join('\n')
        ).toEqual([]);
    });

    // Individual locale tests for clearer CI output when only one locale fails

    it('should have all ServiceErrorCode keys in the ES (Spanish) locale', () => {
        // Arrange
        const missingEs = allCodes
            .map((code) => ({ code, key: apiErrorKey(code) }))
            .filter(({ key }) => {
                const value = trans.es?.[key];
                return typeof value !== 'string' || value.trim().length === 0;
            });

        // Assert
        expect(
            missingEs.map(({ key }) => key),
            'Missing Spanish (es) apiError keys — add them to packages/i18n/src/locales/es/common.json'
        ).toEqual([]);
    });

    it('should have all ServiceErrorCode keys in the EN (English) locale', () => {
        // Arrange
        const missingEn = allCodes
            .map((code) => ({ code, key: apiErrorKey(code) }))
            .filter(({ key }) => {
                const value = trans.en?.[key];
                return typeof value !== 'string' || value.trim().length === 0;
            });

        // Assert
        expect(
            missingEn.map(({ key }) => key),
            'Missing English (en) apiError keys — add them to packages/i18n/src/locales/en/common.json'
        ).toEqual([]);
    });

    it('should have all ServiceErrorCode keys in the PT (Portuguese) locale', () => {
        // Arrange
        const missingPt = allCodes
            .map((code) => ({ code, key: apiErrorKey(code) }))
            .filter(({ key }) => {
                const value = trans.pt?.[key];
                return typeof value !== 'string' || value.trim().length === 0;
            });

        // Assert
        expect(
            missingPt.map(({ key }) => key),
            'Missing Portuguese (pt) apiError keys — add them to packages/i18n/src/locales/pt/common.json'
        ).toEqual([]);
    });

    it('should return non-empty strings (no blank placeholders)', () => {
        // Arrange
        const blanks: string[] = [];

        for (const code of allCodes) {
            const key = apiErrorKey(code);
            for (const locale of LOCALES) {
                const value = trans[locale]?.[key];
                if (typeof value === 'string' && value.trim().length === 0) {
                    blanks.push(`[${locale}] ${key} = "" (empty string)`);
                }
            }
        }

        // Assert
        expect(
            blanks,
            'Blank apiError translations found — replace empty strings with real copy'
        ).toEqual([]);
    });
});
