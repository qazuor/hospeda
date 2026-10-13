/**
 * Unit test of the production composition of `getListingAccessPorts().billing`
 * (AC:B4:4, AC:B4:5, AC:B4:6, US:B4:3; contract §6.3, G13; HOS-1534 D-8): every
 * billing member is the real one billing supplies, and none comes from the
 * bootstrap assembler of `@repo/verticals`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    coverage: vi.fn(),
    retentionStopped: vi.fn(),
    canCharge: vi.fn(),
    onCoverageChanged: vi.fn(),
    emitCoverageChanged: vi.fn(),
    createApiBillingCoverage: vi.fn(),
    createApiBillingRetentionStopped: vi.fn(),
    createApiBillingCanCharge: vi.fn(),
    createBootstrapBillingForVerticals: vi.fn()
}));

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    return { ...createDbMock(), planCatalogModel: { tag: 'plan catalog model' } };
});

vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    createBootstrapBillingForVerticals: mocks.createBootstrapBillingForVerticals
}));

vi.mock('../../../src/utils/effective-set-cache', () => ({
    createApiEffectiveSetCache: () => ({ tag: 'effective set cache' })
}));

vi.mock('../../../src/utils/listing-access/bootstrap-coverage-reader', () => ({
    createBootstrapCoverageReader: () => ({ tag: 'trial-and-base reader' })
}));

vi.mock('../../../src/utils/listing-access/billing-coverage', () => ({
    createApiBillingCoverage: mocks.createApiBillingCoverage,
    createApiBillingRetentionStopped: mocks.createApiBillingRetentionStopped,
    createApiBillingCanCharge: mocks.createApiBillingCanCharge
}));

vi.mock('../../../src/utils/listing-access/coverage-notices', () => ({
    getCoverageNotices: () => ({
        onCoverageChanged: mocks.onCoverageChanged,
        emitCoverageChanged: mocks.emitCoverageChanged
    })
}));

import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';

beforeEach(() => {
    mocks.createApiBillingCoverage.mockReturnValue({ coverage: mocks.coverage });
    mocks.createApiBillingRetentionStopped.mockReturnValue({
        retentionStopped: mocks.retentionStopped
    });
    mocks.createApiBillingCanCharge.mockReturnValue({ canCharge: mocks.canCharge });
});

describe('AC:B4:4 AC:B4:5 AC:B4:6 US:B4:3 getListingAccessPorts().billing is real (D-8, G13)', () => {
    it('composes the five billing members from billing, with no bootstrap answer', () => {
        // Arrange / Act
        const { billing } = getListingAccessPorts();

        // Assert
        expect(billing).toEqual({
            coverage: mocks.coverage,
            retentionStopped: mocks.retentionStopped,
            canCharge: mocks.canCharge,
            onCoverageChanged: mocks.onCoverageChanged,
            emitCoverageChanged: mocks.emitCoverageChanged
        });
        expect(mocks.createBootstrapBillingForVerticals).not.toHaveBeenCalled();
        expect(mocks.createApiBillingCoverage).toHaveBeenCalledWith({
            reader: { tag: 'trial-and-base reader' }
        });
    });
});
