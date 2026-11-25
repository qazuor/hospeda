/** TEST:HOS-2615 the anonymous inquiry confirmation tells the tourist the owner gets the message only after they confirm their email. */
import { describe, expect, it } from 'vitest';
import english from '../src/locales/en/conversations.json';
import spanish from '../src/locales/es/conversations.json';
import portuguese from '../src/locales/pt/conversations.json';

const NOTICE = {
    es: /recién cuando confirmes tu email/,
    en: /only after you confirm your email/,
    pt: /só chega ao anfitrião depois que você confirmar/
} as const;

describe('inquiry verification notice - HOS-2615', () => {
    it.each([
        ['es', spanish.notifications.verificationSent],
        ['en', english.notifications.verificationSent],
        ['pt', portuguese.notifications.verificationSent]
    ])('verificationSent states the host gets the message after confirmation in %s', (locale, text) => {
        expect(text).toMatch(NOTICE[locale as keyof typeof NOTICE]);
    });
});
