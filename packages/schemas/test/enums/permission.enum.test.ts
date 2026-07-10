import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PermissionCategoryEnum, PermissionEnum } from '../../src/enums/permission.enum.js';
import { PermissionEnumSchema } from '../../src/enums/permission.schema.js';
import {
    getPermissionsByCategory,
    PERMISSION_TO_CATEGORY
} from '../../src/utils/permission-grouping.js';

// ============================================================================
// PointOfInterest permissions — HOS-113 T-014
//
// 7 CRUD/lifecycle permissions (POINT_OF_INTEREST_*) plus the destination
// join-management permission (DESTINATION_POINT_OF_INTEREST_MANAGE).
//
// Deviation note (deliberate): unlike attraction's split-brain gate (route
// layer checks ATTRACTION_* while the service layer mostly checks
// DESTINATION_*), POI uses POINT_OF_INTEREST_* consistently at both layers.
// ============================================================================

describe('PointOfInterest permission enum values (HOS-113 T-014)', () => {
    describe('PermissionCategoryEnum.POINT_OF_INTEREST', () => {
        it('should be registered', () => {
            expect(PermissionCategoryEnum.POINT_OF_INTEREST).toBe('POINT_OF_INTEREST');
        });
    });

    describe('PermissionEnum POINT_OF_INTEREST_* values', () => {
        it('should define all 7 CRUD/lifecycle permissions', () => {
            expect(PermissionEnum.POINT_OF_INTEREST_CREATE).toBe('pointOfInterest.create');
            expect(PermissionEnum.POINT_OF_INTEREST_UPDATE).toBe('pointOfInterest.update');
            expect(PermissionEnum.POINT_OF_INTEREST_DELETE).toBe('pointOfInterest.delete');
            expect(PermissionEnum.POINT_OF_INTEREST_VIEW).toBe('pointOfInterest.view');
            expect(PermissionEnum.POINT_OF_INTEREST_RESTORE).toBe('pointOfInterest.restore');
            expect(PermissionEnum.POINT_OF_INTEREST_LIFECYCLE_CHANGE).toBe(
                'pointOfInterest.lifecycle.change'
            );
            expect(PermissionEnum.POINT_OF_INTEREST_HARD_DELETE).toBe('pointOfInterest.hardDelete');
        });

        it('should define the destination join-management permission', () => {
            expect(PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE).toBe(
                'destination.pointOfInterest.manage'
            );
        });

        it('should have unique string values (no collision with other permissions)', () => {
            const poiValues = [
                PermissionEnum.POINT_OF_INTEREST_CREATE,
                PermissionEnum.POINT_OF_INTEREST_UPDATE,
                PermissionEnum.POINT_OF_INTEREST_DELETE,
                PermissionEnum.POINT_OF_INTEREST_VIEW,
                PermissionEnum.POINT_OF_INTEREST_RESTORE,
                PermissionEnum.POINT_OF_INTEREST_LIFECYCLE_CHANGE,
                PermissionEnum.POINT_OF_INTEREST_HARD_DELETE,
                PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE
            ];

            const allValues = Object.values(PermissionEnum);
            for (const value of poiValues) {
                const occurrences = allValues.filter((v) => v === value).length;
                expect(occurrences, `"${value}" should be unique`).toBe(1);
            }
        });

        it('should parse successfully via PermissionEnumSchema', () => {
            expect(() =>
                PermissionEnumSchema.parse(PermissionEnum.POINT_OF_INTEREST_CREATE)
            ).not.toThrow();
            expect(() =>
                PermissionEnumSchema.parse(PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE)
            ).not.toThrow();
        });

        it('should reject an unknown permission string', () => {
            const result = PermissionEnumSchema.safeParse('pointOfInterest.notARealPermission');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });
    });

    describe('Category auto-derivation (permission-grouping)', () => {
        it('should categorize all POINT_OF_INTEREST_* keys under POINT_OF_INTEREST', () => {
            expect(PERMISSION_TO_CATEGORY[PermissionEnum.POINT_OF_INTEREST_CREATE]).toBe(
                PermissionCategoryEnum.POINT_OF_INTEREST
            );
            expect(PERMISSION_TO_CATEGORY[PermissionEnum.POINT_OF_INTEREST_VIEW]).toBe(
                PermissionCategoryEnum.POINT_OF_INTEREST
            );
            expect(PERMISSION_TO_CATEGORY[PermissionEnum.POINT_OF_INTEREST_HARD_DELETE]).toBe(
                PermissionCategoryEnum.POINT_OF_INTEREST
            );
        });

        it('should categorize DESTINATION_POINT_OF_INTEREST_MANAGE under DESTINATION (longest-prefix match)', () => {
            expect(
                PERMISSION_TO_CATEGORY[PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE]
            ).toBe(PermissionCategoryEnum.DESTINATION);
        });

        it('should list the POINT_OF_INTEREST category with its 7 permissions', () => {
            const grouped = getPermissionsByCategory();
            const poiPermissions = grouped.get(PermissionCategoryEnum.POINT_OF_INTEREST);

            expect(poiPermissions).toBeDefined();
            expect(poiPermissions).toHaveLength(7);
            expect(poiPermissions).toContain(PermissionEnum.POINT_OF_INTEREST_CREATE);
            expect(poiPermissions).not.toContain(
                PermissionEnum.DESTINATION_POINT_OF_INTEREST_MANAGE
            );
        });
    });
});
