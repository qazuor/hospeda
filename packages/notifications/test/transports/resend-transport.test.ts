/**
 * BrevoEmailTransport (formerly ResendEmailTransport) test suite.
 *
 * Validates the email transport implementation against the Brevo provider:
 * - Successful send with provider message ID
 * - Default vs override sender (`from`) handling
 * - replyTo, tags, attachments passthrough
 * - Error surfacing from the SDK (structured `body` and plain Error)
 *
 * @module test/transports/resend-transport.test
 */

import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-email/render', () => ({
    render: vi.fn().mockResolvedValue('<html><body>rendered</body></html>')
}));

vi.mock('@getbrevo/brevo', () => {
    class FakeSendSmtpEmail {
        public subject?: string;
        public htmlContent?: string;
        public sender?: { email: string; name?: string };
        public to?: { email: string }[];
        public replyTo?: { email: string };
        public tags?: string[];
        public attachment?: Array<{ name: string; content: string }>;
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

import type { EmailClient } from '../../src/config/resend.config';
import { NOTIFICATION_CONSTANTS } from '../../src/constants/notification.constants';
import type { SendEmailInput } from '../../src/transports/email/email-transport.interface';
import { BrevoEmailTransport } from '../../src/transports/email/resend-transport';

type SendMock = ReturnType<typeof vi.fn>;

function createMockClient(): { client: EmailClient; sendMock: SendMock } {
    const sendMock = vi.fn();
    const client = { sendTransacEmail: sendMock } as unknown as EmailClient;
    return { client, sendMock };
}

function createTestInput(overrides?: Partial<SendEmailInput>): SendEmailInput {
    return {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        react: {} as ReactElement,
        ...overrides
    };
}

const DEFAULT_TRANSPORT_OPTIONS = {
    fromEmail: NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL,
    fromName: NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME
} as const;

describe('BrevoEmailTransport', () => {
    let mock: ReturnType<typeof createMockClient>;

    beforeEach(() => {
        mock = createMockClient();
        vi.clearAllMocks();
    });

    describe('successful send', () => {
        it('should resolve with the provider message ID', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            const result = await transport.send(createTestInput());

            expect(result.messageId).toBe('<msg@brevo>');
        });

        it('should pass the rendered HTML and subject to the provider', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            await transport.send(createTestInput({ subject: 'Hello' }));

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.subject).toBe('Hello');
            expect(message.htmlContent).toBe('<html><body>rendered</body></html>');
        });

        it('should default to fromEmail/fromName when no `from` is provided', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            await transport.send(createTestInput());

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.sender).toEqual({
                email: NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL,
                name: NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME
            });
        });

        it('should accept Resend-style "Name <email>" override and split it correctly', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            await transport.send(
                createTestInput({ from: 'Custom Sender <custom@hospeda.com.ar>' })
            );

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.sender).toEqual({
                email: 'custom@hospeda.com.ar',
                name: 'Custom Sender'
            });
        });

        it('should accept a plain email override without a name', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            await transport.send(createTestInput({ from: 'plain@hospeda.com.ar' }));

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.sender).toEqual({ email: 'plain@hospeda.com.ar' });
        });

        it('should pass replyTo when provided', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            await transport.send(createTestInput({ replyTo: 'reply@hospeda.com.ar' }));

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.replyTo).toEqual({ email: 'reply@hospeda.com.ar' });
        });

        it('should encode tags as `name:value` strings (Brevo format)', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            await transport.send(
                createTestInput({
                    tags: [
                        { name: 'category', value: 'transactional' },
                        { name: 'env', value: 'prod' }
                    ]
                })
            );

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.tags).toEqual(['category:transactional', 'env:prod']);
        });

        it('should pass attachments converting Buffer content to base64', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: { messageId: '<msg@brevo>' } });

            const buf = Buffer.from('hello world');

            await transport.send(
                createTestInput({
                    attachments: [
                        { filename: 'a.txt', content: buf },
                        { filename: 'b.txt', content: 'already-base64-string' }
                    ]
                })
            );

            const message = mock.sendMock.mock.calls[0]?.[0];
            expect(message.attachment).toEqual([
                { name: 'a.txt', content: buf.toString('base64') },
                { name: 'b.txt', content: 'already-base64-string' }
            ]);
        });
    });

    describe('failure modes', () => {
        it('should throw when the response is missing messageId', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockResolvedValue({ body: {} });

            await expect(transport.send(createTestInput())).rejects.toThrow(
                /Failed to send email via Brevo: Brevo response missing message ID/
            );
        });

        it('should throw with structured detail when the SDK rejects with body', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            const sdkError = Object.assign(new Error('Bad Request'), {
                body: { code: 'invalid_parameter', message: 'API key revoked' }
            });
            mock.sendMock.mockRejectedValue(sdkError);

            await expect(transport.send(createTestInput())).rejects.toThrow(
                /Failed to send email via Brevo: .*API key revoked/
            );
        });

        it('should throw with the SDK error message when no body is present', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockRejectedValue(new Error('Network timeout'));

            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: Network timeout'
            );
        });

        it('should fall back to "Unknown error" for non-Error throws', async () => {
            const transport = new BrevoEmailTransport(mock.client, DEFAULT_TRANSPORT_OPTIONS);
            mock.sendMock.mockRejectedValue('string error');

            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: Unknown error'
            );
        });
    });
});
