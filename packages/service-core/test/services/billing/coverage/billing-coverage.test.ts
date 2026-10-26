import type { CoverageResponse, CoverageSource } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAddonSources } from '../../../../src/services/billing/coverage/addon-sources';
import { createBillingCoverage } from '../../../../src/services/billing/coverage/billing-coverage';
import { resolveCourtesySources } from '../../../../src/services/billing/coverage/courtesy-sources';
import type { BillingCoveragePorts } from '../../../../src/services/billing/coverage/coverage-ports';
import { resolveGrantSources } from '../../../../src/services/billing/coverage/grant-sources';
import { resolveSubscriptionSources } from '../../../../src/services/billing/coverage/subscription-sources';

vi.mock('../../../../src/services/billing/coverage/subscription-sources', () => ({
    resolveSubscriptionSources: vi.fn()
}));
vi.mock('../../../../src/services/billing/coverage/addon-sources', () => ({
    resolveAddonSources: vi.fn()
}));
vi.mock('../../../../src/services/billing/coverage/courtesy-sources', () => ({
    resolveCourtesySources: vi.fn(async () => ({ sources: [] }))
}));
vi.mock('../../../../src/services/billing/coverage/grant-sources', () => ({
    resolveGrantSources: vi.fn(async () => ({ sources: [] }))
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
        listing: vi.fn(async () => {
            throw new Error('listing is not reached: no LISTING addon is resolved');
        }),
        trialAndBase: vi.fn(async () => trialAndBase)
    };
}

describe('billing real coverage assembler (AC:B4:1, AC:B4:7)', () => {
    beforeEach(() => {
        vi.mocked(resolveSubscriptionSources).mockReset();
        vi.mocked(resolveAddonSources).mockReset();
        vi.mocked(resolveCourtesySources).mockReset().mockResolvedValue({ sources: [] });
        vi.mocked(resolveGrantSources).mockReset().mockResolvedValue({ sources: [] });
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
        }).coverage({ userId, vertical: VerticalEnum.VENUE });

        // Assert
        expect(response).toEqual({ covered: false, sources: [baseSource, addonSource] });
    });

    it('emits no COURTESY or GRANT source when the person holds neither', async () => {
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

    it('composes COURTESY and GRANT between SUBSCRIPTION and ADDON (TEST:B9a:12)', async () => {
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({
            sources: [subscriptionSource('plan-version')]
        });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [addonSource] });
        const courtesy: CoverageSource = {
            type: 'COURTESY', reference: { kind: 'PLAN_VERSION', planVersionId: 'courtesy-version' },
            scope: 'VERTICAL', target: null, since, until: new Date('2027-01-01T00:00:00Z'), charged: null, floor: null
        };
        const grant: CoverageSource = {
            type: 'GRANT', reference: { kind: 'PLAN_VERSION', planVersionId: 'grant-floor' },
            scope: 'VERTICAL', target: null, since, until: 'NEVER_EXPIRES', charged: null, floor: 'grant-floor'
        };
        vi.mocked(resolveCourtesySources).mockResolvedValue({ sources: [courtesy] });
        vi.mocked(resolveGrantSources).mockResolvedValue({ sources: [grant] });
        const result = await createBillingCoverage({ ports: fakePorts({ covered: false, sources: [baseSource] }) })
            .coverage({ userId, vertical: VerticalEnum.ACCOMMODATION });
        expect(result.sources).toEqual([baseSource, subscriptionSource('plan-version'), courtesy, grant, addonSource]);
    });

    it('a GRANT source with BASE is covered (TEST:B9a:12)', async () => {
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({ sources: [] });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [] });
        vi.mocked(resolveGrantSources).mockResolvedValue({ sources: [{
            type: 'GRANT', reference: { kind: 'PLAN_VERSION', planVersionId: 'grant-floor' },
            scope: 'VERTICAL', target: null, since, until: 'NEVER_EXPIRES', charged: null, floor: 'grant-floor'
        }] });
        const response = await createBillingCoverage({ ports: fakePorts({ covered: false, sources: [baseSource] }) })
            .coverage({ userId, vertical: VerticalEnum.ACCOMMODATION });
        expect(response.covered).toBe(true);
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
});
