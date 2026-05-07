import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-email/render', () => ({
    render: vi.fn().mockResolvedValue('<html><body>rendered</body></html>')
}));

import type { EmailClient } from '../src/client.js';
import { sendEmail } from '../src/send.js';
import type { SendEmailInput } from '../src/send.js';

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

describe('sendEmail', () => {
    const mockReact = { type: 'div', props: { children: 'Test' } } as never;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('when email is sent successfully', () => {
        it('should return success result with message ID', async () => {
            // Arrange
            fetchMock.mockResolvedValue(
                jsonResponse({ messageId: '<msg_123456@smtp-relay.brevo.com>' })
            );

            const input: SendEmailInput = {
                client: TEST_CLIENT,
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

        it('should POST to the correct Brevo endpoint with auth headers', async () => {
            // Arrange
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact
            });

            // Assert
            const [url, init] = fetchMock.mock.calls[0] ?? [];
            expect(url).toBe('https://api.test.example/v3/smtp/email');
            expect((init as RequestInit).method).toBe('POST');
            const headers = (init as RequestInit).headers as Record<string, string>;
            expect(headers['api-key']).toBe('xkeysib-test');
            expect(headers['content-type']).toBe('application/json');
        });

        it('should handle multiple recipients', async () => {
            // Arrange
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await sendEmail({
                client: TEST_CLIENT,
                to: ['test1@example.com', 'test2@example.com'],
                subject: 'Test',
                react: mockReact
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.to).toEqual([
                { email: 'test1@example.com' },
                { email: 'test2@example.com' }
            ]);
        });

        it('should use custom fromEmail/fromName/replyTo when provided', async () => {
            // Arrange
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact,
                fromEmail: 'custom@example.com',
                fromName: 'Custom Sender',
                replyTo: 'reply@example.com'
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.sender).toEqual({ email: 'custom@example.com', name: 'Custom Sender' });
            expect(body.replyTo).toEqual({ email: 'reply@example.com' });
        });

        it('should use default sender when fromEmail/fromName are not provided', async () => {
            // Arrange
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg_default@brevo>' }));

            // Act
            await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.sender).toEqual({ email: 'noreply@hospeda.com.ar', name: 'Hospeda' });
        });

        it('should pass the rendered HTML and subject to the provider', async () => {
            // Arrange
            fetchMock.mockResolvedValue(jsonResponse({ messageId: '<msg@brevo>' }));

            // Act
            await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Hello',
                react: mockReact
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] ?? [];
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.htmlContent).toBe('<html><body>rendered</body></html>');
            expect(body.subject).toBe('Hello');
        });
    });

    describe('when email send fails', () => {
        it('should return failure result when Brevo returns 4xx with JSON error body', async () => {
            // Arrange
            fetchMock.mockResolvedValue(
                jsonResponse(
                    { code: 'invalid_parameter', message: 'API key revoked' },
                    { status: 400, statusText: 'Bad Request' }
                )
            );

            // Act
            const result = await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('API key revoked');
            expect(result.messageId).toBeUndefined();
        });

        it('should fall back to status text when error body has no message', async () => {
            // Arrange
            fetchMock.mockResolvedValue(
                new Response('not json', {
                    status: 503,
                    statusText: 'Service Unavailable'
                })
            );

            // Act
            const result = await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('503 Service Unavailable');
        });

        it('should handle thrown network errors', async () => {
            // Arrange
            fetchMock.mockRejectedValue(new Error('Network timeout'));

            // Act
            const result = await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Network timeout');
        });

        it('should handle non-Error exceptions', async () => {
            // Arrange
            fetchMock.mockRejectedValue('String error');

            // Act
            const result = await sendEmail({
                client: TEST_CLIENT,
                to: 'test@example.com',
                subject: 'Test',
                react: mockReact
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown error');
        });
    });
});
