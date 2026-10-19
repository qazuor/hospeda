/**
 * HOS-1352 g1 / DEC-DATA-005📌4: account closure is handled by support, by
 * request, through the manual steps; the Mi Cuenta self-service screen belongs
 * to HOS-1393 and does not exist yet. This is a guard rather than an assertion
 * of exact wording so copy can evolve while false promises stay caught.
 *
 * When the self-service closure screen ships (HOS-1393), this guard changes
 * together with the copy.
 *
 * @module test/faq-account-closure-copy.guard
 */

import { describe, expect, it } from 'vitest';
import contactEn from '../src/locales/en/contact.json';
import faqEn from '../src/locales/en/faq.json';
import contactEs from '../src/locales/es/contact.json';
import faqEs from '../src/locales/es/faq.json';
import contactPt from '../src/locales/pt/contact.json';
import faqPt from '../src/locales/pt/faq.json';

/** Number adjacent to a day unit, copied from trial-days-not-hardcoded.guard.test.ts. */
const LITERAL_DAY_COUNT: ReadonlyArray<RegExp> = [
    /\b\d+[\s-]*(d[ií]as?|days?)\b/i,
    /\b(d[ií]as?|days?)[\s-]*\d+\b/i
];

/** FAQ strings, the public support mailbox, and copy that manual closure cannot promise. */
const ROWS = [
    {
        locale: 'es',
        question: faqEs.categories.account.items.deleteAccount.question,
        answer: faqEs.categories.account.items.deleteAccount.answer,
        email: contactEs.email.value,
        falsePhrases: ['Eliminar cuenta', 'Configuración', 'anónim']
    },
    {
        locale: 'en',
        question: faqEn.categories.account.items.deleteAccount.question,
        answer: faqEn.categories.account.items.deleteAccount.answer,
        email: contactEn.email.value,
        falsePhrases: ['Delete account', 'Settings', 'anonym']
    },
    {
        locale: 'pt',
        question: faqPt.categories.account.items.deleteAccount.question,
        answer: faqPt.categories.account.items.deleteAccount.answer,
        email: contactPt.email.value,
        falsePhrases: ['Excluir conta', 'Configurações', 'anônim']
    }
] as const;

/** Returns banned phrases in table order, then each literal day-count match. */
function findFalsePromises({
    text,
    phrases
}: {
    text: string;
    phrases: ReadonlyArray<string>;
}): string[] {
    const foldedText = text.toLowerCase();
    const foundPhrases = phrases.filter((phrase) => foldedText.includes(phrase.toLowerCase()));
    const foundDayCounts = LITERAL_DAY_COUNT.flatMap((pattern) => {
        const match = pattern.exec(text);
        return match ? [match[0]] : [];
    });

    return [...foundPhrases, ...foundDayCounts];
}

describe('HOS-1699 account-closure FAQ copy guard', () => {
    for (const row of ROWS) {
        it(`TEST:1699:1 AC:1699:2 the deleteAccount answer names the support mailbox the Contact page shows (${row.locale})`, () => {
            expect(row.answer).toContain(row.email);
        });

        it(`TEST:1699:2 AC:1699:1 AC:1699:2 AC:1699:3 the deleteAccount copy makes no promise the manual closure does not keep (${row.locale})`, () => {
            expect(findFalsePromises({ text: row.question, phrases: row.falsePhrases })).toEqual(
                []
            );
            expect(findFalsePromises({ text: row.answer, phrases: row.falsePhrases })).toEqual([]);
        });

        it(`TEST:1699:2 the detector flags the pre-HOS-1699 copy (${row.locale})`, () => {
            const oldCopy = {
                es: 'Desde Mi Cuenta > Configuración > Eliminar cuenta. Eliminamos tus datos personales en un plazo máximo de 30 días según nuestra política de privacidad. Las reseñas que dejaste pueden permanecer de forma anónima.',
                en: 'From My Account > Settings > Delete account. We remove your personal data within 30 days according to our privacy policy. The reviews you left may remain anonymously.',
                pt: 'Em Minha Conta > Configurações > Excluir conta. Removemos seus dados pessoais em até 30 dias conforme nossa política de privacidade. As avaliações que você deixou podem permanecer de forma anônima.'
            }[row.locale];
            const expected = {
                es: ['Eliminar cuenta', 'Configuración', 'anónim', '30 días'],
                en: ['Delete account', 'Settings', 'anonym', '30 days'],
                pt: ['Excluir conta', 'Configurações', 'anônim', '30 dias']
            }[row.locale];

            expect(findFalsePromises({ text: oldCopy, phrases: row.falsePhrases })).toEqual(
                expected
            );
        });
    }

    it('TEST:1699:2 the guard explicitly covers es, en, and pt', () => {
        expect(ROWS.map((row) => row.locale)).toEqual(['es', 'en', 'pt']);
    });
});
