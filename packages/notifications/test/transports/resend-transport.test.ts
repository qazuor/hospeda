/**
 * Resend Email Transport Test Suite
 *
 * Tests for the Resend email transport implementation including:
 * - Successful email sending with message ID
 * - API error handling (Error object, string, null)
 * - Missing message ID in response
 * - Network error handling
 * - From override vs default from address
 * - replyTo and tags passthrough
 *
 * @module test/transports/resend-transport.test
 */

import type { ReactElement } from 'react';
import type { Resend } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_CONSTANTS } from '../../src/constants/notification.constants';
import type { SendEmailInput } from '../../src/transports/email/email-transport.interface';
import { ResendEmailTransport } from '../../src/transports/email/resend-transport';

/**
 * Creates a mock Resend client with a controllable emails.send method
 */
function createMockResend(): { client: Resend; sendMock: ReturnType<typeof vi.fn> } {
    const sendMock = vi.fn();
    const client = {
        emails: {
            send: sendMock
        }
    } as unknown as Resend;
    return { client, sendMock };
}

/**
 * Creates a valid SendEmailInput for testing
 */
function createTestInput(overrides?: Partial<SendEmailInput>): SendEmailInput {
    return {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        react: {} as ReactElement,
        ...overrides
    };
}

describe('ResendEmailTransport', () => {
    let mockResend: ReturnType<typeof createMockResend>;

    beforeEach(() => {
        mockResend = createMockResend();
        vi.unstubAllEnvs();
    });

    describe('constructor', () => {
        it('should use default from address when no options provided', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_123' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: `${NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME} <${NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL}>`
                })
            );
        });

        it('should use custom from options when provided', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client, {
                fromEmail: 'custom@hospeda.com.ar',
                fromName: 'Custom Sender'
            });
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_123' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'Custom Sender <custom@hospeda.com.ar>'
                })
            );
        });

        it('should use environment variables when no options provided', async () => {
            // Arrange
            vi.stubEnv('RESEND_FROM_EMAIL', 'env@hospeda.com.ar');
            vi.stubEnv('RESEND_FROM_NAME', 'Env Sender');
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_123' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'Env Sender <env@hospeda.com.ar>'
                })
            );
        });
    });

    describe('send - success', () => {
        it('should return message ID on successful send', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_abc123' } });

            // Act
            const result = await transport.send(input);

            // Assert
            expect(result).toEqual({ messageId: 'msg_abc123' });
        });

        it('should pass all input fields to Resend client', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput({
                to: 'user@test.com',
                subject: 'Important Email',
                replyTo: 'support@hospeda.com.ar',
                tags: [
                    { name: 'category', value: 'billing' },
                    { name: 'type', value: 'payment_success' }
                ]
            });
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_456' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith({
                from: expect.any(String),
                to: 'user@test.com',
                subject: 'Important Email',
                react: expect.anything(),
                replyTo: 'support@hospeda.com.ar',
                tags: [
                    { name: 'category', value: 'billing' },
                    { name: 'type', value: 'payment_success' }
                ]
            });
        });
    });

    describe('send - from override', () => {
        it('should use input from address when provided', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput({
                from: 'Override Sender <override@hospeda.com.ar>'
            });
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_789' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'Override Sender <override@hospeda.com.ar>'
                })
            );
        });

        it('should use default from when input from is undefined', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput({ from: undefined });
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_000' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: `${NOTIFICATION_CONSTANTS.DEFAULT_FROM_NAME} <${NOTIFICATION_CONSTANTS.DEFAULT_FROM_EMAIL}>`
                })
            );
        });
    });

    describe('send - replyTo and tags passthrough', () => {
        it('should pass replyTo to Resend client', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput({ replyTo: 'reply@hospeda.com.ar' });
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_reply' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    replyTo: 'reply@hospeda.com.ar'
                })
            );
        });

        it('should pass tags array to Resend client', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const tags = [{ name: 'environment', value: 'production' }];
            const input = createTestInput({ tags });
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_tags' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(expect.objectContaining({ tags }));
        });

        it('should pass undefined replyTo and tags when not provided', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({ data: { id: 'msg_none' } });

            // Act
            await transport.send(input);

            // Assert
            expect(mockResend.sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    replyTo: undefined,
                    tags: undefined
                })
            );
        });
    });

    describe('send - API error (Error object)', () => {
        it('should throw with error message when API returns Error object', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({
                error: new Error('Rate limit exceeded')
            });

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Resend API error: Rate limit exceeded'
            );
        });
    });

    describe('send - API error (string)', () => {
        it('should throw with string error when API returns string', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({
                error: 'Invalid API key'
            });

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Resend API error: Invalid API key'
            );
        });
    });

    describe('send - API error (null)', () => {
        it('should throw with unknown error when API returns null error', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({
                error: null
            });

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Resend API error: Unknown error'
            );
        });
    });

    describe('send - missing message ID', () => {
        it('should throw when response data is null', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({
                data: null
            });

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Resend response missing message ID'
            );
        });

        it('should throw when response data has no id', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockResolvedValue({
                data: {}
            });

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Resend response missing message ID'
            );
        });
    });

    describe('send - network error', () => {
        it('should wrap network errors with transport context', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockRejectedValue(new Error('Network timeout'));

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Network timeout'
            );
        });

        it('should handle non-Error thrown values', async () => {
            // Arrange
            const transport = new ResendEmailTransport(mockResend.client);
            const input = createTestInput();
            mockResend.sendMock.mockRejectedValue('string error');

            // Act & Assert
            await expect(transport.send(input)).rejects.toThrow(
                'Failed to send email via Resend: Unknown error'
            );
        });
    });
});
