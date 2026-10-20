import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    resolveEffectiveSet,
    UnresolvedCoverageSourceError
} from '../../src/effective-set/resolve-effective-set';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';
import { addon, subscription, trial } from './sources';

const USER = 'user-1';
const VERTICAL = VerticalEnum.ACCOMMODATION;

describe('resolveEffectiveSet', () => {
    it.each([
        'SUBSCRIPTION',
        'COURTESY',
        'BASE',
        'TRIAL'
    ] as const)('reads %s plan effects', async (type) => {
        const catalog = createInMemoryCatalog();
        const id = catalog.addPlanVersion(
            planVersionRow({
                limits: [
                    { key: 'max_photos_per_accommodation', value: 7, aggregationStrategy: 'SUM' }
                ]
            })
        );
        const started = type !== 'TRIAL';
        const source = CoverageSourceSchema.parse({
            type,
            reference: { kind: 'PLAN_VERSION', planVersionId: id },
            scope: 'VERTICAL',
            target: null,
            since: started ? new Date('2026-01-01') : 'NOT_STARTED',
            until:
                type === 'BASE'
                    ? 'NEVER_EXPIRES'
                    : started
                      ? new Date('2026-12-31')
                      : 'NOT_STARTED',
            charged: type === 'SUBSCRIPTION' ? true : null,
            floor: null
        });
        const result = await resolveEffectiveSet({
            reader: catalog.reader,
            billing: { coverage: async () => ({ covered: true, sources: [source] }) },
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VERTICAL
        });
        expect(result.entries).toContainEqual({
            key: 'max_photos_per_accommodation',
            value: 7,
            strategy: 'SUM'
        });
    });

    it('resolves a running TRIAL through its floor and a GRANT through its floor', async () => {
        const catalog = createInMemoryCatalog();
        const baseId = catalog.addPlanVersion(
            planVersionRow({
                limits: [
                    { key: 'max_photos_per_accommodation', value: 8, aggregationStrategy: 'SUM' }
                ]
            })
        );
        const trialPlanId = 'trial-plan';
        const trialVersionId = catalog.addPlanVersion(
            planVersionRow({ planId: trialPlanId, sellable: false, limits: [] })
        );
        const runningTrial = trial([]).source;
        const trialResult = await resolveEffectiveSet({
            reader: catalog.reader,
            billing: { coverage: async () => ({ covered: true, sources: [runningTrial] }) },
            trials: {
                findTrial: async () => ({
                    userId: USER,
                    vertical: VERTICAL,
                    status: TrialStatusEnum.TRIAL_ACTIVE,
                    trialPlanId,
                    startedAt: new Date('2026-01-01'),
                    endsAt: new Date('2026-12-31'),
                    floor: {
                        entitlementsVersionId: baseId,
                        limitsVersionId: baseId,
                        trialPlanVersionId: trialVersionId
                    }
                })
            },
            userId: USER,
            vertical: VERTICAL
        });
        expect(trialResult.entries).toContainEqual({
            key: 'max_photos_per_accommodation',
            value: 8,
            strategy: 'SUM'
        });
        const grantSource = CoverageSourceSchema.parse({
            type: 'GRANT',
            reference: { kind: 'PLAN_VERSION', planVersionId: baseId },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-01-01'),
            until: 'NEVER_EXPIRES',
            charged: null,
            floor: baseId
        });
        const grantResult = await resolveEffectiveSet({
            reader: catalog.reader,
            billing: { coverage: async () => ({ covered: true, sources: [grantSource] }) },
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VERTICAL
        });
        expect(grantResult.entries).toContainEqual({
            key: 'max_photos_per_accommodation',
            value: 8,
            strategy: 'SUM'
        });
    });

    it('excludes LISTING addon deltas', async () => {
        const catalog = createInMemoryCatalog();
        const listing = {
            ...addon({ scope: 'USER', grants: [] }).source,
            scope: 'LISTING' as const,
            target: 'listing-1'
        };
        const result = await resolveEffectiveSet({
            reader: catalog.reader,
            billing: { coverage: async () => ({ covered: false, sources: [listing] }) },
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VERTICAL
        });
        expect(result.entries).toEqual([]);
    });
    it('resolves a plan entitlement as Infinity and discards an addon without a non-trial title', async () => {
        const catalog = createInMemoryCatalog();
        const id = catalog.addPlanVersion(
            planVersionRow({
                entitlements: [
                    {
                        key: 'priority_support',
                        planQuota: null,
                        trialQuota: null,
                        aggregationStrategy: 'MAX'
                    }
                ]
            })
        );
        const plan = {
            ...trial([]).source,
            reference: { kind: 'PLAN_VERSION' as const, planVersionId: id },
            since: 'NOT_STARTED' as const,
            until: 'NOT_STARTED' as const
        };
        const complement = addon({ scope: 'USER', grants: [] }).source;
        const result = await resolveEffectiveSet({
            reader: {
                ...catalog.reader,
                findAddonVersion: async () => ({
                    addonId: 'addon',
                    validity: 'WHILE_SUBSCRIPTION_ALIVE',
                    validityDays: null,
                    scopeType: 'USER'
                }),
                findAddonVersionEffects: async () => ({
                    entitlements: [{ key: 'priority_support', aggregationStrategy: 'MAX' }],
                    limits: []
                })
            },
            billing: { coverage: async () => ({ covered: false, sources: [plan, complement] }) },
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VERTICAL
        });
        expect(result.entries).toEqual([
            { key: 'priority_support', value: Infinity, strategy: 'MAX' }
        ]);
        expect(result.hasLiveNonTrialTitle).toBe(false);
    });

    it('folds an addon when a subscription title is present', async () => {
        const catalog = createInMemoryCatalog();
        const id = catalog.addPlanVersion(
            planVersionRow({
                limits: [
                    { key: 'max_photos_per_accommodation', value: 10, aggregationStrategy: 'SUM' }
                ]
            })
        );
        const title = {
            ...subscription([]).source,
            reference: { kind: 'PLAN_VERSION' as const, planVersionId: id }
        };
        const complement = addon({ scope: 'USER', grants: [] }).source;
        const result = await resolveEffectiveSet({
            reader: {
                ...catalog.reader,
                findAddonVersion: async () => ({
                    addonId: 'addon',
                    validity: 'WHILE_SUBSCRIPTION_ALIVE',
                    validityDays: null,
                    scopeType: 'USER'
                }),
                findAddonVersionEffects: async () => ({
                    entitlements: [],
                    limits: [
                        {
                            key: 'max_photos_per_accommodation',
                            value: 5,
                            aggregationStrategy: 'SUM'
                        }
                    ]
                })
            },
            billing: { coverage: async () => ({ covered: true, sources: [title, complement] }) },
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VERTICAL
        });
        expect(result.entries).toEqual([
            { key: 'max_photos_per_accommodation', value: 15, strategy: 'SUM' }
        ]);
        expect(result.hasLiveNonTrialTitle).toBe(true);
    });

    it('fails by name for a source whose reference cannot be resolved', async () => {
        const catalog = createInMemoryCatalog();
        await expect(
            resolveEffectiveSet({
                reader: catalog.reader,
                billing: {
                    coverage: async () => ({
                        covered: true,
                        sources: [addon({ scope: 'USER', grants: [] }).source]
                    })
                },
                trials: { findTrial: async () => null },
                userId: USER,
                vertical: VERTICAL
            })
        ).rejects.toBeInstanceOf(UnresolvedCoverageSourceError);
    });

    it('fails by name for an unhandled source type', async () => {
        const catalog = createInMemoryCatalog();
        const future = { ...subscription([]).source, type: 'FUTURE' as never };
        await expect(
            resolveEffectiveSet({
                reader: catalog.reader,
                billing: { coverage: async () => ({ covered: true, sources: [future] }) },
                trials: { findTrial: async () => null },
                userId: USER,
                vertical: VERTICAL
            })
        ).rejects.toBeInstanceOf(UnresolvedCoverageSourceError);
    });
});
