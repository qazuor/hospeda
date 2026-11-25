import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';
import { resolveConversationAction } from '@/lib/listing-contact/conversation-action';

describe('resolveConversationAction', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('preserves the anonymous contact anchor in %s', (locale) => {
        expect(resolveConversationAction({ conversationId: null, locale })).toEqual({
            hasConversation: false,
            href: '#contact',
            label: createTranslations(locale).t('accommodations.detail.pricing.consult')
        });
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('links to the localized existing thread in %s', (locale) => {
        expect(resolveConversationAction({ conversationId: 'thread-1', locale })).toEqual({
            hasConversation: true,
            href: `/${locale}/mi-cuenta/consultas/thread-1/`,
            label: createTranslations(locale).t('conversations.actions.viewConversation')
        });
    });

    it('preserves a caller-specific fallback', () => {
        expect(
            resolveConversationAction({
                conversationId: null,
                locale: 'en',
                fallbackHref: '#details'
            }).href
        ).toBe('#details');
    });
});
