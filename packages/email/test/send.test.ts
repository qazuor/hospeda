import type { Resend } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../src/send.js';
import type { SendEmailInput } from '../src/send.js';

// Mock Resend module
vi.mock('resend', () => {
    return {
        Resend: vi.fn().mockImplementation(() => ({
            emails: {
                send: vi.fn()
            }
        }))
    };
});

/**
 * Creates a mock Resend client with a controllable emails.send method.
 */
function createMockResendClient(): { client: Resend; sendMock: ReturnType<typeof vi.fn> } {
    const sendMock = vi.fn();
    const client = {
        emails: {
            send: sendMock
        }
    } as unknown as Resend;
    return { client, sendMock };
}

describe('sendEmail', () => {
    const mockReact = { type: 'div', props: { children: 'Test' } } as never;
    let mockResend: ReturnType<typeof createMockResendClient>;

    beforeEach(() => {
        mockResend = createMockResendClient();
        vi.clearAllMocks();
    });

    describe('when email is sent successfully', () => {
        it('should return success result with message ID', async () => {
            // Arrange
            mockResend.sendMock.mockResolvedValue({
                data: { id: 'msg_123456' },
                error: null
            });

            const input: SendEmailInput = {
                client: mockResend.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.messageId).toBe('msg_123456');
            expect(result.error).toBeUndefined();
        });

        it('should handle multiple recipients', async () => {
            // Arrange
            mockResend.sendMock.mockResolvedValue({
                data: { id: 'msg_123456' },
                error: null
            });

            const input: SendEmailInput = {
                client: mockResend.client,
                to: ['test1@example.com', 'test2@example.com'],
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(true);
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['test1@example.com', 'test2@example.com']
                })
            );
        });

        it('should use custom from and replyTo when provided', async () => {
            // Arrange
            mockResend.sendMock.mockResolvedValue({
                data: { id: 'msg_123456' },
                error: null
            });

            const input: SendEmailInput = {
                client: mockResend.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact,
                from: 'custom@example.com',
                replyTo: 'reply@example.com'
            };

            // Act
            await sendEmail(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'custom@example.com',
                    replyTo: 'reply@example.com'
                })
            );
        });

        it('should use default from address when from is not provided', async () => {
            // Arrange
            mockResend.sendMock.mockResolvedValue({
                data: { id: 'msg_default_from' },
                error: null
            });

            const input: SendEmailInput = {
                client: mockResend.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            await sendEmail(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'Hospeda <noreply@hospeda.com.ar>'
                })
            );
        });
    });

    describe('when email send fails', () => {
        it('should return failure result with error message', async () => {
            // Arrange
            mockResend.sendMock.mockResolvedValue({
                data: null,
                error: { message: 'API rate limit exceeded' }
            });

            const input: SendEmailInput = {
                client: mockResend.client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
            expect(result.messageId).toBeUndefined();
        });

        it('should handle thrown exceptions', async () => {
            // Arrange
            mockResend.sendMock.mockRejectedValue(new Error('Network error'));

            const input: SendEmailInput = {
                client: mockResend.client,
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
            mockResend.sendMock.mockRejectedValue('String error');

            const input: SendEmailInput = {
                client: mockResend.client,
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

    describe('when using createEmailClient', () => {
        it('should send email successfully with a client created via createEmailClient', async () => {
            // Arrange - verify DI works end-to-end with createEmailClient factory
            const { createEmailClient } = await import('../src/client.js');
            const { Resend } = await import('resend');

            const mockSend = vi.fn().mockResolvedValue({
                data: { id: 'msg_di_123' },
                error: null
            });

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const client = createEmailClient({ apiKey: 'test-api-key' });

            const input: SendEmailInput = {
                client,
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.messageId).toBe('msg_di_123');
        });
    });
});
