import {
    providerLinkCancellationSeen,
    unregisteredPromoChargePolicy,
    unregisteredPromoExhaustion
} from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

const { delegateInputs } = vi.hoisted(() => ({ delegateInputs: [] as unknown[] }));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        createProviderNoticeMirrorDelegates: (input: unknown) => {
            delegateInputs.push(input);
            return original.createProviderNoticeMirrorDelegates(
                input as Parameters<typeof original.createProviderNoticeMirrorDelegates>[0]
            );
        }
    };
});

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

describe('AC:B4:11 the provider notice receiver annotates the cancellation seen in production (HOS-1534)', () => {
    it('wires cancellationSeen to the real provider_link annotator', () => {
        // Arrange / Act
        const ports = buildMercadoPagoNoticePorts();

        // Assert
        expect(ports.cancellationSeen).toBe(providerLinkCancellationSeen);
        expect(typeof ports.complements.addonPolicy).toBe('function');
        expect(typeof ports.complements.listing).toBe('function');
        expect(ports.complements.liveAnchors).toBeDefined();
        expect(delegateInputs.at(-1)).toMatchObject({ complements: ports.complements });
        expect(Object.keys(ports).sort()).toEqual(
            [
                'beforeCancelNotice',
                'cancellationSeen',
                'clock',
                'coverageNotices',
                'complements',
                'delegates',
                'markPayments',
                'payments',
                'planPolicy',
                'provider',
                'promoCharges',
                'promoExhaustion',
                'touristVipInheritance'
            ].sort()
        );
    });
});

describe('TEST:HOS-1589:1 production webhook ports register promo services', () => {
    it('does not expose either unregistered promo default', () => {
        const ports = buildMercadoPagoNoticePorts();
        expect(ports.promoCharges).not.toBe(unregisteredPromoChargePolicy);
        expect(ports.promoExhaustion).not.toBe(unregisteredPromoExhaustion);
    });
});

/** Runs one delegate call and returns what it threw, or `undefined` when it resolved. */
async function delegateError(
    pair:
        | 'RESUME_MIRROR'
        | 'CANCELLED_ON_GRACE'
        | 'PROVIDER_PAUSE_IS_ARREARS'
        | 'LIVE_PREAPPROVAL_ON_CLOSED_ROW'
) {
    const ports = buildMercadoPagoNoticePorts();
    try {
        await ports.delegates.delegate({
            pair,
            subscriptionId: '00000000-0000-4000-8000-000000000001',
            readAt: new Date('2026-10-12T12:00:00.000Z'),
            cancelledSeenAt: null
        });
        return undefined;
    } catch (error) {
        return error;
    }
}

describe('AC:1676:6 the provider notice receiver registers the mirror delegates and the mark payments (HOS-1676)', () => {
    it('wires markPayments to a real ledger port', () => {
        // Arrange / Act
        const ports = buildMercadoPagoNoticePorts();

        // Assert
        expect(typeof ports.markPayments.hang).toBe('function');
        expect(typeof ports.delegates.delegate).toBe('function');
    });

    it('keeps RESUME_MIRROR unregistered: it still throws MIRROR_PAIR_NOT_REGISTERED (H-1)', async () => {
        // Arrange / Act
        const error = await delegateError('RESUME_MIRROR');

        // Assert
        expect(error).toMatchObject({ reason: 'MIRROR_PAIR_NOT_REGISTERED' });
    });

    it.each([
        'CANCELLED_ON_GRACE',
        'PROVIDER_PAUSE_IS_ARREARS',
        'LIVE_PREAPPROVAL_ON_CLOSED_ROW'
    ] as const)('registers %s: whatever the mocked database does, it is not MIRROR_PAIR_NOT_REGISTERED', async (pair) => {
        // Arrange / Act
        const error = await delegateError(pair);

        // Assert
        expect((error as { reason?: unknown } | undefined)?.reason).not.toBe(
            'MIRROR_PAIR_NOT_REGISTERED'
        );
    });
});
