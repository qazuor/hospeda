import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetResendClient } from '../src/client.js';
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

describe('sendEmail', () => {
    const mockReact = { type: 'div', props: { children: 'Test' } } as never;

    beforeEach(() => {
        // Set required environment variable
        process.env.HOSPEDA_RESEND_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        // Reset client and mocks
        resetResendClient();
        vi.clearAllMocks();
        // biome-ignore lint/performance/noDelete: Required to properly remove env var in tests
        delete process.env.HOSPEDA_RESEND_API_KEY;
    });

    describe('when email is sent successfully', () => {
        it('should return success result with message ID', async () => {
            // Arrange
            const { Resend } = await import('resend');
            const mockSend = vi.fn().mockResolvedValue({
                data: { id: 'msg_123456' },
                error: null
            });

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const input: SendEmailInput = {
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
            const { Resend } = await import('resend');
            const mockSend = vi.fn().mockResolvedValue({
                data: { id: 'msg_123456' },
                error: null
            });

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const input: SendEmailInput = {
                to: ['test1@example.com', 'test2@example.com'],
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['test1@example.com', 'test2@example.com']
                })
            );
        });

        it('should use custom from and replyTo when provided', async () => {
            // Arrange
            const { Resend } = await import('resend');
            const mockSend = vi.fn().mockResolvedValue({
                data: { id: 'msg_123456' },
                error: null
            });

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const input: SendEmailInput = {
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact,
                from: 'custom@example.com',
                replyTo: 'reply@example.com'
            };

            // Act
            await sendEmail(input);

            // Assert
            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'custom@example.com',
                    replyTo: 'reply@example.com'
                })
            );
        });
    });

    describe('when email send fails', () => {
        it('should return failure result with error message', async () => {
            // Arrange
            const { Resend } = await import('resend');
            const mockSend = vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'API rate limit exceeded' }
            });

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const input: SendEmailInput = {
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
            const { Resend } = await import('resend');
            const mockSend = vi.fn().mockRejectedValue(new Error('Network error'));

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const input: SendEmailInput = {
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
            const { Resend } = await import('resend');
            const mockSend = vi.fn().mockRejectedValue('String error');

            vi.mocked(Resend).mockImplementation(
                () =>
                    ({
                        emails: { send: mockSend }
                    }) as never
            );

            const input: SendEmailInput = {
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

    describe('when API key is missing', () => {
        it('should return failure result with API key error', async () => {
            // Arrange
            // biome-ignore lint/performance/noDelete: Required to properly remove env var in tests
            delete process.env.HOSPEDA_RESEND_API_KEY;
            resetResendClient();

            const input: SendEmailInput = {
                to: 'test@example.com',
                subject: 'Test Subject',
                react: mockReact
            };

            // Act
            const result = await sendEmail(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('HOSPEDA_RESEND_API_KEY environment variable is required');
            expect(result.messageId).toBeUndefined();
        });
    });
});
