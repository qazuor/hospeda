/** TEST:1755:10 subscription summary copy stays present and aligned across locales. */
import { describe, expect, it } from 'vitest';
import englishAccount from '../src/locales/en/account.json';
import spanishAccount from '../src/locales/es/account.json';
import portugueseAccount from '../src/locales/pt/account.json';

const locales = [spanishAccount, englishAccount, portugueseAccount];
const verticals = [
    'accommodation',
    'venue',
    'experience',
    'tourist',
    'partner',
    'unknown'
] as const;

describe('account subscription mine translations — TEST:1755:10', () => {
    it('defines capitalized vertical labels and interpolation copy in es, en, and pt', () => {
        for (const locale of locales) {
            for (const vertical of verticals) {
                const label: string = locale.subscription.mine.vertical[vertical];
                expect(label).toBeTruthy();
                expect(label).toMatch(/^\p{Lu}/u);
            }
            const { price, nextCharge } = locale.subscription.mine;
            expect(price).toContain('{{amount}}');
            expect(price).toContain('{{cycle}}');
            expect(nextCharge).toContain('{{date}}');
            expect(nextCharge).toContain('{{amount}}');
        }
    });
});

describe('grace plan-change translations — AC:B8b:17', () => {
    it('names the recovery action for each payment method in all supported languages', () => {
        expect(spanishAccount.subscription.mine.graceChangePlan.CARD).toContain('tarjeta');
        expect(spanishAccount.subscription.mine.graceChangePlan.MANUAL).toContain('cuota');
        expect(englishAccount.subscription.mine.graceChangePlan.CARD).toContain('card');
        expect(englishAccount.subscription.mine.graceChangePlan.MANUAL).toContain('installment');
        expect(portugueseAccount.subscription.mine.graceChangePlan.CARD).toContain('cartão');
        expect(portugueseAccount.subscription.mine.graceChangePlan.MANUAL).toContain('parcela');
    });
});
