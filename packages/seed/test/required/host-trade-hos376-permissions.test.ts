/**
 * HOS-376 T-003 — seed assertion for the 5 benefit-usage / review permissions.
 *
 * The grant split is the point of this file. `HOST_TRADE_REVIEW_CREATE` is the
 * ONLY one a non-staff role gets, and it is what makes "you must be a real
 * host to rate a provider" enforceable server-side: a user who is only a
 * provider (owns a host_trades row but no accommodations) never receives the
 * HOST role, so they can never rate a competitor.
 *
 * The other four are staff-only. Handing any of them to HOST would let a host
 * read the whole moderation queue, approve their own review, or lift a
 * provider's anti-abuse suspension.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed';

const STAFF_ONLY = [
    PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL,
    PermissionEnum.HOST_TRADE_REVIEW_MODERATE,
    PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL,
    PermissionEnum.HOST_TRADE_USAGE_MANAGE
] as const;

const ALL_FIVE = [PermissionEnum.HOST_TRADE_REVIEW_CREATE, ...STAFF_ONLY] as const;

describe('HOS-376 T-003 — host-trade usage/review permissions in the seed', () => {
    describe('staff roles hold all five', () => {
        it.each(ALL_FIVE)('SUPER_ADMIN holds %s', (permission) => {
            expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(permission);
        });

        it.each(ALL_FIVE)('ADMIN holds %s', (permission) => {
            expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).toContain(permission);
        });
    });

    describe('HOST holds exactly the review-create grant', () => {
        it('HOST holds HOST_TRADE_REVIEW_CREATE', () => {
            expect(ROLE_PERMISSIONS[RoleEnum.HOST]).toContain(
                PermissionEnum.HOST_TRADE_REVIEW_CREATE
            );
        });

        it.each(STAFF_ONLY)('HOST does NOT hold %s', (permission) => {
            expect(ROLE_PERMISSIONS[RoleEnum.HOST]).not.toContain(permission);
        });

        it('HOST keeps its pre-existing HOST_TRADE_VIEW (SPEC-241) untouched', () => {
            expect(ROLE_PERMISSIONS[RoleEnum.HOST]).toContain(PermissionEnum.HOST_TRADE_VIEW);
        });
    });

    describe('no other role receives any of them', () => {
        it.each(ALL_FIVE)('USER does NOT hold %s', (permission) => {
            // A plain USER — which is what an approved provider stays (HOS-278
            // AC-7) — must not be able to rate anyone. Rating requires the HOST
            // role, i.e. actually owning accommodations.
            expect(ROLE_PERMISSIONS[RoleEnum.USER]).not.toContain(permission);
        });

        it('no role outside SUPER_ADMIN/ADMIN/HOST receives any of the five', () => {
            const allowed = new Set<string>([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN, RoleEnum.HOST]);

            for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
                if (allowed.has(role)) {
                    continue;
                }
                for (const permission of ALL_FIVE) {
                    expect(
                        permissions,
                        `role "${role}" must not hold "${permission}"`
                    ).not.toContain(permission);
                }
            }
        });
    });
});
