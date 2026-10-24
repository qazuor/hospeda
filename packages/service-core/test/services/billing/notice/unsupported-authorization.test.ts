import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    read: vi.fn()
}));
vi.mock('@repo/logger', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/logger')>();
    return { ...original, createLogger: () => ({ error: doubles.error, warn: doubles.warn }) };
});
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        reconciliationInventoryModel: {
            ...original.reconciliationInventoryModel,
            findLinkByProviderId: async () => null
        },
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: () => ({ limit: async () => [] })
                })
            })
        })
    };
});

import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service.js';

const provider = {
    decodeNotice: vi.fn(async () => ({
        resourceKind: 'authorization',
        resourceId: 'foreign-auth',
        version: '1'
    })),
    readAuthorization: doubles.read
} as unknown as PaymentProvider;
const clock = { now: () => new Date('2026-10-24T12:00:00.000Z') };

function delivery() {
    return {
        channel: 'WEBHOOKS' as const,
        delivery: { headers: {}, body: '{}' }
    };
}

describe('unsupported unknown provider authorization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('TEST:1777:2 returns OK for an unsupported authorization and logs its own captured error', async () => {
        // Arrange
        doubles.read.mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNSUPPORTED',
                capability: 'read',
                message: 'unsupported shape',
                providerStatus: 'authorized',
                frequencyType: 'days'
            })
        );

        // Act
        const result = await processProviderNotice(delivery(), {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        });

        // Assert
        expect(result).toEqual({ ack: 'OK', outcome: 'UNSUPPORTED_AUTHORIZATION' });
        expect(doubles.error).toHaveBeenCalledTimes(1);
        const [logged, message, options] = doubles.error.mock.calls[0] ?? [];
        expect(logged).toBeInstanceOf(Error);
        expect(logged).toMatchObject({
            name: 'UnsupportedProviderAuthorizationError',
            authorizationId: 'foreign-auth',
            providerStatus: 'authorized',
            frequencyType: 'days',
            correlationId: expect.any(String),
            cause: expect.objectContaining({ code: 'UNSUPPORTED' })
        });
        expect(message).toContain('Ignored unsupported foreign provider authorization');
        expect(options).toEqual({ capture: true });
    });

    it('keeps an unavailable provider read as an error acknowledgment', async () => {
        // Arrange
        doubles.read.mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'read',
                message: 'offline'
            })
        );

        // Act
        const result = await processProviderNotice(delivery(), {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        });

        // Assert
        expect(result).toEqual({ ack: 'ERROR', outcome: 'FAILED' });
    });
});
