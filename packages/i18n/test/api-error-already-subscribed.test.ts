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

    it('offers the escape that works when the plan change cannot help', () => {
        // Arrange — HOS-1321 review. The first draft said «usá "Cambiar plan"»,
        // which is a promise the surface does not always keep: a `tourist-vip`
        // holder who clicked a HOST plan is sent to their tourist tab, whose
        // plan change offers tourist tiers ONLY (owner ruling, 2026-09-10). The
        // instruction was true for a host switching host tiers and false for
        // exactly the audience this key exists for.
        //
        // A copy that instructs an action is a verifiable promise, so it now
        // names the escape that is always available and does reach a different
        // audience: cancelling. Asserted per locale, because a translation that
        // drops the clause quietly restores the dead end.
        const EXPECTED_ESCAPE: Record<(typeof LOCALES)[number], RegExp> = {
            es: /darla de baja/i,
            en: /cancel it/i,
            pt: /cancel[aá]-la/i
        };

        // Act & Assert
        for (const locale of LOCALES) {
            expect(trans[locale]?.[REASON_KEY]).toMatch(EXPECTED_ESCAPE[locale]);
        }
    });

    it('does not quote a button label that is not always rendered', () => {
        // Arrange & Act & Assert — the specific regression: naming the
        // «Cambiar plan» / "Change plan" control as a quoted string promises a
        // button the reader may not find. Describing where to go survives a
        // relabelled button; quoting one does not.
        for (const locale of LOCALES) {
            expect(trans[locale]?.[REASON_KEY]).not.toMatch(/[«"“][^»"”]*[Cc]ambiar plan/);
            expect(trans[locale]?.[REASON_KEY]).not.toMatch(/[«"“][^»"”]*[Cc]hange plan/);
            expect(trans[locale]?.[REASON_KEY]).not.toMatch(/[«"“][^»"”]*[Mm]udar plano/);
        }
    });
});
