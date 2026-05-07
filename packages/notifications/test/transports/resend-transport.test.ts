/**
 * BrevoEmailTransport (formerly ResendEmailTransport) test suite.
 *
 * Validates the email transport against the Brevo REST API, mocked through
 * a fake `fetch`. We don't depend on a real network; we just check that the
 * transport encodes the request correctly and surfaces both success and
 * error responses cleanly.
 *
 * @module test/transports/resend-transport.test
 */

import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-email/render', () => ({
    render: vi.fn().mockResolvedValue('<html><body>rendered</body></html>')
}));

import type { EmailClient } from '../../src/config/resend.config';
import { NOTIFICATION_CONSTANTS } from '../../src/constants/notification.constants';
import type { SendEmailInput } from '../../src/transports/email/email-transport.interface';
import { BrevoEmailTransport } from '../../src/transports/email/resend-transport';

const TEST_CLIENT: EmailClient = {
    apiKey: 'xkeysib-test',
    baseUrl: 'https://api.test.example/v3'
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
        ...init
    });
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
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('successful send', () => {
        it('should resolve with the provider message ID', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            const result = await transport.send(createTestInput());

            // Assert
            expect(result.messageId).toBe('<msg@brevo>');
        });

        it('should POST to /smtp/email with auth headers', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await transport.send(createTestInput());

            // Assert
            const [url, init] = fetchMock.mock.calls[0] ?? [];
            expect(url).toBe('https://api.test.example/v3/smtp/email');
            expect((init as RequestInit).method).toBe('POST');
            const headers = (init as RequestInit).headers as Record<string, string>;
            expect(headers['api-key']).toBe('xkeysib-test');
            expect(headers['content-type']).toBe('application/json');
        });

        it('should default to fromEmail/fromName when no `from` is provided', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await transport.send(createTestInput());

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.sender).toEqual({
                email: NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL,
                name: NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME
            });
        });

        it('should accept Resend-style "Name <email>" override and split it', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await transport.send(
                createTestInput({ from: 'Custom Sender <custom@hospeda.com.ar>' })
            );

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.sender).toEqual({
                email: 'custom@hospeda.com.ar',
                name: 'Custom Sender'
            });
        });

        it('should accept a plain email override without a name', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await transport.send(createTestInput({ from: 'plain@hospeda.com.ar' }));

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.sender).toEqual({ email: 'plain@hospeda.com.ar' });
        });

        it('should pass replyTo when provided', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await transport.send(createTestInput({ replyTo: 'reply@hospeda.com.ar' }));

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.replyTo).toEqual({ email: 'reply@hospeda.com.ar' });
        });

        it('should encode tags as `name:value` strings (Brevo format)', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await transport.send(
                createTestInput({
                    tags: [
                        { name: 'category', value: 'transactional' },
                        { name: 'env', value: 'prod' }
                    ]
                })
            );

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.tags).toEqual(['category:transactional', 'env:prod']);
        });

        it('should pass attachments converting Buffer content to base64', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            const buf = Buffer.from('hello world');

            // Act
            await transport.send(
                createTestInput({
                    attachments: [
                        { filename: 'a.txt', content: buf },
                        { filename: 'b.txt', content: 'already-base64-string' }
                    ]
                })
            );

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.attachment).toEqual([
                { name: 'a.txt', content: buf.toString('base64') },
                { name: 'b.txt', content: 'already-base64-string' }
            ]);
        });
    });

    describe('failure modes', () => {
        it('should throw when Brevo returns 4xx with structured error message', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(
                jsonResponse(
                    { code: 'invalid_parameter', message: 'API key revoked' },
                    { status: 400, statusText: 'Bad Request' }
                )
            );

            // Act & Assert
            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: API key revoked'
            );
        });

        it('should throw with status text when body is not JSON', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(
                new Response('not json', { status: 503, statusText: 'Service Unavailable' })
            );

            // Act & Assert
            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: 503 Service Unavailable'
            );
        });

        it('should throw when response is missing messageId', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockResolvedValue(jsonResponse({}));

            // Act & Assert
            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: response missing message ID'
            );
        });

        it('should throw with the network error message when fetch rejects', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockRejectedValue(new Error('Network timeout'));

            // Act & Assert
            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: Network timeout'
            );
        });

        it('should fall back to "Unknown error" for non-Error throws', async () => {
            // Arrange
            const transport = new BrevoEmailTransport(TEST_CLIENT, DEFAULT_TRANSPORT_OPTIONS);
            fetchMock.mockRejectedValue('string error');

            // Act & Assert
            await expect(transport.send(createTestInput())).rejects.toThrow(
                'Failed to send email via Brevo: Unknown error'
            );
        });
    });
});
