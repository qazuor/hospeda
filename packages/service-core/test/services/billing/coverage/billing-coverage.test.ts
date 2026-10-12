import type { CoverageResponse, CoverageSource } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAddonSources } from '../../../../src/services/billing/coverage/addon-sources';
import { createBillingCoverage } from '../../../../src/services/billing/coverage/billing-coverage';
import {
    type BillingCoveragePorts,
    unregisteredListingQuery
} from '../../../../src/services/billing/coverage/coverage-ports';
import { resolveSubscriptionSources } from '../../../../src/services/billing/coverage/subscription-sources';

vi.mock('../../../../src/services/billing/coverage/subscription-sources', () => ({
    resolveSubscriptionSources: vi.fn()
}));
vi.mock('../../../../src/services/billing/coverage/addon-sources', () => ({
    resolveAddonSources: vi.fn()
}));

const userId = '11111111-1111-4111-8111-111111111111';
const since = new Date('2026-10-01T00:00:00.000Z');

const baseSource: CoverageSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'floor-version' },
    scope: 'VERTICAL',
    target: null,
    since,
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

const subscriptionSource = (planVersionId: string): CoverageSource => ({
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId },
    scope: 'VERTICAL',
    target: null,
    since,
    until: 'NO_KNOWN_DATE',
    charged: false,
    floor: null
});

const addonSource: CoverageSource = {
    type: 'ADDON',
    reference: { kind: 'ADDON_VERSION', addonVersionId: 'addon-version' },
    scope: 'USER',
    target: null,
    since,
    until: 'NO_KNOWN_DATE',
    charged: null,
    floor: null
};

function fakePorts(trialAndBase: CoverageResponse): BillingCoveragePorts {
    return {
        clock: { now: () => new Date('2026-10-12T00:00:00.000Z') },
        payments: { hasCreditedPayment: vi.fn(async () => false) },
        addonPolicy: vi.fn(async () => {
            throw new Error('addonPolicy is not reached: the addon resolver is faked');
        }),
        listing: unregisteredListingQuery.listing,
        trialAndBase: vi.fn(async () => trialAndBase)
    };
}

describe('billing real coverage assembler (AC:B4:1, AC:B4:7)', () => {
    beforeEach(() => {
        vi.mocked(resolveSubscriptionSources).mockReset();
        vi.mocked(resolveAddonSources).mockReset();
    });

    it('joins trial/BASE with the billing sources and is covered by a SUBSCRIPTION', async () => {
        // Arrange
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({
            sources: [subscriptionSource('plan-version')]
        });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [addonSource] });
        const ports = fakePorts({ covered: false, sources: [baseSource] });

        // Act
        const response = await createBillingCoverage({ ports }).coverage({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });

        // Assert
        expect(response).toEqual({
            covered: true,
            sources: [baseSource, subscriptionSource('plan-version'), addonSource]
        });
        expect(ports.trialAndBase).toHaveBeenCalledWith({
            userId,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(resolveSubscriptionSources).toHaveBeenCalledWith(
            expect.objectContaining({ userId, vertical: VerticalEnum.ACCOMMODATION, ports })
        );
        expect(resolveAddonSources).toHaveBeenCalledWith(
            expect.objectContaining({ userId, vertical: VerticalEnum.ACCOMMODATION, ports })
        );
    });

    it('is not covered with only BASE and an ADDON: a COMPLEMENT does not cover (§2.4)', async () => {
        // Arrange
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({ sources: [] });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [addonSource] });

        // Act
        const response = await createBillingCoverage({
            ports: fakePorts({ covered: false, sources: [baseSource] })
        }).coverage({ userId, vertical: VerticalEnum.GASTRONOMY });

        // Assert
        expect(response).toEqual({ covered: false, sources: [baseSource, addonSource] });
    });

    it('never emits COURTESY or GRANT sources in this cut (B9a plugs them in)', async () => {
        // Arrange
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({ sources: [] });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [] });

        // Act
        const response = await createBillingCoverage({
            ports: fakePorts({ covered: false, sources: [baseSource] })
        }).coverage({ userId, vertical: VerticalEnum.ACCOMMODATION });

        // Assert
        expect(response.sources.map((source) => source.type)).toEqual(['BASE']);
    });

    it('refuses to deliver an invalid response: two SUBSCRIPTION sources of class TITLE', async () => {
        // Arrange
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({
            sources: [subscriptionSource('plan-version-a'), subscriptionSource('plan-version-b')]
        });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [] });

        // Act
        const coverage = createBillingCoverage({
            ports: fakePorts({ covered: false, sources: [baseSource] })
        }).coverage({ userId, vertical: VerticalEnum.ACCOMMODATION });

        // Assert
        await expect(coverage).rejects.toThrow(/two SUBSCRIPTION sources/);
    });

    it('rejects an argument without a valid vertical', async () => {
        // Arrange
        const ports = fakePorts({ covered: false, sources: [baseSource] });

        // Act
        const coverage = createBillingCoverage({ ports }).coverage({
            userId,
            vertical: 'nowhere' as unknown as VerticalEnum
        });

        // Assert
        await expect(coverage).rejects.toThrow();
        expect(ports.trialAndBase).not.toHaveBeenCalled();
    });

    it('fails visibly through the unregistered listing query port (X-1)', async () => {
        // Act
        const listing = unregisteredListingQuery.listing({ listingId: 'listing-1' });

        // Assert
        await expect(listing).rejects.toMatchObject({
            code: 'INTERNAL_ERROR',
            reason: 'LISTING_QUERY_NOT_REGISTERED'
        });
    });
});
