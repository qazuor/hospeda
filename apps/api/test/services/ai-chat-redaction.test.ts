/**
 * redactChatText (HOS-2075): the single read-time redaction of customer chat text.
 */
import { describe, expect, it } from 'vitest';
import { redactChatText } from '../../src/services/ai-chat-redaction.js';

describe('redactChatText', () => {
    it('redacts an email', () => {
        const { text } = redactChatText({ text: 'escribime a juan@mail.com por favor' });
        expect(text).toBe('escribime a [REDACTED_EMAIL] por favor');
    });

    it('redacts an Argentine international phone', () => {
        const { text } = redactChatText({ text: 'mi cel es +54 9 3442 123456' });
        expect(text).toContain('[REDACTED_PHONE]');
        expect(text).not.toContain('3442');
    });

    it('redacts a Luhn-valid card number', () => {
        const { text } = redactChatText({ text: 'tarjeta 4111 1111 1111 1111 gracias' });
        expect(text).toContain('[REDACTED_CARD]');
        expect(text).not.toContain('4111');
    });

    it('redacts email and phone in the same message', () => {
        const { text } = redactChatText({ text: 'juan@mail.com o +54 9 3442 123456' });
        expect(text).toBe('[REDACTED_EMAIL] o [REDACTED_PHONE]');
    });

    it('returns text without personal data unchanged', () => {
        const input = 'Tienen pileta climatizada en 2026? El precio es 150000';
        expect(redactChatText({ text: input }).text).toBe(input);
    });

    it('does not mutate nor depend on the input reference', () => {
        const input = 'a@b.com';
        redactChatText({ text: input });
        expect(input).toBe('a@b.com');
    });
});
