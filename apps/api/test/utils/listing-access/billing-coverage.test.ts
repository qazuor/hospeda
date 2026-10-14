/**
 * Unit test of the production ports of billing's real coverage (HOS-1532 I-1,
 * X-1): each port is the one the composition root must pass, the clock is read
 * lazily on every call, and `ficha` is the real query of verticals over the
 * listing reader (AC:V6:26, HOS-1483).
 */

import { planCatalogModel } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { creditedPaymentsFromLedger } from '@repo/service-core';
import type { BootstrapCoverageReader } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import {
    buildBillingCoveragePorts,
    createApiBillingCanCharge,
    createApiBillingCoverage,
    createApiBillingRetentionStopped
} from '../../../src/utils/listing-access/billing-coverage';

const mocks = vi.hoisted(() => ({
    addonPolicy: vi.fn(),
    createPlanCatalogInverse: vi.fn(),
    resolveTrialAndBaseSources: vi.fn(),
    createBillingCoverage: vi.fn(),
    createBillingCanCharge: vi.fn(),
    createBillingRetentionStopped: vi.fn(),
    findListingsById: vi.fn()
}));

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    return {
        ...createDbMock(),
        planCatalogModel: { tag: 'plan catalog model' },
        listingContractModel: { findListingsById: mocks.findListingsById }
    };
});

vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    createPlanCatalogInverse: mocks.createPlanCatalogInverse,
    resolveTrialAndBaseSources: mocks.resolveTrialAndBaseSources
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        createBillingCoverage: mocks.createBillingCoverage.mockImplementation(
            original.createBillingCoverage
        ),
        createBillingCanCharge: mocks.createBillingCanCharge.mockImplementation(
            original.createBillingCanCharge
        ),
        createBillingRetentionStopped: mocks.createBillingRetentionStopped.mockImplementation(
            original.createBillingRetentionStopped
        )
    };
});

const reader = { tag: 'trial-and-base reader' } as unknown as BootstrapCoverageReader;

beforeEach(() => {
    mocks.createPlanCatalogInverse.mockReset().mockReturnValue({ addonPolicy: mocks.addonPolicy });
    mocks.resolveTrialAndBaseSources.mockReset();
    mocks.createBillingCoverage.mockClear();
    mocks.createBillingCanCharge.mockClear();
    mocks.createBillingRetentionStopped.mockClear();
    mocks.findListingsById.mockReset();
});

describe('buildBillingCoveragePorts', () => {
    it('reads the injected clock on every call, never when the ports are built', () => {
        injectClock({ clock: { now: () => new Date('2026-01-01T00:00:00.000Z') } });
        const { ports } = buildBillingCoveragePorts({ reader });

        const later = new Date('2026-10-12T12:00:00.000Z');
        injectClock({ clock: { now: () => later } });

        expect(ports.clock.now()).toEqual(later);
    });

    it('answers `cobrada` from the payment ledger', () => {
        const { ports } = buildBillingCoveragePorts({ reader });

        expect(ports.payments).toBe(creditedPaymentsFromLedger);
    });

    it('answers `políticaDeAddon` from the plan catalog inverse over the catalog model', () => {
        const { ports } = buildBillingCoveragePorts({ reader });

        expect(mocks.createPlanCatalogInverse).toHaveBeenCalledWith({ reader: planCatalogModel });
        expect(ports.addonPolicy).toBe(mocks.addonPolicy);
    });

    it('resolves trial and BASE through verticals with the given reader', async () => {
        const answer = { covered: false, sources: [] };
        mocks.resolveTrialAndBaseSources.mockResolvedValue(answer);
        const { ports } = buildBillingCoveragePorts({ reader });
        const input = {
            userId: '11111111-1111-4111-8111-111111111111',
            vertical: VerticalEnum.ACCOMMODATION
        };

        await expect(ports.trialAndBase(input)).resolves.toBe(answer);
        expect(mocks.resolveTrialAndBaseSources).toHaveBeenCalledWith({ reader, input });
    });

    it('AC:V6:26 answers `ficha` from the real listing query over the listing reader', async () => {
        const listingId = '22222222-2222-4222-8222-222222222222';
        const ownerId = '33333333-3333-4333-8333-333333333333';
        mocks.findListingsById.mockResolvedValue([
            { vertical: 'gastronomy', ownerId, publicationStatus: 'PUBLISHED' }
        ]);
        const { ports } = buildBillingCoveragePorts({ reader });

        await expect(ports.listing({ listingId })).resolves.toEqual({
            vertical: VerticalEnum.GASTRONOMY,
            ownerId,
            acceptsFeature: true
        });
        expect(mocks.findListingsById).toHaveBeenCalledWith({ listingId });
    });
});

describe('createApiBillingCoverage', () => {
    it('assembles the real coverage over the production ports', () => {
        const billing = createApiBillingCoverage({ reader });

        expect(typeof billing.coverage).toBe('function');
        expect(mocks.createBillingCoverage).toHaveBeenCalledWith({
            ports: expect.objectContaining({
                payments: creditedPaymentsFromLedger,
                addonPolicy: mocks.addonPolicy
            })
        });
    });
});

describe('AC:B4:5 AC:B4:6 US:B4:3 createApiBillingCanCharge', () => {
    it("assembles billing's real canCharge, with the deadlines in force and a lazy clock", () => {
        // Arrange
        injectClock({ clock: { now: () => new Date('2026-01-01T00:00:00.000Z') } });

        // Act
        const billing = createApiBillingCanCharge();
        const later = new Date('2026-10-12T12:00:00.000Z');
        injectClock({ clock: { now: () => later } });

        // Assert
        expect(typeof billing.canCharge).toBe('function');
        expect(mocks.createBillingCanCharge).toHaveBeenCalledTimes(1);
        const [{ ports }] = mocks.createBillingCanCharge.mock.calls[0] as [
            { ports: { clock: { now(): Date }; deadlines?: unknown } }
        ];
        expect(Object.keys(ports)).toEqual(['clock']);
        expect(ports.clock.now()).toEqual(later);
    });
});

describe('AC:B4:4 createApiBillingRetentionStopped', () => {
    it("assembles billing's real retentionStopped with a lazy clock", () => {
        // Arrange
        injectClock({ clock: { now: () => new Date('2026-01-01T00:00:00.000Z') } });

        // Act
        const billing = createApiBillingRetentionStopped();
        const later = new Date('2026-10-12T12:00:00.000Z');
        injectClock({ clock: { now: () => later } });

        // Assert
        expect(typeof billing.retentionStopped).toBe('function');
        expect(mocks.createBillingRetentionStopped).toHaveBeenCalledTimes(1);
        const [{ ports }] = mocks.createBillingRetentionStopped.mock.calls[0] as [
            { ports: { clock: { now(): Date } } }
        ];
        expect(Object.keys(ports)).toEqual(['clock']);
        expect(ports.clock.now()).toEqual(later);
    });
});
