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

import { touristVipInheritance } from '../../../src/routes/billing-subscription/tourist-vip-inheritance';
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

describe("AC:B7:31 the provider notice receiver wires S7's Tourist VIP clause (HOS-1566)", () => {
    it('wires touristVipInheritance to the production inheritance port', () => {
        // Arrange / Act
        const ports = buildMercadoPagoNoticePorts();

        // Assert
        expect(ports.touristVipInheritance).toBe(touristVipInheritance);
        expect(typeof ports.touristVipInheritance.inherits).toBe('function');
    });
});
