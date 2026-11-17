/** TEST:HOS-2308 payer-email hints open with the owner's phrase in es, en, and pt. */
import { describe, expect, it } from 'vitest';
import englishAccount from '../src/locales/en/account.json';
import englishBilling from '../src/locales/en/billing.json';
import spanishAccount from '../src/locales/es/account.json';
import spanishBilling from '../src/locales/es/billing.json';
import portugueseAccount from '../src/locales/pt/account.json';
import portugueseBilling from '../src/locales/pt/billing.json';

const OWNER_PHRASE = {
    es: /correo con el que vas a pagar en Mercado Pago/i,
    en: /email you will pay with on Mercado Pago/i,
    pt: /e-mail com o qual você vai pagar no Mercado Pago/i
} as const;

const DECLARED_CLAUSE = {
    es: /declar/i,
    en: /declar/i,
    pt: /declar/i
} as const;

type Locale = keyof typeof OWNER_PHRASE;

const signupHint: Record<Locale, string> = {
    es: spanishBilling.checkout.signup.payerEmail.hint,
    en: englishBilling.checkout.signup.payerEmail.hint,
    pt: portugueseBilling.checkout.signup.payerEmail.hint
};

const planChangeHint: Record<Locale, string> = {
    es: spanishAccount.subscription.mine.planChange.payerEmailHint,
    en: englishAccount.subscription.mine.planChange.payerEmailHint,
    pt: portugueseAccount.subscription.mine.planChange.payerEmailHint
};

const addonHint: Record<Locale, string> = {
    es: spanishBilling.addonPurchase.payerEmailHint,
    en: englishBilling.addonPurchase.payerEmailHint,
    pt: portugueseBilling.addonPurchase.payerEmailHint
};

describe('payer email hint copy — HOS-2308', () => {
    it.each([
        ['es', signupHint.es],
        ['en', signupHint.en],
        ['pt', signupHint.pt]
    ])('signup checkout hint opens with the owner phrase in %s', (locale, hint) => {
        expect(hint).toMatch(OWNER_PHRASE[locale as Locale]);
    });

    it.each([
        ['es', planChangeHint.es],
        ['en', planChangeHint.en],
        ['pt', planChangeHint.pt]
    ])('plan change hint opens with the owner phrase in %s', (locale, hint) => {
        expect(hint).toMatch(OWNER_PHRASE[locale as Locale]);
        expect(hint).toMatch(DECLARED_CLAUSE[locale as Locale]);
    });

    it.each([
        ['es', addonHint.es],
        ['en', addonHint.en],
        ['pt', addonHint.pt]
    ])('addon purchase hint opens with the owner phrase in %s', (locale, hint) => {
        expect(hint).toMatch(OWNER_PHRASE[locale as Locale]);
        expect(hint).toMatch(DECLARED_CLAUSE[locale as Locale]);
    });

    it('keeps the rejection warning on the signup hint after the rewrite', () => {
        expect(signupHint.es).toContain('el pago se rechaza');
        expect(signupHint.en).toContain('the payment is rejected');
        expect(signupHint.pt).toContain('o pagamento será recusado');
    });

    it('uses no em dashes in any of the nine hints', () => {
        const hints = [
            signupHint.es,
            signupHint.en,
            signupHint.pt,
            planChangeHint.es,
            planChangeHint.en,
            planChangeHint.pt,
            addonHint.es,
            addonHint.en,
            addonHint.pt
        ];
        for (const hint of hints) {
            expect(hint).not.toMatch(/[—–]/);
        }
    });
});
