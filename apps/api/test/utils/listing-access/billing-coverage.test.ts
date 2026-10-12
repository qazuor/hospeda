/**
 * Unit test of the production ports of billing's real coverage (HOS-1532 I-1,
 * X-1): each port is the one the composition root must pass, the clock is read
 * lazily on every call, and `ficha` fails visibly until V6.13 registers it.
 */

import { planCatalogModel } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { creditedPaymentsFromLedger } from '@repo/service-core';
import type { BootstrapCoverageReader } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import {
    buildBillingCoveragePorts,
    createApiBillingCoverage
} from '../../../src/utils/listing-access/billing-coverage';

const mocks = vi.hoisted(() => ({
    addonPolicy: vi.fn(),
    createPlanCatalogInverse: vi.fn(),
    resolveTrialAndBaseSources: vi.fn(),
    createBillingCoverage: vi.fn()
}));

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    return { ...createDbMock(), planCatalogModel: { tag: 'plan catalog model' } };
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
        )
    };
});

const reader = { tag: 'trial-and-base reader' } as unknown as BootstrapCoverageReader;

beforeEach(() => {
    mocks.createPlanCatalogInverse.mockReset().mockReturnValue({ addonPolicy: mocks.addonPolicy });
    mocks.resolveTrialAndBaseSources.mockReset();
    mocks.createBillingCoverage.mockClear();
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

    it('fails visibly on `ficha` until V6.13 registers it', async () => {
        const { ports } = buildBillingCoveragePorts({ reader });

        await expect(
            ports.listing({ listingId: '22222222-2222-4222-8222-222222222222' })
        ).rejects.toMatchObject({ reason: 'LISTING_QUERY_NOT_REGISTERED' });
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
