/**
 * HOS-2398 — `get_my_plan` shows the Tourist VIP the owner holds by inheritance
 * (a live non-trial title whose plan version has `inherits_tourist_vip`) as its
 * own `inheritedTouristVip` block, apart from the owner's plan items.
 *
 * Real: the tool, `readMyPlan`, the labels (`@repo/i18n`), `toEffectiveSetView`,
 * the contract's coverage-source schema and the effective-set resolver
 * (`readEffectiveSet`, including `resolveTouristVipInheritance`) over the
 * in-test catalog of the shared harness. Mocked at their module boundary: the
 * plan-state, trial and add-on readers.
 *
 * @module test/mcp/tools/plan/get-my-plan.inherited-tourist-vip
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ACCOMMODATION_VERSION,
    arrangeSubscriptionAndTrial,
    catalog,
    context,
    coverageByVertical,
    mocks,
    NOW,
    ownerActor,
    realEffectiveSet,
    resetWorld,
    subscriptionRow,
    TOURIST_VIP_VERSION
} from './my-plan.harness';

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    readOwnPlanState: (...args: unknown[]) => mocks.readOwnPlanState(...args)
}));
vi.mock('../../../../src/services/billing-addon/owner-recurring-addons.service', () => ({
    readOwnerAddonHoldings: (...args: unknown[]) => mocks.readOwnerAddonHoldings(...args)
}));
vi.mock('../../../../src/services/listing-notices/listing-notices.service', () => ({
    readTrialSummary: (...args: unknown[]) => mocks.readTrialSummary(...args),
    readOwnTrialPlan: (...args: unknown[]) => mocks.readOwnTrialPlan(...args)
}));
vi.mock('../../../../src/utils/listing-access/ports', async () => {
    const { CoverageArgsSchema } = await import('@repo/billing-verticals-contract');
    return {
        getListingAccessPorts: () => ({
            effectiveSet: (...args: unknown[]) => mocks.effectiveSet(...args),
            billing: {
                coverage: (args: unknown) => {
                    CoverageArgsSchema.parse(args);
                    return mocks.coverage(args);
                }
            }
        })
    };
});
vi.mock('../../../../src/routes/plan-catalog/public/read-sellable-catalog', () => ({
    readSellablePlanCatalog: (...args: unknown[]) => mocks.readSellablePlanCatalog(...args)
}));
vi.mock('../../../../src/services/plan-catalog/plan-of-version.service', () => ({
    readPlanOfVersion: (...args: unknown[]) => mocks.readPlanOfVersion(...args)
}));

import { getMyPlanTool } from '../../../../src/mcp/tools/plan/get-my-plan';
import type { MyPlanResult } from '../../../../src/mcp/tools/plan/my-plan-types';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';
import { apiLogger } from '../../../../src/utils/logger';

/** The owner's own rows of the accommodation plan, `ai_chat` among them. */
const OWNER_ROWS = [
    { key: 'view_basic_stats', planQuota: null },
    { key: 'ai_chat', planQuota: null }
];

/** The tourist rows owner plans still carry before the catalog cleanup. */
const TOURIST_ROWS_ON_OWNER_PLAN = [
    { key: 'vip_promotions_access', planQuota: null },
    { key: 'vip_support', planQuota: null }
];

/** What the sellable tourist VIP version grants. */
function arrangeTouristVip(): void {
    catalog.set(TOURIST_VIP_VERSION, {
        entitlements: [
            { key: 'vip_promotions_access', planQuota: null },
            { key: 'vip_support', planQuota: null }
        ],
        limits: [{ key: 'max_favorites', value: 100 }]
    });
}

/** An active accommodation subscription on a version that does or does not inherit Tourist VIP. */
function arrangeAccommodation(input: {
    readonly inheritsTouristVip: boolean;
    readonly withTouristRows: boolean;
}): void {
    catalog.set(ACCOMMODATION_VERSION, {
        entitlements: [...OWNER_ROWS, ...(input.withTouristRows ? TOURIST_ROWS_ON_OWNER_PLAN : [])],
        limits: [{ key: 'max_photos_per_accommodation', value: 15 }],
        inheritsTouristVip: input.inheritsTouristVip
    });
    coverageByVertical.set('accommodation', ACCOMMODATION_VERSION);
    mocks.readOwnPlanState.mockResolvedValue({
        subscriptions: [subscriptionRow()],
        deferredCourtesies: []
    });
}

async function myPlan(input: Record<string, unknown> = {}): Promise<MyPlanResult> {
    const outcome = await runTool({
        definition: getMyPlanTool,
        actor: ownerActor(),
        input,
        context
    });
    if (!outcome.ok) {
        throw new Error(`get_my_plan refused: ${outcome.failure.message}`);
    }
    return outcome.data as MyPlanResult;
}

const EXPECTED_BLOCK = {
    note: 'Por tener un plan pago también tenés Turista VIP',
    entitlements: ['Soporte VIP', 'Acceso a promociones VIP'],
    limits: [{ label: 'Favoritos', value: 100 }]
};

describe('get_my_plan inherited Tourist VIP (HOS-2398)', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        resetWorld();
        arrangeTouristVip();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('inherited while the owner plan still has the tourist rows: the block is listed apart and the plan keeps ai_chat', async () => {
        // Arrange
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: true });

        // Act
        const result = await myPlan();

        // Assert
        expect(result.items.map((item) => item.vertical)).toEqual(['accommodation']);
        expect(result.items[0]?.includes?.entitlements).toContain(
            'Consultas sobre el alojamiento con IA'
        );
        expect(result.inheritedTouristVip).toEqual({
            note: EXPECTED_BLOCK.note,
            entitlements: expect.arrayContaining(EXPECTED_BLOCK.entitlements),
            limits: EXPECTED_BLOCK.limits
        });
        expect(result.inheritedTouristVip?.entitlements).toHaveLength(2);
        expect(result.inheritedTouristVip?.entitlements).not.toContain(
            'Consultas sobre el alojamiento con IA'
        );
    });

    it('inherited after the catalog cleanup (owner plan without the tourist rows): the same block', async () => {
        // Arrange
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: true });
        const before = await myPlan();
        resetWorld();
        arrangeTouristVip();
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: false });

        // Act
        const after = await myPlan();

        // Assert
        expect(after.inheritedTouristVip).toEqual(before.inheritedTouristVip);
        expect([...(after.items[0]?.includes?.entitlements ?? [])].sort()).toEqual(
            ['Consultas sobre el alojamiento con IA', 'Estadísticas básicas'].sort()
        );
    });

    it('not inherited: no block, and the plan includes are untouched', async () => {
        // Arrange
        arrangeAccommodation({ inheritsTouristVip: false, withTouristRows: true });

        // Act
        const result = await myPlan();

        // Assert
        expect(result).not.toHaveProperty('inheritedTouristVip');
        expect(result.items[0]?.includes?.entitlements).toEqual(
            expect.arrayContaining([
                'Estadísticas básicas',
                'Consultas sobre el alojamiento con IA',
                'Soporte VIP',
                'Acceso a promociones VIP'
            ])
        );
    });

    it('the tourist set cannot be read: no block, logged, and the plan still answers', async () => {
        // Arrange
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: false });
        mocks.effectiveSet.mockImplementation((args: { userId: string; vertical: string }) =>
            args.vertical === 'tourist'
                ? Promise.reject(new Error('redis down'))
                : realEffectiveSet(args)
        );
        const warn = vi.spyOn(apiLogger, 'warn');

        // Act
        const result = await myPlan();

        // Assert
        expect(result).not.toHaveProperty('inheritedTouristVip');
        expect(result.items[0]?.includes).not.toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ vertical: 'tourist', error: 'redis down' }),
            'get_my_plan: inherited Tourist VIP could not be read'
        );
    });

    it('a listed tourist item already shows it: no separate block', async () => {
        // Arrange: the owner also pays Tourist VIP directly
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: false });
        coverageByVertical.set('tourist', TOURIST_VIP_VERSION);
        mocks.readOwnPlanState.mockResolvedValue({
            subscriptions: [
                subscriptionRow(),
                subscriptionRow({
                    id: '77777777-7777-4777-8777-777777777777',
                    vertical: 'tourist',
                    planVersionId: TOURIST_VIP_VERSION,
                    plan: {
                        slug: 'tourist-vip',
                        name: 'Catalog tourist VIP',
                        amount: 1,
                        currency: 'ARS',
                        cycle: 'monthly'
                    }
                })
            ],
            deferredCourtesies: []
        });

        // Act
        const result = await myPlan();

        // Assert
        expect(result.items.map((item) => item.vertical)).toEqual(['accommodation', 'tourist']);
        expect(result).not.toHaveProperty('inheritedTouristVip');
    });

    it('asked only for tourist with no tourist item: the block still answers beside the empty items', async () => {
        // Arrange
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: false });

        // Act
        const result = await myPlan({ vertical: 'tourist' });

        // Assert
        expect(result.items).toEqual([]);
        expect(result.inheritedTouristVip?.note).toBe(EXPECTED_BLOCK.note);
    });

    it('labels the block in the user locale (en)', async () => {
        // Arrange
        arrangeAccommodation({ inheritsTouristVip: true, withTouristRows: false });

        // Act
        const outcome = await runTool({
            definition: getMyPlanTool,
            actor: ownerActor(),
            input: {},
            context: { ...context, locale: 'en' }
        });

        // Assert
        expect(outcome.ok).toBe(true);
        const data = (outcome as { data: MyPlanResult }).data;
        expect(data.inheritedTouristVip?.note).toBe(
            'Because you have a paid plan, you also have Tourist VIP'
        );
    });

    it('the tool description asks for the plan and the inherited Tourist VIP apart', () => {
        expect(getMyPlanTool.description).toContain('inheritedTouristVip');
        expect(getMyPlanTool.description).toContain('never merge them into one list');
    });
});

describe('get_my_plan trial Tourist VIP line (HOS-2398)', () => {
    const NOTE = 'Al pasar a un plan pago también tenés Turista VIP';

    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        resetWorld();
        // An ACTIVE accommodation subscription and a running venue trial.
        arrangeSubscriptionAndTrial();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('a trial whose vertical sells only versions that inherit: the line appears on the trial item only', async () => {
        // Arrange
        mocks.readSellablePlanCatalog.mockResolvedValue({
            plans: [{ inheritsTouristVip: true }, { inheritsTouristVip: true }]
        });

        // Act
        const result = await myPlan();

        // Assert
        const venue = result.items.find((item) => item.vertical === 'venue');
        const accommodation = result.items.find((item) => item.vertical === 'accommodation');
        expect(venue?.status).toBe('TRIAL');
        expect(venue?.touristVipOnUpgrade).toEqual({ note: NOTE });
        expect(accommodation?.status).toBe('ACTIVE');
        expect(accommodation).not.toHaveProperty('touristVipOnUpgrade');
        expect(mocks.readSellablePlanCatalog).toHaveBeenCalledTimes(1);
        expect(mocks.readSellablePlanCatalog).toHaveBeenCalledWith({ vertical: 'venue' });
    });

    it('sellable versions that do not inherit: no line', async () => {
        // Arrange
        mocks.readSellablePlanCatalog.mockResolvedValue({
            plans: [{ inheritsTouristVip: false }]
        });

        // Act
        const result = await myPlan();

        // Assert
        const venue = result.items.find((item) => item.vertical === 'venue');
        expect(venue?.status).toBe('TRIAL');
        expect(venue).not.toHaveProperty('touristVipOnUpgrade');
    });

    it('only some sellable versions inherit, or none is sold: no line (never a promise a plan breaks)', async () => {
        for (const plans of [[{ inheritsTouristVip: true }, { inheritsTouristVip: false }], []]) {
            // Arrange
            mocks.readSellablePlanCatalog.mockResolvedValue({ plans });

            // Act
            const result = await myPlan();

            // Assert
            const venue = result.items.find((item) => item.vertical === 'venue');
            expect(venue).not.toHaveProperty('touristVipOnUpgrade');
        }
    });

    it('a non-trial status never reads the catalog nor carries the line', async () => {
        // Arrange: only the ACTIVE accommodation subscription
        mocks.readTrialSummary.mockResolvedValue({ status: 'NONE' });
        mocks.readSellablePlanCatalog.mockResolvedValue({ plans: [{ inheritsTouristVip: true }] });

        // Act
        const result = await myPlan();

        // Assert
        expect(result.items.map((item) => item.status)).toEqual(['ACTIVE']);
        expect(result.items[0]).not.toHaveProperty('touristVipOnUpgrade');
        expect(mocks.readSellablePlanCatalog).not.toHaveBeenCalled();
    });

    it('the sellable catalog cannot be read: no line, logged, and the trial item still answers', async () => {
        // Arrange
        mocks.readSellablePlanCatalog.mockRejectedValue(new Error('db down'));
        const warn = vi.spyOn(apiLogger, 'warn');

        // Act
        const result = await myPlan();

        // Assert
        const venue = result.items.find((item) => item.vertical === 'venue');
        expect(venue?.status).toBe('TRIAL');
        expect(venue).not.toHaveProperty('touristVipOnUpgrade');
        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ vertical: 'venue', error: 'db down' }),
            'get_my_plan: sellable catalog could not be read for the trial Tourist VIP line'
        );
    });

    it('the tool description says the trial itself does not include Tourist VIP', () => {
        expect(getMyPlanTool.description).toContain('touristVipOnUpgrade');
        expect(getMyPlanTool.description).toContain(
            'the trial itself does NOT include Tourist VIP'
        );
    });
});
