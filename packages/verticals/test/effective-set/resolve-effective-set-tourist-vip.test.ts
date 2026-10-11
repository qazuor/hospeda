import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveEffectiveSet } from '../../src/effective-set/resolve-effective-set';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';

const USER = 'user-1';
const KEY = 'vip_counter';

describe('TEST:V3:8 Tourist VIP effective set', () => {
    async function setup(args: {
        readonly inherits: boolean;
        readonly paidVip?: boolean;
        readonly addon?: boolean;
    }) {
        const catalog = createInMemoryCatalog();
        const accommodationId = catalog.addPlanVersion(
            planVersionRow({ inheritsTouristVip: args.inherits })
        );
        const vipId = catalog.addPlanVersion(
            planVersionRow({
                vertical: VerticalEnum.TOURIST,
                rank: 30,
                limits: [{ key: KEY, value: 2, aggregationStrategy: 'SUM' }]
            })
        );
        const lowId = catalog.addPlanVersion(
            planVersionRow({
                vertical: VerticalEnum.TOURIST,
                rank: 10,
                limits: [{ key: KEY, value: 1, aggregationStrategy: 'SUM' }]
            })
        );
        const title = (id: string) =>
            CoverageSourceSchema.parse({
                type: 'SUBSCRIPTION',
                reference: { kind: 'PLAN_VERSION', planVersionId: id },
                scope: 'VERTICAL',
                target: null,
                since: new Date('2026-01-01'),
                until: 'NO_KNOWN_DATE',
                charged: true,
                floor: null
            });
        const complement = CoverageSourceSchema.parse({
            type: 'ADDON',
            reference: { kind: 'ADDON_VERSION', addonVersionId: lowId },
            scope: 'USER',
            target: null,
            since: new Date('2026-01-01'),
            until: 'NO_KNOWN_DATE',
            charged: null,
            floor: null
        });
        const accommodation = title(accommodationId);
        const billing = {
            coverage: async ({ vertical }: { readonly vertical: VerticalEnum }) => ({
                covered: vertical === VerticalEnum.ACCOMMODATION || Boolean(args.paidVip),
                sources:
                    vertical === VerticalEnum.ACCOMMODATION
                        ? [accommodation]
                        : vertical === VerticalEnum.TOURIST
                          ? [
                                ...(args.paidVip ? [title(vipId)] : []),
                                ...(args.addon ? [complement] : [])
                            ]
                          : []
            })
        };
        const reader = {
            ...catalog.reader,
            findAddonVersion: async () => ({
                addonId: 'addon',
                validity: 'WHILE_SUBSCRIPTION_ALIVE',
                validityDays: null,
                scopeType: 'USER'
            }),
            findAddonVersionEffects: async () => ({
                entitlements: [],
                limits: [{ key: KEY, value: 5, aggregationStrategy: 'SUM' as const }]
            })
        };
        return { billing, reader };
    }

    it('includes effects from the highest-rank VIP version when inherited', async () => {
        const { billing, reader } = await setup({ inherits: true });
        const result = await resolveEffectiveSet({
            reader,
            billing,
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VerticalEnum.TOURIST
        });
        expect(result.inheritsTouristVip).toBe(true);
        expect(result.entries).toContainEqual({ key: KEY, value: 2, strategy: 'SUM' });
    });

    it('does not include VIP effects without inheritance', async () => {
        const { billing, reader } = await setup({ inherits: false });
        const result = await resolveEffectiveSet({
            reader,
            billing,
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VerticalEnum.TOURIST
        });
        expect(result.inheritsTouristVip).toBe(false);
        expect(result.entries).toEqual([]);
    });

    it('does not duplicate an already paid VIP subscription', async () => {
        const { billing, reader } = await setup({ inherits: true, paidVip: true });
        const result = await resolveEffectiveSet({
            reader,
            billing,
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VerticalEnum.TOURIST
        });
        expect(result.entries).toContainEqual({ key: KEY, value: 2, strategy: 'SUM' });
    });

    it('does not turn an inherited title into permission for Tourist complements', async () => {
        const { billing, reader } = await setup({ inherits: true, addon: true });
        const result = await resolveEffectiveSet({
            reader,
            billing,
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VerticalEnum.TOURIST
        });
        expect(result.hasLiveNonTrialTitle).toBe(false);
        expect(result.entries).toContainEqual({ key: KEY, value: 2, strategy: 'SUM' });
    });

    it('leaves other verticals unchanged', async () => {
        const { billing, reader } = await setup({ inherits: true });
        const result = await resolveEffectiveSet({
            reader,
            billing,
            trials: { findTrial: async () => null },
            userId: USER,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(result.inheritsTouristVip).toBe(false);
        expect(result.entries).toEqual([]);
        expect(result.hasLiveNonTrialTitle).toBe(true);
    });
});
