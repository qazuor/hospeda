/**
 * Cross-cutting permission boundary tests for `_canAdminList` (read path).
 *
 * SPEC-063-gaps T-028 (GAP-030): closes the AC-005-01 boundary check that was
 * not exercised in the per-entity permission test files. For each SPEC-063
 * entity, asserts that an actor without the entity-specific VIEW permission
 * is rejected by `checkCanAdminList`.
 *
 * Co-locating in a single cross-cutting file (instead of one test per
 * permissions.test.ts) keeps the AC-005-01 surface visible in one place and
 * makes regressions trivial to spot if the permission gate drifts on any
 * single entity.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { checkCanAdminList as checkCanAdminListAccommodationReview } from '../../../src/services/accommodationReview/accommodationReview.permissions';
import { checkCanAdminList as checkCanAdminListDestinationReview } from '../../../src/services/destinationReview/destinationReview.permissions';
import { checkCanAdminList as checkCanAdminListOwnerPromotion } from '../../../src/services/owner-promotion/ownerPromotion.permissions';
import { checkCanAdminList as checkCanAdminListSponsorship } from '../../../src/services/sponsorship/sponsorship.permissions';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';

const makeActor = (permissions: PermissionEnum[]): Actor => ({
    id: 'boundary-test-actor',
    role: RoleEnum.ADMIN,
    permissions
});

type Case = {
    label: string;
    check: (actor: Actor) => void;
    requiredPermission: PermissionEnum;
};

const cases: ReadonlyArray<Case> = [
    {
        label: 'OwnerPromotion',
        check: checkCanAdminListOwnerPromotion,
        requiredPermission: PermissionEnum.OWNER_PROMOTION_VIEW
    },
    {
        label: 'Sponsorship',
        check: checkCanAdminListSponsorship,
        requiredPermission: PermissionEnum.SPONSORSHIP_VIEW_ANY
    },
    {
        label: 'AccommodationReview',
        check: checkCanAdminListAccommodationReview,
        requiredPermission: PermissionEnum.ACCOMMODATION_REVIEW_VIEW
    },
    {
        label: 'DestinationReview',
        check: checkCanAdminListDestinationReview,
        requiredPermission: PermissionEnum.DESTINATION_REVIEW_VIEW
    }
];

describe('T-028 / AC-005-01: lifecycleState boundary on _canAdminList', () => {
    describe.each(cases)('$label', ({ check, requiredPermission }) => {
        it('rejects an actor with no relevant permissions', () => {
            const actor = makeActor([]);
            expect(() => check(actor)).toThrow(ServiceError);
            try {
                check(actor);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });

        it('rejects an actor with unrelated permissions but not the entity VIEW permission', () => {
            // ACCESS_API_PUBLIC is generic admin access — should not bypass the
            // entity-specific gate.
            const actor = makeActor([
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_PRIVATE
            ]);
            expect(() => check(actor)).toThrow(ServiceError);
        });

        it('allows an actor that holds the entity-specific VIEW permission', () => {
            const actor = makeActor([requiredPermission]);
            expect(() => check(actor)).not.toThrow();
        });
    });
});
