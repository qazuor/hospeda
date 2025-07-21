import type { Actor } from '@repo/service-core';
import type { PermissionEnum, RoleEnum } from '@repo/types';
import superAdminData from '../data/user/required/super-admin-user.json';

/**
 * Generates a super admin actor based on the super administrator user data.
 * This actor has all permissions and is used for seeding operations.
 *
 * @returns {Actor} A super admin actor with full permissions
 *
 * @example
 * ```ts
 * import { getSuperAdminActor } from './utils/actor';
 * import { AccommodationService } from '@repo/service-core';
 *
 * const actor = getSuperAdminActor();
 * const accommodationService = new AccommodationService(ctx);
 *
 * const result = await accommodationService.create(actor, {
 *   name: 'New Accommodation',
 *   description: 'Description...',
 *   // ... other fields
 * });
 * ```
 */
export const getSuperAdminActor = (): Actor => {
    return {
        id: superAdminData.id,
        role: superAdminData.role as RoleEnum,
        permissions: superAdminData.permissions as PermissionEnum[]
    };
};
