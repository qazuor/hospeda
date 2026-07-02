/**
 * AlertDigestDeliveryService Test Suite
 *
 * Covers channel-agnostic dispatch (SPEC-286 T-008):
 * - deliver() calls every injected channel.
 * - A channel throwing does not prevent other channels from being called
 *   (error isolation), and the error is logged with structured context.
 * - deliverBatch() delivers to every payload, preserving per-payload isolation.
 *
 * @module test/services/alert-delivery.service.test
 */

import type { ILogger } from '@repo/logger';
import { describe, expect, it, vi } from 'vitest';
import {
    AlertDigestDeliveryService,
    type NotificationChannel
} from '../../src/services/alert-delivery.service.js';
import type { AlertDigestPayload } from '../../src/types/alert.types.js';

function makePayload(overrides?: Partial<AlertDigestPayload>): AlertDigestPayload {
    return {
        userId: 'user-1',
        userEmail: 'user@example.com',
        locale: 'es',
        priceDrop: [],
        promoOffers: [],
        ...overrides
    };
}

function makeChannel(
    name: string,
    deliver = vi.fn().mockResolvedValue(undefined)
): NotificationChannel {
    return { name, deliver };
}

function makeLogger(): ILogger {
    return {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    } as unknown as ILogger;
}

describe('AlertDigestDeliveryService', () => {
    describe('deliver', () => {
        it('should call deliver() on every injected channel', async () => {
            // Arrange
            const emailChannel = makeChannel('email');
            const whatsappChannel = makeChannel('whatsapp');
            const logger = makeLogger();
            const service = new AlertDigestDeliveryService({
                channels: [emailChannel, whatsappChannel],
                logger
            });
            const payload = makePayload();

            // Act
            await service.deliver(payload);

            // Assert
            expect(emailChannel.deliver).toHaveBeenCalledTimes(1);
            expect(emailChannel.deliver).toHaveBeenCalledWith(payload);
            expect(whatsappChannel.deliver).toHaveBeenCalledTimes(1);
            expect(whatsappChannel.deliver).toHaveBeenCalledWith(payload);
        });

        it('should call the remaining channels when one channel throws (error isolation)', async () => {
            // Arrange
            const failingChannel = makeChannel(
                'failing',
                vi.fn().mockRejectedValue(new Error('provider down'))
            );
            const healthyChannel = makeChannel('healthy');
            const logger = makeLogger();
            const service = new AlertDigestDeliveryService({
                channels: [failingChannel, healthyChannel],
                logger
            });

            // Act
            await service.deliver(makePayload());

            // Assert
            expect(failingChannel.deliver).toHaveBeenCalledTimes(1);
            expect(healthyChannel.deliver).toHaveBeenCalledTimes(1);
        });

        it('should log a structured error when a channel throws', async () => {
            // Arrange
            const failingChannel = makeChannel(
                'failing',
                vi.fn().mockRejectedValue(new Error('provider down'))
            );
            const logger = makeLogger();
            const service = new AlertDigestDeliveryService({
                channels: [failingChannel],
                logger
            });
            const payload = makePayload({ userId: 'user-42' });

            // Act
            await service.deliver(payload);

            // Assert
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    channel: 'failing',
                    userId: 'user-42',
                    error: 'provider down'
                }),
                expect.any(String)
            );
        });

        it('should not throw when a channel rejects', async () => {
            // Arrange
            const failingChannel = makeChannel(
                'failing',
                vi.fn().mockRejectedValue(new Error('boom'))
            );
            const service = new AlertDigestDeliveryService({
                channels: [failingChannel],
                logger: makeLogger()
            });

            // Act & Assert
            await expect(service.deliver(makePayload())).resolves.toBeUndefined();
        });

        it("should not call any channel's deliver() as a no-op when there are zero channels", async () => {
            // Arrange
            const service = new AlertDigestDeliveryService({ channels: [], logger: makeLogger() });

            // Act & Assert
            await expect(service.deliver(makePayload())).resolves.toBeUndefined();
        });
    });

    describe('deliverBatch', () => {
        it('should call deliver() once per payload', async () => {
            // Arrange
            const emailChannel = makeChannel('email');
            const service = new AlertDigestDeliveryService({
                channels: [emailChannel],
                logger: makeLogger()
            });
            const payloads = [
                makePayload({ userId: 'user-1' }),
                makePayload({ userId: 'user-2' }),
                makePayload({ userId: 'user-3' })
            ];

            // Act
            await service.deliverBatch(payloads);

            // Assert
            expect(emailChannel.deliver).toHaveBeenCalledTimes(3);
            expect(emailChannel.deliver).toHaveBeenNthCalledWith(1, payloads[0]);
            expect(emailChannel.deliver).toHaveBeenNthCalledWith(2, payloads[1]);
            expect(emailChannel.deliver).toHaveBeenNthCalledWith(3, payloads[2]);
        });

        it('should continue processing remaining payloads when one payload delivery fails', async () => {
            // Arrange
            let callCount = 0;
            const flakyDeliver = vi.fn().mockImplementation(() => {
                callCount += 1;
                if (callCount === 2) {
                    return Promise.reject(new Error('transient failure'));
                }
                return Promise.resolve();
            });
            const flakyChannel = makeChannel('flaky', flakyDeliver);
            const service = new AlertDigestDeliveryService({
                channels: [flakyChannel],
                logger: makeLogger()
            });
            const payloads = [
                makePayload({ userId: 'user-1' }),
                makePayload({ userId: 'user-2' }),
                makePayload({ userId: 'user-3' })
            ];

            // Act
            await service.deliverBatch(payloads);

            // Assert
            expect(flakyDeliver).toHaveBeenCalledTimes(3);
        });
    });

    describe('empty payload guard (enforced by channels, not the orchestrator)', () => {
        it('should still invoke a channel with an empty payload — the empty-payload guard lives in the channel, not the orchestrator', async () => {
            // Arrange
            // AlertDigestDeliveryService is deliberately payload-agnostic: it does
            // not inspect priceDrop/promoOffers itself. The "skip when empty" rule
            // is enforced by each channel implementation (see EmailAlertChannel).
            const channel = makeChannel('email');
            const service = new AlertDigestDeliveryService({
                channels: [channel],
                logger: makeLogger()
            });
            const emptyPayload = makePayload({ priceDrop: [], promoOffers: [] });

            // Act
            await service.deliver(emptyPayload);

            // Assert
            expect(channel.deliver).toHaveBeenCalledWith(emptyPayload);
        });
    });
});
