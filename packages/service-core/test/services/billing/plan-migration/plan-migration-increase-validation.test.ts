import { planCatalogModel } from '@repo/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validatePlanMigrationVersions } from '../../../../src/services/billing/plan-migration/plan-migration-validation.js';

const sourceId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const currentId = '33333333-3333-4333-8333-333333333333';
const otherPlanId = '44444444-4444-4444-8444-444444444444';

interface VersionFixture {
    readonly id: string;
    readonly planId: string;
    readonly vertical: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
}

const version = (overrides: Partial<VersionFixture> & { id: string }): VersionFixture => ({
    planId: otherPlanId,
    vertical: 'accommodation',
    rank: 1,
    sellable: true,
    current: true,
    ...overrides
});

function stubCatalog(input: {
    readonly source: VersionFixture;
    readonly target: VersionFixture;
    readonly current: VersionFixture | null;
}) {
    vi.spyOn(planCatalogModel, 'findPlanVersionSummary').mockImplementation(async ({ id }) => {
        if (id === input.source.id) return input.source;
        if (id === input.target.id) return input.target;
        return null;
    });
    vi.spyOn(planCatalogModel, 'findCurrentPlanVersion').mockResolvedValue(input.current);
}

afterEach(() => vi.restoreAllMocks());

describe('AC:B12:9 el aumento es una migración a la versión nueva del mismo plan', () => {
    it('rejects a target version of another plan', async () => {
        stubCatalog({
            source: version({ id: sourceId, planId: 'plan-old' }),
            target: version({ id: targetId, planId: 'plan-other' }),
            current: version({ id: currentId, planId: 'plan-old' })
        });
        await expect(
            validatePlanMigrationVersions({
                sourcePlanVersionId: sourceId,
                targetPlanVersionId: targetId,
                reason: 'PRICE_INCREASE',
                verticals: { planPolicy: vi.fn(), changeDirection: vi.fn() }
            })
        ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_INCREASE_OTHER_PLAN' });
    });

    it('rejects a source version that is still the current one', async () => {
        stubCatalog({
            source: version({ id: sourceId, planId: 'plan-one' }),
            target: version({ id: targetId, planId: 'plan-one' }),
            current: version({ id: sourceId, planId: 'plan-one' })
        });
        await expect(
            validatePlanMigrationVersions({
                sourcePlanVersionId: sourceId,
                targetPlanVersionId: targetId,
                reason: 'PRICE_INCREASE',
                verticals: { planPolicy: vi.fn(), changeDirection: vi.fn() }
            })
        ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_INCREASE_SOURCE_CURRENT' });
    });

    it('rejects a successor that is not current and sellable', async () => {
        stubCatalog({
            source: version({ id: sourceId, planId: 'plan-one', current: false }),
            target: version({ id: targetId, planId: 'plan-one' }),
            current: version({ id: currentId, planId: 'plan-one' })
        });
        await expect(
            validatePlanMigrationVersions({
                sourcePlanVersionId: sourceId,
                targetPlanVersionId: targetId,
                reason: 'PRICE_INCREASE',
                verticals: {
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: false,
                        sellable: true
                    }),
                    changeDirection: vi.fn()
                }
            })
        ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_TARGET_NOT_SELLABLE' });
    });

    it('accepts the non-current source and its current sellable successor in the same plan', async () => {
        const source = version({ id: sourceId, planId: 'plan-one', current: false });
        const target = version({ id: targetId, planId: 'plan-one' });
        stubCatalog({
            source,
            target,
            current: version({ id: targetId, planId: 'plan-one' })
        });
        await expect(
            validatePlanMigrationVersions({
                sourcePlanVersionId: sourceId,
                targetPlanVersionId: targetId,
                reason: 'PRICE_INCREASE',
                verticals: {
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: true,
                        sellable: true
                    }),
                    changeDirection: vi.fn()
                }
            })
        ).resolves.toEqual({ source, target });
    });

    it('keeps rejecting a source whose plan is still sellable when the reason is a retirement', async () => {
        stubCatalog({
            source: version({ id: sourceId, planId: 'plan-one' }),
            target: version({ id: targetId, planId: 'plan-other' }),
            current: version({ id: currentId, planId: 'plan-one', sellable: true })
        });
        await expect(
            validatePlanMigrationVersions({
                sourcePlanVersionId: sourceId,
                targetPlanVersionId: targetId,
                verticals: {
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: true,
                        sellable: true
                    }),
                    changeDirection: vi.fn()
                }
            })
        ).rejects.toMatchObject({ reason: 'PLAN_MIGRATION_SOURCE_NOT_RETIRED' });
    });
});
