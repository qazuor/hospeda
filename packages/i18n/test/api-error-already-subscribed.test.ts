/**
 * @file api-error-already-subscribed.test.ts
 * @description HOS-1321: `common.apiError.ALREADY_SUBSCRIBED` is a REASON key,
 * not a `ServiceErrorCode` one, so `api-error-key-coverage.test.ts` — which
 * enumerates the enum — cannot see it. `/start-paid` answers a refused second
 * subscription with `code: 'ALREADY_EXISTS'` + `reason: 'ALREADY_SUBSCRIBED'`,
 * and `translateApiErrorWithT` prefers the reason. A locale that carries only
 * the code therefore silently shows "Ese recurso ya existe." to somebody who
 * needs to be told where their plan change lives.
 *
 * All tests follow the AAA (Arrange-Act-Assert) pattern.
 */

import { describe, expect, it } from 'vitest';
import { trans } from '../src/config';

/** The three locales every user-facing key must ship in. */
const LOCALES = ['es', 'en', 'pt'] as const;

const REASON_KEY = 'common.apiError.ALREADY_SUBSCRIBED';
const CODE_KEY = 'common.apiError.ALREADY_EXISTS';

describe('common.apiError.ALREADY_SUBSCRIBED (HOS-1321)', () => {
    it('ships in all three locales', () => {
        // Arrange
        const missing: string[] = [];

        // Act
        for (const locale of LOCALES) {
            const value = trans[locale]?.[REASON_KEY];
            if (typeof value !== 'string' || value.trim().length === 0) {
                missing.push(`[${locale}] ${REASON_KEY}`);
            }
        }

        // Assert
        expect(
            missing,
            [
                'Missing ALREADY_SUBSCRIBED reason translation.',
                'Add it to packages/i18n/src/locales/<locale>/common.json → apiError:',
                ...missing.map((m) => `  • ${m}`)
            ].join('\n')
        ).toEqual([]);
    });

    it('says something different from the generic ALREADY_EXISTS code copy', () => {
        // Arrange & Act & Assert — if the two were equal the reason key would
        // buy nothing: the refusal would still read as "Ese recurso ya existe."
        // and still tell the user nothing about what to do next.
        for (const locale of LOCALES) {
            expect(trans[locale]?.[REASON_KEY]).not.toBe(trans[locale]?.[CODE_KEY]);
        }
    });

    it('points the user at where the plan change actually lives', () => {
        // Arrange — the point of the key (issue item 2): the user must learn
        // what to DO, not just that something is already the case. Every
        // locale names the account subscription surface.
        const EXPECTED_LANDMARK: Record<(typeof LOCALES)[number], string> = {
            es: 'Suscripción',
            en: 'Subscription',
            pt: 'Assinatura'
        };

        // Act & Assert
        for (const locale of LOCALES) {
            expect(trans[locale]?.[REASON_KEY]).toContain(EXPECTED_LANDMARK[locale]);
        }
    });
});
