/**
 * @file plan-comparison-rows.tourist-vip.test.ts
 * @description HOS-2398: the owner table's "as tourist" group resolves against
 * the SELLABLE Tourist VIP plan whenever the owner plan inherits Tourist VIP.
 *
 * The owner plans are about to lose their 15 tourist entitlements and 7 tourist
 * limits (the catalog cleanup of HOS-2398). Those benefits keep reaching the
 * owner at runtime through the inheritance, so the table must read them from the
 * plan that actually grants them. Reading the owner plan's own rows would
 * render the whole group as "no" the moment the catalog PR lands.
 */

import { EntitlementKeyEnum, LimitKeyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type GroupConfig,
    OWNER_GROUPS,
    type PlanCellSource
} from '@/components/billing/plan-comparison-rows';
import { resolveGroupCell } from '@/components/billing/plan-comparison-source';
import { getVisibleRows } from '@/components/billing/plan-comparison-table.helpers';

function group(id: string): GroupConfig {
    const found = OWNER_GROUPS.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`Group not found: ${id}`);
    return found;
}

function cellsOf(input: {
    readonly groupId: string;
    readonly plan: PlanCellSource;
    readonly touristVipPlan: PlanCellSource | null;
}): Record<string, unknown> {
    const target = group(input.groupId);
    return Object.fromEntries(
        target.rows.map((row) => [
            row.id,
            resolveGroupCell({
                group: target,
                cell: row.cell,
                plan: input.plan,
                touristVipPlan: input.touristVipPlan
            })
        ])
    );
}

/** The sellable Tourist VIP plan, as the tourist catalog returns it. */
const TOURIST_VIP: PlanCellSource = {
    slug: 'tourist-vip',
    entitlements: [
        EntitlementKeyEnum.READ_REVIEWS,
        EntitlementKeyEnum.CAN_VIEW_RECOMMENDATIONS,
        EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS,
        EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DISPLAY,
        EntitlementKeyEnum.CAN_CONTACT_WHATSAPP_DIRECT
    ],
    limits: {
        [LimitKeyEnum.MAX_FAVORITES]: 2147483647,
        [LimitKeyEnum.MAX_COLLECTIONS]: 25,
        [LimitKeyEnum.MAX_SEARCH_HISTORY_ENTRIES]: 100,
        [LimitKeyEnum.MAX_AI_SEARCH_PER_MONTH]: 50,
        [LimitKeyEnum.MAX_AI_CHAT_CONSUMER_PER_MONTH]: 30
    }
};

/** An owner plan after the catalog cleanup: inherits VIP, carries no tourist rows. */
const OWNER_INHERITING_NO_TOURIST_ROWS: PlanCellSource = {
    slug: 'owner-basico',
    inheritsTouristVip: true,
    entitlements: [EntitlementKeyEnum.EDIT_ACCOMMODATION_INFO, EntitlementKeyEnum.CAN_EMBED_VIDEO],
    limits: { [LimitKeyEnum.MAX_ACCOMMODATIONS]: 1, [LimitKeyEnum.MAX_AI_CHAT_PER_MONTH]: 10 }
};

describe('HOS-2398 — the asTourist group reads the Tourist VIP plan', () => {
    it('shows the VIP benefits, from the VIP plan, for an inheriting owner plan with no tourist rows', () => {
        // Arrange
        const input = {
            groupId: 'asTourist',
            plan: OWNER_INHERITING_NO_TOURIST_ROWS,
            touristVipPlan: TOURIST_VIP
        };

        // Act
        const cells = cellsOf(input);

        // Assert
        expect(cells).toEqual({
            favorites: 'unlimited',
            collections: 25,
            reviews: 'yes',
            recommendations: 'yes',
            compare: 'yes',
            searchHistory: 100,
            alertsOffers: 'no',
            whatsappDisplay: 'yes',
            whatsappDirect: 'yes',
            aiSearch: 50,
            aiChat: 30
        });
    });

    it('prefers the VIP plan over tourist rows the inheriting owner plan still carries', () => {
        // Arrange: today's catalog, before the cleanup — stale owner values.
        const ownerWithStaleRows: PlanCellSource = {
            ...OWNER_INHERITING_NO_TOURIST_ROWS,
            limits: { [LimitKeyEnum.MAX_COLLECTIONS]: 3 }
        };

        // Act
        const cells = cellsOf({
            groupId: 'asTourist',
            plan: ownerWithStaleRows,
            touristVipPlan: TOURIST_VIP
        });

        // Assert
        expect(cells.collections).toBe(25);
    });

    it('leaves an owner plan that does not inherit Tourist VIP unchanged', () => {
        // Arrange
        const nonInheriting: PlanCellSource = {
            slug: 'owner-legacy',
            inheritsTouristVip: false,
            entitlements: [EntitlementKeyEnum.READ_REVIEWS],
            limits: { [LimitKeyEnum.MAX_COLLECTIONS]: 3 }
        };

        // Act
        const cells = cellsOf({
            groupId: 'asTourist',
            plan: nonInheriting,
            touristVipPlan: TOURIST_VIP
        });

        // Assert
        expect(cells.reviews).toBe('yes');
        expect(cells.collections).toBe(3);
        expect(cells.compare).toBe('no');
        expect(cells.favorites).toBe('no');
    });

    it('never redirects the owner-specific groups to the VIP plan', () => {
        // Act
        const cells = cellsOf({
            groupId: 'asOwner',
            plan: OWNER_INHERITING_NO_TOURIST_ROWS,
            touristVipPlan: { ...TOURIST_VIP, limits: { [LimitKeyEnum.MAX_ACCOMMODATIONS]: 99 } }
        });

        // Assert
        expect(cells.publish).toBe(1);
        expect(cells.video).toBe('yes');
    });

    it('falls back to the owner plan when the VIP plan could not be read', () => {
        // Act
        const cells = cellsOf({
            groupId: 'asTourist',
            plan: {
                ...OWNER_INHERITING_NO_TOURIST_ROWS,
                limits: { [LimitKeyEnum.MAX_COLLECTIONS]: 3 }
            },
            touristVipPlan: null
        });

        // Assert
        expect(cells.collections).toBe(3);
    });

    it('decides row visibility against the same source the cells use', () => {
        // Arrange: a hide-until-granted row only the VIP plan grants.
        const hidden: GroupConfig = {
            ...group('asTourist'),
            rows: [
                {
                    id: 'vipOnly',
                    labelKey: 'billing.comparison.row.compare',
                    cell: {
                        kind: 'entitlement',
                        key: EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS
                    },
                    status: 'available',
                    hideUntilGranted: true
                }
            ]
        };

        // Act
        const rows = getVisibleRows({
            rows: hidden.rows,
            group: hidden,
            plans: [OWNER_INHERITING_NO_TOURIST_ROWS],
            touristVipPlan: TOURIST_VIP
        });

        // Assert
        expect(rows.map((row) => row.id)).toEqual(['vipOnly']);
    });
});
