/**
 * Regression tests for SPEC-285 T-001: public read path must not 403 for guest actor.
 *
 * Before the fix, `checkCanSearch` and `checkCanView` required
 * `OWNER_PROMOTION_VIEW_ANY` or `OWNER_PROMOTION_VIEW_OWN`. A guest actor
 * (only `ACCESS_API_PUBLIC`) always triggered FORBIDDEN on the public list
 * and getById routes.
 *
 * These tests verify that a guest actor can:
 * 1. Call `checkCanSearch` without error (public list/search endpoint).
 * 2. Call `checkCanView` on an ACTIVE non-plan-restricted promotion without error.
 * 3. Is still blocked from viewing DRAFT / plan-restricted promotions.
 */

import type { UserIdType } from '@repo/schemas';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkCanSearch,
    checkCanView
} from '../../../src/services/owner-promotion/ownerPromotion.permissions';
import { ServiceError } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';
import { createMockOwnerPromotion } from '../../factories/ownerPromotionFactory';
import { getMockId } from '../../factories/utilsFactory';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Guest actor: only ACCESS_API_PUBLIC, no view permissions. */
const guestActor = {
    id: getMockId('user', 'guest'),
    role: RoleEnum.GUEST,
    permissions: [PermissionEnum.ACCESS_API_PUBLIC] as readonly PermissionEnum[]
};

/** Active, public promotion (the norm for public reads). */
const activePromotion = createMockOwnerPromotion({
    ownerId: getMockId('user', 'owner') as UserIdType,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    planRestricted: false
});

/** Draft promotion (should NOT be publicly visible). */
const draftPromotion = createMockOwnerPromotion({
    ownerId: getMockId('user', 'owner') as UserIdType,
    lifecycleState: LifecycleStatusEnum.DRAFT,
    planRestricted: false
});

/** Plan-restricted promotion (should NOT be publicly visible). */
const planRestrictedPromotion = createMockOwnerPromotion({
    ownerId: getMockId('user', 'owner') as UserIdType,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    planRestricted: true
});

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) => {
        return (actor.permissions as readonly PermissionEnum[]).includes(permission);
    });
    vi.spyOn(permissionUtils, 'checkGenericPermission').mockImplementation(
        (actor, anyPermission, ownPermission, isEntityOwner, errorMessage) => {
            const can =
                (actor.permissions as readonly PermissionEnum[]).includes(anyPermission) ||
                ((actor.permissions as readonly PermissionEnum[]).includes(ownPermission) &&
                    isEntityOwner);
            if (!can) {
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, errorMessage);
            }
        }
    );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SPEC-285 T-001 regression — guest actor public read path', () => {
    describe('checkCanSearch (public list endpoint gate)', () => {
        it('does NOT throw FORBIDDEN for a guest actor with only ACCESS_API_PUBLIC', () => {
            expect(() => checkCanSearch(guestActor)).not.toThrow();
        });

        it('does NOT throw FORBIDDEN for an actor with zero permissions', () => {
            const noPermActor = { ...guestActor, permissions: [] as readonly PermissionEnum[] };
            expect(() => checkCanSearch(noPermActor)).not.toThrow();
        });
    });

    describe('checkCanView (public getById endpoint gate)', () => {
        it('does NOT throw FORBIDDEN for a guest actor viewing an ACTIVE promotion', () => {
            // This was the root cause of the 403: guest could not view ACTIVE promos.
            expect(() => checkCanView(guestActor, activePromotion)).not.toThrow();
        });

        it('still throws FORBIDDEN for a guest actor viewing a DRAFT promotion', () => {
            expect(() => checkCanView(guestActor, draftPromotion)).toThrow(ServiceError);
            try {
                checkCanView(guestActor, draftPromotion);
            } catch (err) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });

        it('still throws FORBIDDEN for a guest actor viewing a planRestricted promotion', () => {
            expect(() => checkCanView(guestActor, planRestrictedPromotion)).toThrow(ServiceError);
            try {
                checkCanView(guestActor, planRestrictedPromotion);
            } catch (err) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                }
            }
        });
    });
});
