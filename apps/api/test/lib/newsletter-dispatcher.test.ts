/**
 * Tests for createNewsletterNotificationDispatcher (HOS-2603).
 *
 * @module test/lib/newsletter-dispatcher
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockSendEmail, mockEnv } = vi.hoisted(() => ({
    mockSendEmail: vi.fn(),
    mockEnv: {
        HOSPEDA_EMAIL_API_KEY: 'key',
        HOSPEDA_API_URL: 'https://api.example.test/',
        HOSPEDA_SITE_URL: 'https://example.test',
        NODE_ENV: 'test'
    } as Record<string, string | undefined>
}));

vi.mock('@repo/email', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/email')>()),
    sendEmail: mockSendEmail,
    createEmailClient: vi.fn(() => ({ __isMockClient: true }))
}));

vi.mock('../../src/utils/env', () => ({ env: mockEnv }));

import { createNewsletterNotificationDispatcher } from '../../src/lib/newsletter-dispatcher';

describe('createNewsletterNotificationDispatcher', () => {
    afterEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_EMAIL_API_KEY = 'key';
    });

    it('sends the verification email to the guest with the API verify link', async () => {
        // Arrange
        mockSendEmail.mockResolvedValue({ success: true });
        const dispatcher = createNewsletterNotificationDispatcher();

        // Act
        await dispatcher.sendVerification({
            subscriberId: 's1',
            email: 'guest@example.com',
            userId: '',
            locale: 'es',
            token: 'abc.def'
        });

        // Assert
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        const input = mockSendEmail.mock.calls[0]?.[0];
        expect(input.to).toBe('guest@example.com');
        expect(input.attribution).toEqual({
            medium: 'transactional',
            templateKey: 'newsletter.verify'
        });
        expect(JSON.stringify(input.react.props)).toContain(
            'https://api.example.test/api/v1/public/newsletter/verify?token=abc.def&locale=es'
        );
    });

    it('sends the account welcome without an unsubscribe link when the subscriber has a user', async () => {
        mockSendEmail.mockResolvedValue({ success: true });
        const dispatcher = createNewsletterNotificationDispatcher();

        await dispatcher.sendWelcome({
            subscriberId: 's1',
            email: 'user@example.com',
            userId: 'u1',
            locale: 'es',
            unsubscribeToken: 'tok'
        });

        const input = mockSendEmail.mock.calls[0]?.[0];
        expect(input.attribution.templateKey).toBe('newsletter.welcome');
        expect(JSON.stringify(input.react.props)).not.toContain('newsletter/unsubscribe');
        expect(JSON.stringify(input.react.props)).toContain('mi-cuenta/newsletter');
    });

    it('sends the guest welcome with the web unsubscribe confirmation link (HOS-2617)', async () => {
        mockSendEmail.mockResolvedValue({ success: true });
        const dispatcher = createNewsletterNotificationDispatcher();

        await dispatcher.sendWelcome({
            subscriberId: 's1',
            email: 'guest@example.com',
            userId: null,
            locale: 'pt',
            unsubscribeToken: 'tok.en'
        });

        const props = JSON.stringify(mockSendEmail.mock.calls[0]?.[0].react.props);
        expect(props).toContain('https://example.test/pt/newsletter/unsubscribe/?token=tok.en');
        // Never the API GET: a link a mail scanner prefetches must not unsubscribe.
        expect(props).not.toContain('/api/v1/public/newsletter/unsubscribe');
    });

    it('does not throw when the provider fails', async () => {
        mockSendEmail.mockResolvedValue({ success: false, error: 'boom' });
        const dispatcher = createNewsletterNotificationDispatcher();

        await expect(
            dispatcher.sendVerification({
                subscriberId: 's1',
                email: 'guest@example.com',
                userId: '',
                locale: 'es',
                token: 't'
            })
        ).resolves.toBeUndefined();
    });

    it('skips the send when no email key is configured', async () => {
        mockEnv.HOSPEDA_EMAIL_API_KEY = undefined;
        const dispatcher = createNewsletterNotificationDispatcher();

        await dispatcher.sendVerification({
            subscriberId: 's1',
            email: 'guest@example.com',
            userId: '',
            locale: 'es',
            token: 't'
        });

        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});
