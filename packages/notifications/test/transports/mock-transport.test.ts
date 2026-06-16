/**
 * MockEmailTransport Test Suite
 *
 * Full coverage for the in-memory mock email transport used in tests.
 * Validates: successful sends, failure mode, message ID format,
 * sentEmails accumulation, getLastEmail(), and reset().
 *
 * @module test/transports/mock-transport.test
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { SendEmailInput } from '../../src/transports/email/email-transport.interface.js';
import { MockEmailTransport } from '../../src/transports/email/mock-transport.js';

function makeSendInput(overrides?: Partial<SendEmailInput>): SendEmailInput {
    return {
        to: 'test@example.com',
        subject: 'Test Subject',
        react: {} as never,
        ...overrides
    };
}

describe('MockEmailTransport', () => {
    describe('constructor', () => {
        it('should initialise with empty sentEmails array when no options given', () => {
            // Arrange & Act
            const transport = new MockEmailTransport();

            // Assert
            expect(transport.sentEmails).toEqual([]);
        });

        it('should initialise with shouldFail=false by default', async () => {
            // Arrange
            const transport = new MockEmailTransport();

            // Act — no throw expected
            const result = await transport.send(makeSendInput());

            // Assert
            expect(result.messageId).toBeTruthy();
        });

        it('should accept shouldFail option', async () => {
            // Arrange
            const transport = new MockEmailTransport({ shouldFail: true });

            // Act & Assert
            await expect(transport.send(makeSendInput())).rejects.toThrow(
                'Mock email transport configured to fail'
            );
        });

        it('should use custom failureMessage when provided', async () => {
            // Arrange
            const transport = new MockEmailTransport({
                shouldFail: true,
                failureMessage: 'Custom failure'
            });

            // Act & Assert
            await expect(transport.send(makeSendInput())).rejects.toThrow('Custom failure');
        });
    });

    describe('send', () => {
        let transport: MockEmailTransport;

        beforeEach(() => {
            transport = new MockEmailTransport();
        });

        it('should store sent email in sentEmails array', async () => {
            // Arrange
            const input = makeSendInput({ to: 'user@example.com', subject: 'Hello' });

            // Act
            await transport.send(input);

            // Assert
            expect(transport.sentEmails).toHaveLength(1);
            expect(transport.sentEmails[0]).toBe(input);
        });

        it('should accumulate multiple sends in order', async () => {
            // Arrange
            const inputs = [
                makeSendInput({ to: 'a@example.com' }),
                makeSendInput({ to: 'b@example.com' }),
                makeSendInput({ to: 'c@example.com' })
            ];

            // Act
            for (const input of inputs) {
                await transport.send(input);
            }

            // Assert
            expect(transport.sentEmails).toHaveLength(3);
            expect(transport.sentEmails[0]?.to).toBe('a@example.com');
            expect(transport.sentEmails[1]?.to).toBe('b@example.com');
            expect(transport.sentEmails[2]?.to).toBe('c@example.com');
        });

        it('should return a messageId with mock- prefix', async () => {
            // Arrange
            const input = makeSendInput();

            // Act
            const result = await transport.send(input);

            // Assert
            expect(result.messageId).toMatch(/^mock-\d+-\d+$/);
        });

        it('should return incrementing sequence numbers in messageId', async () => {
            // Arrange & Act
            const r1 = await transport.send(makeSendInput());
            const r2 = await transport.send(makeSendInput());
            const r3 = await transport.send(makeSendInput());

            // Extract sequence number (last part after second dash)
            const seq = (id: string) => Number(id.split('-').at(-1));

            // Assert — each send appends after stored emails so counter increments
            expect(seq(r1.messageId)).toBe(1);
            expect(seq(r2.messageId)).toBe(2);
            expect(seq(r3.messageId)).toBe(3);
        });

        it('should throw default error message when shouldFail is true', async () => {
            // Arrange
            const failingTransport = new MockEmailTransport({ shouldFail: true });

            // Act & Assert
            await expect(failingTransport.send(makeSendInput())).rejects.toThrow(
                'Mock email transport configured to fail'
            );
        });

        it('should throw custom error message when failureMessage is provided', async () => {
            // Arrange
            const failingTransport = new MockEmailTransport({
                shouldFail: true,
                failureMessage: 'Simulated SMTP error'
            });

            // Act & Assert
            await expect(failingTransport.send(makeSendInput())).rejects.toThrow(
                'Simulated SMTP error'
            );
        });

        it('should not store email when shouldFail is true', async () => {
            // Arrange
            const failingTransport = new MockEmailTransport({ shouldFail: true });

            // Act
            try {
                await failingTransport.send(makeSendInput());
            } catch {
                // expected
            }

            // Assert — nothing was stored
            expect(failingTransport.sentEmails).toHaveLength(0);
        });
    });

    describe('getLastEmail', () => {
        it('should return undefined when no emails have been sent', () => {
            // Arrange
            const transport = new MockEmailTransport();

            // Act & Assert
            expect(transport.getLastEmail()).toBeUndefined();
        });

        it('should return the most recently sent email', async () => {
            // Arrange
            const transport = new MockEmailTransport();
            const first = makeSendInput({ subject: 'First' });
            const second = makeSendInput({ subject: 'Second' });

            await transport.send(first);
            await transport.send(second);

            // Act
            const last = transport.getLastEmail();

            // Assert
            expect(last).toBe(second);
            expect(last?.subject).toBe('Second');
        });

        it('should return the single email when only one was sent', async () => {
            // Arrange
            const transport = new MockEmailTransport();
            const input = makeSendInput({ to: 'single@example.com' });
            await transport.send(input);

            // Act & Assert
            expect(transport.getLastEmail()).toBe(input);
        });
    });

    describe('reset', () => {
        it('should clear all stored emails', async () => {
            // Arrange
            const transport = new MockEmailTransport();
            await transport.send(makeSendInput());
            await transport.send(makeSendInput());
            expect(transport.sentEmails).toHaveLength(2);

            // Act
            transport.reset();

            // Assert
            expect(transport.sentEmails).toHaveLength(0);
        });

        it('should allow sending emails again after reset', async () => {
            // Arrange
            const transport = new MockEmailTransport();
            await transport.send(makeSendInput({ subject: 'Before reset' }));
            transport.reset();

            // Act
            await transport.send(makeSendInput({ subject: 'After reset' }));

            // Assert
            expect(transport.sentEmails).toHaveLength(1);
            expect(transport.sentEmails[0]?.subject).toBe('After reset');
        });

        it('should make getLastEmail return undefined after reset', async () => {
            // Arrange
            const transport = new MockEmailTransport();
            await transport.send(makeSendInput());

            // Act
            transport.reset();

            // Assert
            expect(transport.getLastEmail()).toBeUndefined();
        });

        it('should be safe to call reset on an already-empty transport', () => {
            // Arrange
            const transport = new MockEmailTransport();

            // Act & Assert — no throw
            expect(() => transport.reset()).not.toThrow();
            expect(transport.sentEmails).toHaveLength(0);
        });
    });
});
