import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
/**
 * Test suite for AmenityService permission helpers
 *
 * This suite covers:
 * - Permission checks for adding and removing amenities from accommodations
 * - Ensures correct ServiceError is thrown for missing permissions
 */
import { describe, expect, it } from 'vitest';
import {
    checkCanAddAmenityToAccommodation,
    checkCanRemoveAmenityFromAccommodation
} from '../../../src/services/amenity/amenity.permissions';
import { type Actor, ServiceError } from '../../../src/types';

const actorWithPerms: Actor = {
    id: 'user-1',
    role: RoleEnum.USER,
    permissions: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
};
const actorNoPerms: Actor = { id: 'user-2', role: RoleEnum.USER, permissions: [] };

describe('AmenityService permissions', () => {
    it('should allow adding amenity to accommodation if actor has permission', () => {
        expect(() => checkCanAddAmenityToAccommodation(actorWithPerms)).not.toThrow();
    });
    it('should throw FORBIDDEN if actor lacks permission to add amenity', () => {
        try {
            checkCanAddAmenityToAccommodation(actorNoPerms);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
    it('should allow removing amenity from accommodation if actor has permission', () => {
        expect(() => checkCanRemoveAmenityFromAccommodation(actorWithPerms)).not.toThrow();
    });
    it('should throw FORBIDDEN if actor lacks permission to remove amenity', () => {
        try {
            checkCanRemoveAmenityFromAccommodation(actorNoPerms);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});
