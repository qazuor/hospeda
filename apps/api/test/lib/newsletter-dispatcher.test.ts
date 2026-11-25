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

    it('sends the welcome email', async () => {
        mockSendEmail.mockResolvedValue({ success: true });
        const dispatcher = createNewsletterNotificationDispatcher();

        await dispatcher.sendWelcome({
            subscriberId: 's1',
            email: 'guest@example.com',
            userId: null,
            locale: 'es',
            unsubscribeToken: 't'
        });

        expect(mockSendEmail.mock.calls[0]?.[0].attribution.templateKey).toBe('newsletter.welcome');
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
