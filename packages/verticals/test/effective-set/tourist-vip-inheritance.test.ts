import { type CoverageSource, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { UnresolvedCoverageSourceError } from '../../src/effective-set/resolve-effective-set';
import { resolveTouristVipInheritance } from '../../src/effective-set/tourist-vip-inheritance';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';

const userId = 'user-1';

function source(args: {
    readonly type: 'SUBSCRIPTION' | 'COURTESY' | 'GRANT' | 'TRIAL' | 'BASE' | 'ADDON';
    readonly planVersionId: string;
}): CoverageSource {
    const { type, planVersionId } = args;
    return CoverageSourceSchema.parse({
        type,
        reference:
            type === 'ADDON'
                ? { kind: 'ADDON_VERSION', addonVersionId: planVersionId }
                : { kind: 'PLAN_VERSION', planVersionId },
        scope: type === 'ADDON' ? 'USER' : 'VERTICAL',
        target: null,
        since: new Date('2026-01-01'),
        until: type === 'GRANT' || type === 'BASE' ? 'NEVER_EXPIRES' : new Date('2026-12-31'),
        charged: type === 'SUBSCRIPTION' ? true : null,
        floor: type === 'GRANT' ? planVersionId : null
    });
}

function billingFor(args: {
    readonly vertical: VerticalEnum;
    readonly sources: readonly CoverageSource[];
}) {
    return {
        coverage: async ({ vertical }: { readonly vertical: VerticalEnum }) => ({
            covered: vertical === args.vertical,
            sources: vertical === args.vertical ? [...args.sources] : []
        })
    };
}

describe('TEST:V3:8 Tourist VIP inheritance', () => {
    it.each([
        'SUBSCRIPTION',
        'GRANT',
        'COURTESY'
    ] as const)('inherits from an accommodation %s title', async (type) => {
        const catalog = createInMemoryCatalog();
        const planVersionId = catalog.addPlanVersion(planVersionRow({ inheritsTouristVip: true }));
        const title = source({ type, planVersionId });
        await expect(
            resolveTouristVipInheritance({
                userId,
                reader: catalog.reader,
                billing: billingFor({ vertical: VerticalEnum.ACCOMMODATION, sources: [title] })
            })
        ).resolves.toEqual({ inherits: true, source: title, planVersionId });
    });

    it.each(['TRIAL', 'BASE', 'ADDON'] as const)('does not inherit from %s', async (type) => {
        const catalog = createInMemoryCatalog();
        const planVersionId = catalog.addPlanVersion(planVersionRow({ inheritsTouristVip: true }));
        await expect(
            resolveTouristVipInheritance({
                userId,
                reader: catalog.reader,
                billing: billingFor({
                    vertical: VerticalEnum.ACCOMMODATION,
                    sources: [source({ type, planVersionId })]
                })
            })
        ).resolves.toEqual({ inherits: false });
    });

    it('does not inherit from a version without the flag', async () => {
        const catalog = createInMemoryCatalog();
        const planVersionId = catalog.addPlanVersion(planVersionRow());
        const title = source({ type: 'SUBSCRIPTION', planVersionId });
        await expect(
            resolveTouristVipInheritance({
                userId,
                reader: catalog.reader,
                billing: billingFor({ vertical: VerticalEnum.ACCOMMODATION, sources: [title] })
            })
        ).resolves.toEqual({ inherits: false });
    });

    it('does not inherit from Tourist itself even when its version declares the flag', async () => {
        const catalog = createInMemoryCatalog();
        const planVersionId = catalog.addPlanVersion(
            planVersionRow({ vertical: VerticalEnum.TOURIST, inheritsTouristVip: true })
        );
        await expect(
            resolveTouristVipInheritance({
                userId,
                reader: catalog.reader,
                billing: billingFor({
                    vertical: VerticalEnum.TOURIST,
                    sources: [source({ type: 'SUBSCRIPTION', planVersionId })]
                })
            })
        ).resolves.toEqual({ inherits: false });
    });

    it('rejects a dangling plan version reference', async () => {
        const catalog = createInMemoryCatalog();
        const missingId = '00000000-0000-4000-8000-000000000001';
        await expect(
            resolveTouristVipInheritance({
                userId,
                reader: catalog.reader,
                billing: billingFor({
                    vertical: VerticalEnum.ACCOMMODATION,
                    sources: [source({ type: 'SUBSCRIPTION', planVersionId: missingId })]
                })
            })
        ).rejects.toBeInstanceOf(UnresolvedCoverageSourceError);
    });
});
