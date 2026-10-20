import { type CoverageArgs, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    isNotNull,
    ne,
    planCatalogModel,
    subscriptions,
    touristVipModel
} from '@repo/db';
import type { TouristVipInheritancePort } from '@repo/service-core';
import { resolveTouristVipInheritance } from '@repo/verticals';

type TitleCoverageRow = {
    readonly vertical: string;
    readonly planVersionId: string;
    readonly status: string;
    readonly serviceEndsAt: Date | null;
    readonly createdAt: Date;
};

function resolveTitleCoverage({
    rows,
    userId
}: {
    readonly rows: readonly TitleCoverageRow[];
    readonly userId: string;
}) {
    const byVertical = new Map<string, ReturnType<typeof CoverageSourceSchema.parse>[]>();
    for (const row of rows) {
        let until: Date | 'NO_KNOWN_DATE' = 'NO_KNOWN_DATE';
        if (row.status === 'CANCEL_SCHEDULED' && row.serviceEndsAt) {
            until = row.serviceEndsAt;
        }
        const source = CoverageSourceSchema.parse({
            type: 'SUBSCRIPTION',
            reference: { kind: 'PLAN_VERSION', planVersionId: row.planVersionId },
            scope: 'VERTICAL',
            target: null,
            since: row.createdAt,
            until,
            charged: false,
            floor: null
        });
        const sources = byVertical.get(row.vertical) ?? [];
        sources.push(source);
        byVertical.set(row.vertical, sources);
    }
    return resolveTouristVipInheritance({
        userId,
        billing: {
            coverage: async ({ vertical }: CoverageArgs) => {
                const sources = byVertical.get(vertical) ?? [];
                return { covered: sources.length > 0, sources };
            }
        },
        reader: planCatalogModel
    });
}

/** Provisional bridge; B4 replaces this title-row approximation with real coverage. */
export const touristVipInheritance: TouristVipInheritancePort = {
    async inherits({ userId }) {
        const rows = await touristVipModel.findTitleRows({ userId });
        const result = await resolveTitleCoverage({ rows, userId });
        return result.inherits;
    }
};

/** AC:B13a:16 anticipates the cancellation AC:B7:31 performs when S7 restores inherited VIP. */
export async function touristVipCancelledOnReturn({
    userId
}: {
    readonly userId: string;
}): Promise<boolean> {
    const rows = await getDb()
        .select({
            vertical: subscriptions.vertical,
            planVersionId: subscriptions.planVersionId,
            status: subscriptions.status,
            serviceEndsAt: subscriptions.serviceEndsAt,
            createdAt: subscriptions.createdAt
        })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.class, 'PRINCIPAL'),
                isNotNull(subscriptions.vertical),
                ne(subscriptions.vertical, 'tourist'),
                isNotNull(subscriptions.planVersionId),
                eq(subscriptions.status, 'SUSPENDED')
            )
        );
    const suspendedRows = rows.flatMap((row) =>
        row.vertical && row.planVersionId
            ? [{ ...row, vertical: row.vertical, planVersionId: row.planVersionId }]
            : []
    );
    const suspended = await resolveTitleCoverage({ rows: suspendedRows, userId });
    if (!suspended.inherits) return false;
    return !(await touristVipInheritance.inherits({ userId }));
}
