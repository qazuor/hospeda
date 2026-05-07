import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @react-email/render so the tests do not depend on actually rendering
// React components — sendEmail's contract with the renderer is stable enough
// to be tested through fixed HTML output.
vi.mock('@react-email/render', () => ({
    render: vi.fn().mockResolvedValue('<html><body>rendered</body></html>')
}));

// Mock the Brevo SDK exports we depend on. SendSmtpEmail is treated as a
// dumb POJO so the tests can inspect what sendEmail wrote into it.
vi.mock('@getbrevo/brevo', () => {
    class FakeSendSmtpEmail {
        public subject?: string;
        public htmlContent?: string;
        public sender?: { email: string; name?: string };
        public to?: { email: string }[];
        public replyTo?: { email: string };
    }
    class FakeApi {
        sendTransacEmail = vi.fn();
    }
    return {
        SendSmtpEmail: FakeSendSmtpEmail,
        TransactionalEmailsApi: FakeApi,
        TransactionalEmailsApiApiKeys: { apiKey: 'apiKey' }
    };
});

import type { EmailClient } from '../src/client.js';
import { sendEmail } from '../src/send.js';
import type { SendEmailInput } from '../src/send.js';

type SendMock = ReturnType<typeof vi.fn>;

function createMockClient(): { client: EmailClient; sendMock: SendMock } {
    const sendMock = vi.fn();
    // The fake client only needs to expose sendTransacEmail; the type cast is
    // safe here because EmailClient is an alias for Brevo's API class which
    // is mocked above.
    const client = { sendTransacEmail: sendMock } as unknown as EmailClient;
    return { client, sendMock };
}

describe('sendEmail', () => {
    const mockReact = { type: 'div', props: { children: 'Test' } } as never;
    let mock: ReturnType<typeof createMockClient>;

    beforeEach(() => {
        mock = createMockClient();
        vi.clearAllMocks();
    });

    describe('when email is sent successfully', () => {
        it('should return success result with message ID', async () => {
            // Arrange
            mock.sendMock.mockResolvedValue({
                body: { messageId: '<msg_123456@smtp-relay.brevo.com>' }
            });

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.messageId).toBe('<msg_123456@smtp-relay.brevo.com>');
            expect(result.error).toBeUndefined();
        });

        it('should handle multiple recipients', async () => {
            // Arrange
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            const input: SendEmailInput = {
                client: mock.client,
                to: ['test1@example.com', 'test2@example.com'],
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(true);
            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.to).toEqual([
                { email: 'test1@example.com' },
                { email: 'test2@example.com' }
            ]);
        });

        it('should use custom fromEmail/fromName/replyTo when provided', async () => {
            // Arrange
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact,
                fromEmail: 'custom@example.com',
                fromName: 'Custom Sender',
                replyTo: 'reply@example.com'
            };

            // Act
            await sendEmail(input);

            // Assert
            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.sender).toEqual({
                email: 'custom@example.com',
                name: 'Custom Sender'
            });
            expect(message.replyTo).toEqual({ email: 'reply@example.com' });
        });

        it('should use default sender when fromEmail/fromName are not provided', async () => {
            // Arrange
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg_default@brevo>' } });

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            await sendEmail(input);

            // Assert
            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.sender).toEqual({
                email: 'noreply@hospeda.com.ar',
                name: 'Hospeda'
            });
        });

        it('should pass the rendered HTML to the provider', async () => {
            // Arrange
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            await sendEmail(input);

            // Assert
            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.htmlContent).toBe('<html><body>rendered</body></html>');
            expect(message.subject).toBe('Test Subject');
        });
    });

    describe('when email send fails', () => {
        it('should return failure result with structured error body', async () => {
            // Arrange — Brevo SDK errors expose details via err.body.
            const sdkError = Object.assign(new Error('Bad Request'), {
                body: { code: 'invalid_parameter', message: 'API rate limit exceeded' }
            });
            mock.sendMock.mockRejectedValue(sdkError);

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('API rate limit exceeded');
            expect(result.messageId).toBeUndefined();
        });

        it('should fall back to err.message when no body is present', async () => {
            // Arrange
            mock.sendMock.mockRejectedValue(new Error('Network error'));

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            mock.sendMock.mockRejectedValue('String error');

            const input: SendEmailInput = {
                client: mock.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown error');
        });
    });
});
