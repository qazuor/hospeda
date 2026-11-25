/** TEST:HOS-2615 the three payer-email hints carry one owner-fixed text in es, en, and pt. */
import { describe, expect, it } from 'vitest';
import englishAccount from '../src/locales/en/account.json';
import englishBilling from '../src/locales/en/billing.json';
import spanishAccount from '../src/locales/es/account.json';
import spanishBilling from '../src/locales/es/billing.json';
import portugueseAccount from '../src/locales/pt/account.json';
import portugueseBilling from '../src/locales/pt/billing.json';

type Locale = 'es' | 'en' | 'pt';

const OWNER_TEXT: Record<Locale, string> = {
    es: 'Es el correo de tu cuenta de Mercado Pago. Si pagás con otra cuenta, cambialo acá: si no coincide, el pago se rechaza.',
    en: 'This is the email of your Mercado Pago account. If you pay with a different account, change it here: if it does not match, the payment is rejected.',
    pt: 'Este é o e-mail da sua conta do Mercado Pago. Se você pagar com outra conta, altere aqui: se não coincidir, o pagamento será recusado.'
};

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

describe('payer email hint copy - HOS-2615', () => {
    it.each([
        ['signup checkout', signupHint],
        ['plan change', planChangeHint],
        ['addon purchase', addonHint]
    ])('%s shows the single owner text in es, en and pt', (_place, hints) => {
        expect(hints).toEqual(OWNER_TEXT);
    });

    it('pt differs from es', () => {
        expect(signupHint.pt).not.toBe(signupHint.es);
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
