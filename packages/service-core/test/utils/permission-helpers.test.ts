/**
 * @fileoverview
 * Test suite for permission helper functions (checkPermission, checkGenericPermission, getPermissionDescription).
 * Ensures robust, type-safe, and comprehensive coverage of permission checking and error handling logic, including:
 * - Permission checks for actors with various roles and permissions
 * - Description generation for known and unknown permissions
 * - Edge cases and error scenarios for generic permission checks
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { PermissionEnum, ServiceErrorCode } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { ServiceError } from '../../src/types';
import {
    checkGenericPermission,
    checkPermission,
    getPermissionDescription
} from '../../src/utils/permission';
import { mockActor, mockAdminActor } from '../base/base.service.mockData';

/**
 * Test suite for permission helper functions.
 *
 * Esta suite verifica:
 * - Correct permission checks for all relevant scenarios
 * - Description generation for permissions
 * - Robustness against edge cases and error propagation
 *
 * The tests use various actors and permissions to ensure all logic is covered.
 */
describe('Permission Helper Functions', () => {
    describe('checkPermission', () => {
        it('should return true if actor has the permission', async () => {
            const result = await checkPermission(
                mockAdminActor,
                PermissionEnum.ACCOMMODATION_CREATE
            );
            expect(result).toBe(true);
        });

        it('should return false if actor does not have the permission', async () => {
            const result = await checkPermission(mockActor, PermissionEnum.ACCOMMODATION_CREATE);
            expect(result).toBe(false);
        });
    });

    describe('getPermissionDescription', () => {
        it('should return the correct description for a known permission', () => {
            const description = getPermissionDescription(PermissionEnum.ACCOMMODATION_CREATE);
            expect(description).toBe('You do not have permission to create accommodations.');
        });

        it('should return a generic description for an unknown permission', () => {
            // biome-ignore lint/suspicious/noExplicitAny: Testing an edge case
            const description = getPermissionDescription('UNKNOWN_PERMISSION' as any);
            expect(description).toBe('You do not have permission to perform this action.');
        });
    });

    describe('checkGenericPermission', () => {
        const anyPermission = PermissionEnum.ACCOMMODATION_UPDATE_ANY;
        const ownPermission = PermissionEnum.ACCOMMODATION_UPDATE_OWN;
        const errorMessage = 'You cannot update this accommodation.';

        it('should not throw if actor has the "any" permission', () => {
            expect(() =>
                checkGenericPermission(
                    mockAdminActor,
                    anyPermission,
                    ownPermission,
                    false,
                    errorMessage
                )
            ).not.toThrow();
        });

        it('should not throw if actor has the "own" permission and is the owner', () => {
            const ownerActor = {
                ...mockActor,
                permissions: [ownPermission]
            };
            expect(() =>
                checkGenericPermission(ownerActor, anyPermission, ownPermission, true, errorMessage)
            ).not.toThrow();
        });

        it('should throw a FORBIDDEN error if actor has "own" permission but is not the owner', () => {
            const nonOwnerActor = {
                ...mockActor,
                permissions: [ownPermission]
            };
            expect(() =>
                checkGenericPermission(
                    nonOwnerActor,
                    anyPermission,
                    ownPermission,
                    false,
                    errorMessage
                )
            ).toThrow(new ServiceError(ServiceErrorCode.FORBIDDEN, errorMessage));
        });

        it('should throw a FORBIDDEN error if actor has no relevant permissions', () => {
            expect(() =>
                checkGenericPermission(mockActor, anyPermission, ownPermission, true, errorMessage)
            ).toThrow(new ServiceError(ServiceErrorCode.FORBIDDEN, errorMessage));
        });
    });
});
