import { describe, expect, it } from 'vitest';
import { resolveAlertDigestSubject } from '../../../src/services/channels/email-alert.channel';
import {
    buildConversationNewMessageSubject,
    buildConversationTokenDay15Subject,
    buildConversationTokenDay25Subject,
    CONVERSATION_ACCESS_LINK_SUBJECT,
    CONVERSATION_VERIFY_SUBJECT
} from '../../../src/templates/conversation/subjects';

/**
 * HOS-2519 AC-4.5: the conversation and alert-digest subjects moved out of
 * their call sites. Each expected value below is the literal (or template
 * literal, filled with the same name) the call site used before the move.
 */
describe('conversation subjects', () => {
    const accommodationName = 'Cabaña de Ejemplo';

    it('keeps the verification subject byte-identical', () => {
        expect(CONVERSATION_VERIFY_SUBJECT).toBe(
            'Verificá tu email para continuar la conversación — Hospeda'
        );
    });

    it('keeps the access link subject byte-identical', () => {
        expect(CONVERSATION_ACCESS_LINK_SUBJECT).toBe(
            'Tu enlace de acceso a la conversación — Hospeda'
        );
    });

    it('keeps the new message subject byte-identical', () => {
        expect(buildConversationNewMessageSubject({ accommodationName })).toBe(
            `Nuevo mensaje sobre ${accommodationName}`
        );
    });

    it('keeps the day 15 token reminder subject byte-identical', () => {
        expect(buildConversationTokenDay15Subject({ accommodationName })).toBe(
            `Tu enlace de acceso vence en 15 días — ${accommodationName}`
        );
    });

    it('keeps the day 25 token reminder subject byte-identical', () => {
        expect(buildConversationTokenDay25Subject({ accommodationName })).toBe(
            `¡Último aviso! Tu enlace vence en 5 días — ${accommodationName}`
        );
    });
});

describe('resolveAlertDigestSubject', () => {
    it.each([
        ['es', 'Tus alertas de precios y ofertas'],
        ['en', 'Your price drop and offer alerts'],
        ['pt', 'Seus alertas de preço e ofertas'],
        ['fr', 'Tus alertas de precios y ofertas']
    ])('resolves locale %s to the subject the channel always sent', (locale, expected) => {
        expect(resolveAlertDigestSubject({ locale })).toBe(expected);
    });
});
