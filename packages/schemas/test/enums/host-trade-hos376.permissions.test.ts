import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PermissionEnumSchema } from '../../src/enums/permission.schema.js';
import {
    getPermissionsByCategory,
    PERMISSION_TO_CATEGORY
} from '../../src/utils/permission-grouping.js';

// ============================================================================
// HOS-376 T-002 — the 5 permissions the benefit-usage + review domain needs.
//
// Split deliberately along the line that matters operationally: reading the
// moderation queue is not the same authority as deciding on it, and neither is
// the same as lifting a provider's declaration suspension. Collapsing them
// into one hostTrade.manage would make every one of those an all-or-nothing
// grant.
//
// Note what is NOT here: the provider's own actions (declaring a usage,
// confirming one, replying to a review) get NO permission at all. They are
// gated by row ownership through /protected/host-trades/mine, exactly as
// HOS-278 AC-7 established — an approved provider stays a plain USER.
// ============================================================================

const NEW_HOS376_PERMISSIONS = [
    [PermissionEnum.HOST_TRADE_REVIEW_CREATE, 'hostTrade.review.create'],
    [PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL, 'hostTrade.review.viewAll'],
    [PermissionEnum.HOST_TRADE_REVIEW_MODERATE, 'hostTrade.review.moderate'],
    [PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL, 'hostTrade.usage.viewAll'],
    [PermissionEnum.HOST_TRADE_USAGE_MANAGE, 'hostTrade.usage.manage']
] as const;

describe('HOS-376 host-trade permissions (T-002)', () => {
    describe('enum values', () => {
        it.each(
            NEW_HOS376_PERMISSIONS
        )('should define %s with its dotted value', (member, value) => {
            expect(member).toBe(value);
        });

        it('should keep every new value unique across the whole enum', () => {
            const allValues = Object.values(PermissionEnum);
            for (const [, value] of NEW_HOS376_PERMISSIONS) {
                const occurrences = allValues.filter((v) => v === value).length;
                expect(occurrences, `"${value}" should appear exactly once`).toBe(1);
            }
        });

        it('should parse each new permission via PermissionEnumSchema', () => {
            for (const [member] of NEW_HOS376_PERMISSIONS) {
                expect(PermissionEnumSchema.safeParse(member).success).toBe(true);
            }
        });
    });

    describe('category derivation', () => {
        it.each(
            NEW_HOS376_PERMISSIONS
        )('should categorize %s under HOST_TRADE', (member: PermissionEnum) => {
            expect(PERMISSION_TO_CATEGORY[member]).toBe(PermissionCategoryEnum.HOST_TRADE);
        });

        it('should grow the HOST_TRADE category from 7 to 12 permissions', () => {
            const grouped = getPermissionsByCategory();
            const hostTradePermissions = grouped.get(PermissionCategoryEnum.HOST_TRADE);

            expect(hostTradePermissions).toBeDefined();
            expect(hostTradePermissions).toHaveLength(12);
        });

        it('should keep the 7 pre-existing SPEC-241 permissions in the category', () => {
            const grouped = getPermissionsByCategory();
            const hostTradePermissions = grouped.get(PermissionCategoryEnum.HOST_TRADE) ?? [];

            for (const legacy of [
                PermissionEnum.HOST_TRADE_VIEW,
                PermissionEnum.HOST_TRADE_VIEW_ALL,
                PermissionEnum.HOST_TRADE_CREATE,
                PermissionEnum.HOST_TRADE_UPDATE,
                PermissionEnum.HOST_TRADE_DELETE,
                PermissionEnum.HOST_TRADE_RESTORE,
                PermissionEnum.HOST_TRADE_HARD_DELETE
            ]) {
                expect(hostTradePermissions).toContain(legacy);
            }
        });
    });

    describe('separation of authority', () => {
        it('should keep reading the moderation queue distinct from deciding on it', () => {
            // A future refactor that aliases these to the same string would let
            // anyone who can SEE the queue also APPROVE from it.
            expect(PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL).not.toBe(
                PermissionEnum.HOST_TRADE_REVIEW_MODERATE
            );
        });

        it('should keep review moderation distinct from usage management', () => {
            // Lifting a provider's declaration suspension is an anti-abuse
            // action, not a content decision.
            expect(PermissionEnum.HOST_TRADE_USAGE_MANAGE).not.toBe(
                PermissionEnum.HOST_TRADE_REVIEW_MODERATE
            );
        });

        it('should NOT introduce a permission for the provider own-row actions', () => {
            // HOS-278 AC-7: an approved provider stays a plain USER; declaring,
            // confirming and replying are gated by ownership, not by a grant.
            const values = Object.values(PermissionEnum) as string[];
            expect(values).not.toContain('hostTrade.usage.declare');
            expect(values).not.toContain('hostTrade.usage.confirm');
            expect(values).not.toContain('hostTrade.review.reply');
        });
    });
});
