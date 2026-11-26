import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { TrialStatusEnum, UNLIMITED_LIMIT_VALUE, VerticalEnum } from '@repo/schemas';
import { expect, it } from 'vitest';
import { resolveEffectiveLimitBreakdown } from '../../src/effective-set/limit-breakdown';
import { resolveEffectiveSet } from '../../src/effective-set/resolve-effective-set';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';
import { addon, base, subscription, trial } from './sources';

const key = 'max_photos_per_venue';
const vertical = VerticalEnum.VENUE;
const userId = 'owner-1';

function fixture({ planValue = 30 }: { readonly planValue?: number } = {}) {
    const catalog = createInMemoryCatalog();
    const plan = (value: number, rank: number, sellable = true) =>
        catalog.addPlanVersion(
            planVersionRow({
                vertical,
                rank,
                sellable,
                limits: [{ key, value, aggregationStrategy: 'SUM' }]
            })
        );
    const paidId = plan(planValue, 30);
    const floorId = plan(15, 10);
    const baseId = plan(0, 0, false);
    const trialVersionId = catalog.addPlanVersion(
        planVersionRow({ vertical, planId: 'trial', sellable: false })
    );
    const planSource = {
        ...subscription([]).source,
        reference: { kind: 'PLAN_VERSION', planVersionId: paidId }
    } as const;
    const pack = addon({ grants: [], scope: 'USER' }).source;
    const running = trial([]).source;
    return {
        sources: {
            plan: planSource,
            pack,
            running,
            base: {
                ...base([]).source,
                reference: { kind: 'PLAN_VERSION', planVersionId: baseId }
            } as const,
            preTrial: CoverageSourceSchema.parse({
                ...running,
                since: 'NOT_STARTED',
                until: 'NOT_STARTED',
                reference: { kind: 'PLAN_VERSION', planVersionId: floorId }
            }),
            courtesy: CoverageSourceSchema.parse({
                ...planSource,
                type: 'COURTESY',
                charged: null
            }),
            permanent: CoverageSourceSchema.parse({
                ...planSource,
                type: 'GRANT',
                charged: null,
                until: 'NEVER_EXPIRES',
                floor: paidId
            })
        },
        reader: {
            ...catalog.reader,
            findAddonVersion: async () =>
                ({
                    addonId: 'pack',
                    validity: 'WHILE_SUBSCRIPTION_ALIVE',
                    validityDays: null,
                    scopeType: 'VERTICAL_SUBSCRIPTION'
                }) as const,
            findAddonVersionEffects: async () =>
                ({
                    entitlements: [],
                    limits: [{ key, value: 20, aggregationStrategy: 'SUM' }]
                }) as const
        },
        trials: {
            findTrial: async () => ({
                userId,
                vertical,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                trialPlanId: 'trial',
                startedAt: new Date('2026-01-01'),
                endsAt: new Date('2026-12-31'),
                floor: {
                    entitlementsVersionId: paidId,
                    limitsVersionId: floorId,
                    trialPlanVersionId: trialVersionId
                }
            })
        }
    };
}

it.each([
    {
        name: 'plan only (zero base omitted)',
        sources: ['plan', 'base'],
        total: 30,
        contributions: [{ kind: 'PLAN', value: 30, sources: 1 }]
    },
    {
        name: 'plan and two packs',
        sources: ['pack', 'pack', 'plan'],
        total: 70,
        contributions: [
            { kind: 'PLAN', value: 30, sources: 1 },
            { kind: 'ADDON', value: 40, sources: 2 }
        ]
    },
    { name: 'orphan pack', sources: ['pack'], total: 0, contributions: [] },
    {
        name: 'trial only',
        sources: ['running', 'pack'],
        total: 15,
        contributions: [{ kind: 'TRIAL', value: 15, sources: 1 }]
    },
    {
        name: 'subscription supersedes trial',
        sources: ['running', 'plan'],
        total: 30,
        contributions: [{ kind: 'PLAN', value: 30, sources: 1 }]
    },
    {
        name: 'unstarted trial is base',
        sources: ['preTrial'],
        total: 15,
        contributions: [{ kind: 'BASE', value: 15, sources: 1 }]
    },
    {
        name: 'courtesy title',
        sources: ['courtesy'],
        total: 30,
        contributions: [{ kind: 'COURTESY', value: 30, sources: 1 }]
    },
    {
        name: 'permanent grant',
        sources: ['permanent'],
        total: 30,
        contributions: [{ kind: 'PERMANENT_GRANT', value: 30, sources: 1 }]
    },
    {
        name: 'unlimited plan absorbs a pack',
        sources: ['plan', 'pack'],
        planValue: UNLIMITED_LIMIT_VALUE,
        total: UNLIMITED_LIMIT_VALUE,
        contributions: [
            { kind: 'PLAN', value: 'unlimited', sources: 1 },
            { kind: 'ADDON', value: 20, sources: 1 }
        ]
    }
] as const)('explains $name using the enforcement fold', async ({
    sources,
    contributions,
    total,
    ...options
}) => {
    const catalog = fixture(options);
    const args = {
        userId,
        vertical,
        reader: catalog.reader,
        trials: catalog.trials,
        billing: {
            coverage: async () => ({
                covered: true,
                sources: sources.map((source) => catalog.sources[source])
            })
        }
    };

    const result = await resolveEffectiveLimitBreakdown({
        ...args,
        keys: [key, 'max_photos_per_experience']
    });
    const folded = await resolveEffectiveSet(args);

    expect([...result]).toEqual([
        [key, { total, contributions }],
        ['max_photos_per_experience', { total: 0, contributions: [] }]
    ]);
    expect(folded.entries.find((entry) => entry.key === key)?.value ?? 0).toBe(total);
});
