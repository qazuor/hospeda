/**
 * EmailAlertChannel Test Suite
 *
 * Covers the email delivery channel for the alerts & offers daily digest
 * (SPEC-286 T-008):
 * - Sends via the injected EmailTransport when there is at least one item.
 * - Skips sending silently when both priceDrop and promoOffers are empty.
 * - Logs success with the returned messageId.
 *
 * @module test/services/channels/email-alert.channel.test
 */

import type { ILogger } from '@repo/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailAlertChannel } from '../../../src/services/channels/email-alert.channel.js';
import { MockEmailTransport } from '../../../src/transports/email/mock-transport.js';
import type { AlertDigestPayload, PriceDropMatch } from '../../../src/types/alert.types.js';

function makePriceDropMatch(overrides?: Partial<PriceDropMatch>): PriceDropMatch {
    return {
        alertId: 'alert-1',
        userId: 'user-1',
        accommodationId: 'accommodation-1',
        accommodationSlug: 'cabana-del-rio',
        accommodationName: 'Cabaña del Río',
        basePriceSnapshot: 10000,
        currentPrice: 8000,
        dropPercent: 20,
        currency: 'ARS',
        ...overrides
    };
}

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

function makeLogger(): ILogger {
    return {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    } as unknown as ILogger;
}

describe('EmailAlertChannel', () => {
    let transport: MockEmailTransport;
    let logger: ILogger;
    let channel: EmailAlertChannel;

    beforeEach(() => {
        transport = new MockEmailTransport();
        logger = makeLogger();
        channel = new EmailAlertChannel({ emailTransport: transport, logger });
    });

    describe('deliver', () => {
        it('should send an email when priceDrop has at least one item', async () => {
            // Arrange
            const payload = makePayload({ priceDrop: [makePriceDropMatch()] });

            // Act
            await channel.deliver(payload);

            // Assert
            expect(transport.sentEmails).toHaveLength(1);
            expect(transport.sentEmails[0]?.to).toBe('user@example.com');
        });

        it('should send an email when promoOffers has at least one item', async () => {
            // Arrange
            const payload = makePayload({
                promoOffers: [
                    {
                        promotionId: 'promo-1',
                        accommodationId: 'accommodation-1',
                        accommodationName: 'Cabaña del Río',
                        accommodationSlug: 'cabana-del-rio',
                        promotionTitle: '20% off',
                        discountType: 'percentage',
                        discountValue: 20,
                        validUntil: null
                    }
                ]
            });

            // Act
            await channel.deliver(payload);

            // Assert
            expect(transport.sentEmails).toHaveLength(1);
        });

        it('should not call the transport when both priceDrop and promoOffers are empty', async () => {
            // Arrange
            const payload = makePayload({ priceDrop: [], promoOffers: [] });

            // Act
            await channel.deliver(payload);

            // Assert
            expect(transport.sentEmails).toHaveLength(0);
        });

        it('should log success with the returned messageId', async () => {
            // Arrange
            const payload = makePayload({ priceDrop: [makePriceDropMatch()] });

            // Act
            await channel.deliver(payload);

            // Assert
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({ userId: payload.userId, messageId: expect.any(String) }),
                expect.any(String)
            );
        });

        it('should fall back to the Spanish subject for an unknown locale', async () => {
            // Arrange
            const payload = makePayload({ locale: 'fr', priceDrop: [makePriceDropMatch()] });

            // Act
            await channel.deliver(payload);

            // Assert
            expect(transport.sentEmails[0]?.subject).toBe('Tus alertas de precios y ofertas');
        });

        it('should propagate a transport failure so the caller can isolate it', async () => {
            // Arrange
            const failingTransport = new MockEmailTransport({ shouldFail: true });
            const failingChannel = new EmailAlertChannel({
                emailTransport: failingTransport,
                logger
            });
            const payload = makePayload({ priceDrop: [makePriceDropMatch()] });

            // Act & Assert
            await expect(failingChannel.deliver(payload)).rejects.toThrow();
        });
    });
});
