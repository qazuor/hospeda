import { type CoverageArgs, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { planCatalogModel, touristVipModel } from '@repo/db';
import type { TouristVipInheritancePort } from '@repo/service-core';
import { resolveTouristVipInheritance } from '@repo/verticals';

/** Provisional bridge; B4 replaces this title-row approximation with real coverage. */
export const touristVipInheritance: TouristVipInheritancePort = {
    async inherits({ userId }) {
        const rows = await touristVipModel.findTitleRows({ userId });
        const byVertical = new Map<string, ReturnType<typeof CoverageSourceSchema.parse>[]>();
        for (const row of rows) {
            const source = CoverageSourceSchema.parse({
                type: 'SUBSCRIPTION',
                reference: { kind: 'PLAN_VERSION', planVersionId: row.planVersionId },
                scope: 'VERTICAL',
                target: null,
                since: row.createdAt,
                until:
                    row.status === 'CANCEL_SCHEDULED' && row.serviceEndsAt
                        ? row.serviceEndsAt
                        : 'NO_KNOWN_DATE',
                charged: false,
                floor: null
            });
            const sources = byVertical.get(row.vertical) ?? [];
            sources.push(source);
            byVertical.set(row.vertical, sources);
        }
        const result = await resolveTouristVipInheritance({
            userId,
            billing: {
                coverage: async ({ vertical }: CoverageArgs) => {
                    const sources = byVertical.get(vertical) ?? [];
                    return { covered: sources.length > 0, sources };
                }
            },
            reader: planCatalogModel
        });
        return result.inherits;
    }
};
