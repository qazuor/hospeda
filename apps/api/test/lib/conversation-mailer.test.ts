/**
 * Tests for createConversationMailer factory.
 *
 * Verifies:
 * - Returns `undefined` when HOSPEDA_RESEND_API_KEY is absent.
 * - Returns a `ConversationMailer` object when the key is present.
 * - `sendVerificationEmail` invokes `sendEmail` with the correct arguments.
 * - On `sendEmail` failure, errors are logged but the method does NOT throw.
 *
 * @module test/lib/conversation-mailer
 */

import type { VerificationEmailPayload } from '@repo/service-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted by Vitest so they run before any module imports
// ---------------------------------------------------------------------------

const mockSendEmail = vi.fn();
const mockCreateEmailClient = vi.fn(() => ({ __isMockClient: true }));

vi.mock('@repo/email', () => ({
    sendEmail: mockSendEmail,
    createEmailClient: mockCreateEmailClient
}));

const mockConversationVerify = vi.fn((props: unknown) => props);

vi.mock('@repo/notifications', () => ({
    ConversationVerify: mockConversationVerify
}));

const mockLoggerError = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        error: mockLoggerError,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Controlled env mock — the `env` object is mutated per-test via `mockEnv`
// ---------------------------------------------------------------------------

const mockEnv: Record<string, string | undefined> = {
    HOSPEDA_RESEND_API_KEY: undefined,
    HOSPEDA_BETTER_AUTH_SECRET: 'test-secret-min-32-chars-padding-x',
    HOSPEDA_SITE_URL: 'https://hospeda.com.ar',
    HOSPEDA_API_URL: 'https://api.hospeda.com.ar',
    HOSPEDA_ADMIN_URL: 'https://admin.hospeda.com.ar',
    NODE_ENV: 'test'
};

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid verification payload. */
const SAMPLE_PAYLOAD: VerificationEmailPayload = {
    conversationId: '11111111-1111-1111-1111-111111111111',
    recipientEmail: 'guest@example.com',
    verificationUrl: 'https://hospeda.com.ar/es/verificar?token=abc',
    guestName: 'Ana García',
    accommodationName: 'La Casa del Litoral',
    locale: 'es'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createConversationMailer', () => {
    afterEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_RESEND_API_KEY = undefined;
    });

    // -----------------------------------------------------------------------
    describe('when HOSPEDA_RESEND_API_KEY is not set', () => {
        it('should return undefined', async () => {
            mockEnv.HOSPEDA_RESEND_API_KEY = undefined;
            vi.resetModules();
            const { createConversationMailer: factory } = await import(
                '../../src/lib/conversation-mailer'
            );

            const mailer = factory();

            expect(mailer).toBeUndefined();
        });

        it('should NOT call createEmailClient', async () => {
            mockEnv.HOSPEDA_RESEND_API_KEY = undefined;
            vi.resetModules();
            const { createConversationMailer: factory } = await import(
                '../../src/lib/conversation-mailer'
            );

            factory();

            expect(mockCreateEmailClient).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    describe('when HOSPEDA_RESEND_API_KEY is set', () => {
        it('should return an object with sendVerificationEmail', async () => {
            mockEnv.HOSPEDA_RESEND_API_KEY = 'test-resend-key-123';
            vi.resetModules();
            const { createConversationMailer: factory } = await import(
                '../../src/lib/conversation-mailer'
            );

            const mailer = factory();

            expect(mailer).toBeDefined();
            expect(typeof mailer?.sendVerificationEmail).toBe('function');
        });

        it('should call createEmailClient with the API key', async () => {
            mockEnv.HOSPEDA_RESEND_API_KEY = 'test-resend-key-123';
            vi.resetModules();
            const { createConversationMailer: factory } = await import(
                '../../src/lib/conversation-mailer'
            );

            factory();

            expect(mockCreateEmailClient).toHaveBeenCalledWith({
                apiKey: 'test-resend-key-123'
            });
        });
    });

    // -----------------------------------------------------------------------
    describe('sendVerificationEmail', () => {
        async function getMailer() {
            mockEnv.HOSPEDA_RESEND_API_KEY = 'test-resend-key-123';
            vi.resetModules();
            const { createConversationMailer: factory } = await import(
                '../../src/lib/conversation-mailer'
            );
            const mailer = factory();
            if (!mailer) throw new Error('Expected mailer to be defined');
            return mailer;
        }

        it('should call sendEmail with the correct to address and subject', async () => {
            // Arrange
            mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg_abc123' });
            const mailer = await getMailer();

            // Act
            await mailer.sendVerificationEmail(SAMPLE_PAYLOAD);

            // Assert
            expect(mockSendEmail).toHaveBeenCalledOnce();
            const callArg = mockSendEmail.mock.calls[0]?.[0] as {
                to: string;
                subject: string;
                client: unknown;
                react: unknown;
            };
            expect(callArg.to).toBe('guest@example.com');
            expect(callArg.subject).toContain('Verificá');
        });

        it('should invoke ConversationVerify with correct props', async () => {
            // Arrange
            mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg_abc123' });
            const mailer = await getMailer();

            // Act
            await mailer.sendVerificationEmail(SAMPLE_PAYLOAD);

            // Assert
            expect(mockConversationVerify).toHaveBeenCalledOnce();
            expect(mockConversationVerify).toHaveBeenCalledWith({
                accommodationName: SAMPLE_PAYLOAD.accommodationName,
                verificationUrl: SAMPLE_PAYLOAD.verificationUrl,
                guestName: SAMPLE_PAYLOAD.guestName,
                locale: SAMPLE_PAYLOAD.locale
            });
        });

        it('should pass the mock email client returned by createEmailClient', async () => {
            // Arrange
            mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg_abc123' });
            const mailer = await getMailer();

            // Act
            await mailer.sendVerificationEmail(SAMPLE_PAYLOAD);

            // Assert
            const callArg = mockSendEmail.mock.calls[0]?.[0] as { client: unknown };
            expect(callArg.client).toEqual({ __isMockClient: true });
        });

        it('should NOT throw when sendEmail returns success: false', async () => {
            // Arrange
            mockSendEmail.mockResolvedValue({ success: false, error: 'Rate limit exceeded' });
            const mailer = await getMailer();

            // Act & Assert — must not throw
            await expect(mailer.sendVerificationEmail(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
        });

        it('should log an error when sendEmail returns success: false', async () => {
            // Arrange
            mockSendEmail.mockResolvedValue({ success: false, error: 'Rate limit exceeded' });
            const mailer = await getMailer();

            // Act
            await mailer.sendVerificationEmail(SAMPLE_PAYLOAD);

            // Assert
            expect(mockLoggerError).toHaveBeenCalledOnce();
            const [contextArg] = mockLoggerError.mock.calls[0] as [Record<string, unknown>];
            expect(contextArg.conversationId).toBe(SAMPLE_PAYLOAD.conversationId);
            expect(contextArg.error).toBe('Rate limit exceeded');
        });

        it('should NOT log an error when sendEmail succeeds', async () => {
            // Arrange
            mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg_ok' });
            const mailer = await getMailer();

            // Act
            await mailer.sendVerificationEmail(SAMPLE_PAYLOAD);

            // Assert
            expect(mockLoggerError).not.toHaveBeenCalled();
        });
    });
});
