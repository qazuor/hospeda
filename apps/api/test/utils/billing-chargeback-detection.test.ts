/**
 * TEST:B7:7 AC:B7:10 the API builder assembles the COMPLETE detection: S14's
 * mark port plus S6's suspension port. The behavioral proof (a charged_back
 * payment of an ACTIVE row produces SUSPENDED) needs the database and lives in
 * `test/integration/webhooks/mercadopago-chargeback.test.ts`; here we prove the
 * shape of the port it builds and run `detect` on its non-database path.
 */
import { describe, expect, it, vi } from 'vitest';

const { detectionPorts } = vi.hoisted(() => ({ detectionPorts: [] as unknown[] }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        createChargebackDetection: (ports: unknown) => {
            detectionPorts.push(ports);
            return original.createChargebackDetection(
                ports as Parameters<typeof original.createChargebackDetection>[0]
            );
        }
    };
});
vi.mock('../../src/utils/payment-provider', () => ({
    getPaymentProvider: () => ({ readAuthorization: vi.fn() })
}));
vi.mock('../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-12T12:00:00.000Z') } })
}));
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return { ...createDbMock(), planCatalogModel: {} };
});

import { buildChargebackDetection } from '../../src/utils/billing-chargeback-detection';

function markPayments() {
    return { hang: vi.fn(), countUnresolved: vi.fn() };
}

describe('TEST:B7:7 AC:B7:10 the API builder wires the complete chargeback detection', () => {
    it('passes the caller mark port and the S6 suspension port to the detection', () => {
        // Arrange
        const marks = markPayments();

        // Act
        const detection = buildChargebackDetection({ markPayments: marks });

        // Assert
        expect(typeof detection.detect).toBe('function');
        const ports = detectionPorts.at(-1) as {
            markPayments?: unknown;
            suspension?: { suspend?: unknown };
        };
        expect(ports.markPayments).toBe(marks);
        expect(typeof ports.suspension?.suspend).toBe('function');
    });

    it('executes detect and answers NOT_APPLICABLE for a payment with no subscription', async () => {
        // Arrange
        const detection = buildChargebackDetection({ markPayments: markPayments() });

        // Act
        const result = await detection.detect({
            payment: {
                id: crypto.randomUUID(),
                subscriptionId: null,
                status: 'SUCCEEDED'
            },
            actor: 'provider',
            correlationId: crypto.randomUUID()
        });

        // Assert
        expect(result).toEqual({ outcome: 'NOT_APPLICABLE' });
    });
});
