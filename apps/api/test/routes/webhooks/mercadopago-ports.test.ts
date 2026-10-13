import { providerLinkCancellationSeen } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/payment-provider', () => ({
    getPaymentProvider: () => ({ readAuthorization: vi.fn() })
}));
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    return { ...createDbMock(), planCatalogModel: {} };
});
vi.mock('../../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-12T12:00:00.000Z') } })
}));

import { buildMercadoPagoNoticePorts } from '../../../src/routes/webhooks/mercadopago-ports';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';

describe('TEST:B4:2 the provider notice receiver notifies the process-wide registry (HOS-1533)', () => {
    it('wires coverageNotices to the same instance getCoverageNotices() returns', () => {
        // Arrange / Act
        const ports = buildMercadoPagoNoticePorts();

        // Assert
        expect(ports.coverageNotices).toBe(getCoverageNotices());
    });
});

describe('AC:B4:11 the provider notice receiver annotates the cancellation seen in production (HOS-1534)', () => {
    it('wires cancellationSeen to the real provider_link annotator', () => {
        // Arrange / Act
        const ports = buildMercadoPagoNoticePorts();

        // Assert
        expect(ports.cancellationSeen).toBe(providerLinkCancellationSeen);
        expect(Object.keys(ports).sort()).toEqual(
            [
                'beforeCancelNotice',
                'cancellationSeen',
                'clock',
                'coverageNotices',
                'payments',
                'planPolicy',
                'provider'
            ].sort()
        );
    });
});
