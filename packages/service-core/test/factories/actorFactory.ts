/**
 * actorFactory.ts
 *
 * Factory functions for generating Actor mock data for tests.
 * All mock data for service-core tests should be created here.
 */

import { PermissionEnum, RoleEnum } from '@repo/types';
import type { Actor } from '../../src/types';
import { getMockId } from '../factories/utilsFactory';

/**
 * Base actor object with default values for a standard user.
 */
const baseActor: Actor = {
    id: getMockId('user'),
    role: RoleEnum.USER,
    permissions: []
};

/**
 * Creates a mock Actor object, allowing for overrides.
 * This is the base factory function.
 * @param overrides - Partial actor object to override default values.
 * @returns A complete mock Actor object.
 */
export const createActor = (overrides: Partial<Actor> = {}): Actor => ({
    ...baseActor,
    ...overrides
});

/**
 * Creates a mock GUEST actor.
 * Guests have no ID, the GUEST role, and no permissions.
 * @param overrides - Partial actor object to override default guest values.
 * @returns A mock guest Actor object.
 */
export const createGuestActor = (overrides: Partial<Actor> = {}): Actor =>
    createActor({
        id: '', // Guests are anonymous
        role: RoleEnum.GUEST,
        permissions: [],
        ...overrides
    });

/**
 * Creates a mock HOST actor.
 * Hosts have the HOST role and default permissions to manage their own accommodations.
 * @param overrides - Partial actor object to override default host values.
 * @returns A mock host Actor object.
 */
export const createHostActor = (overrides: Partial<Actor> = {}): Actor =>
    createActor({
        id: getMockId('user', 'host'),
        role: RoleEnum.HOST,
        permissions: [
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.ACCOMMODATION_DELETE_OWN
        ],
        ...overrides
    });

/**
 * Creates a mock ADMIN actor.
 * Admins have the ADMIN role and permissions to manage any accommodation.
 * @param overrides - Partial actor object to override default admin values.
 * @returns A mock admin Actor object.
 */
export const createAdminActor = (overrides: Partial<Actor> = {}): Actor =>
    createActor({
        id: getMockId('user', 'admin'),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            PermissionEnum.ACCOMMODATION_DELETE_ANY,
            PermissionEnum.ACCOMMODATION_VIEW_ALL
        ],
        ...overrides
    });

/**
 * Creates a mock SUPER_ADMIN actor.
 * Super admins have the SUPER_ADMIN role and all permissions.
 * @param overrides - Partial actor object to override default super admin values.
 * @returns A mock super admin Actor object.
 */
export const createSuperAdminActor = (overrides: Partial<Actor> = {}): Actor =>
    createActor({
        id: getMockId('user', 'super-admin'),
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum), // All permissions
        ...overrides
    });

/**
 * ActorFactoryBuilder
 * Builder pattern for Actor mocks in tests.
 *
 * Allows fluent, type-safe creation of Actor objects for different roles and permissions.
 *
 * @example
 * const actor = new ActorFactoryBuilder().host().withId('user-123').withPermissions([PermissionEnum.ACCOMMODATION_CREATE]).build();
 */
export class ActorFactoryBuilder {
    private data: Partial<Actor> = {};
    /**
     * Sets the actor as a guest (anonymous, no permissions).
     * @returns {ActorFactoryBuilder}
     */
    public guest(): this {
        this.data.id = '';
        this.data.role = RoleEnum.GUEST;
        this.data.permissions = [];
        return this;
    }
    /**
     * Sets the actor as a host (can manage own accommodations).
     * @returns {ActorFactoryBuilder}
     */
    public host(): this {
        this.data.id = getMockId('user', 'host');
        this.data.role = RoleEnum.HOST;
        this.data.permissions = [
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.ACCOMMODATION_DELETE_OWN
        ];
        return this;
    }
    /**
     * Sets the actor as an admin (can manage any accommodation).
     * @returns {ActorFactoryBuilder}
     */
    public admin(): this {
        this.data.id = getMockId('user', 'admin');
        this.data.role = RoleEnum.ADMIN;
        this.data.permissions = [
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            PermissionEnum.ACCOMMODATION_DELETE_ANY,
            PermissionEnum.ACCOMMODATION_VIEW_ALL
        ];
        return this;
    }
    /**
     * Sets the actor as a super admin (all permissions).
     * @returns {ActorFactoryBuilder}
     */
    public superAdmin(): this {
        this.data.id = getMockId('user', 'super-admin');
        this.data.role = RoleEnum.SUPER_ADMIN;
        this.data.permissions = Object.values(PermissionEnum);
        return this;
    }
    /**
     * Sets a custom ID for the actor.
     * @param {string} id - The user ID.
     * @returns {ActorFactoryBuilder}
     */
    public withId(id: string): this {
        this.data.id = id;
        return this;
    }
    /**
     * Sets custom permissions for the actor.
     * @param {PermissionEnum[]} permissions - Array of permissions.
     * @returns {ActorFactoryBuilder}
     */
    public withPermissions(permissions: Actor['permissions']): this {
        this.data.permissions = permissions;
        return this;
    }
    /**
     * Sets a custom role for the actor.
     * @param {RoleEnum} role - The role to assign.
     * @returns {ActorFactoryBuilder}
     */
    public withRole(role: RoleEnum): this {
        this.data.role = role;
        return this;
    }
    /**
     * Applies arbitrary overrides to the actor object.
     * @param {Partial<Actor>} overrides - Partial actor fields.
     * @returns {ActorFactoryBuilder}
     */
    public withOverrides(overrides: Partial<Actor>): this {
        Object.assign(this.data, overrides);
        return this;
    }
    /**
     * Builds and returns the Actor object.
     * @returns {Actor}
     */
    public build(): Actor {
        return { ...baseActor, ...this.data };
    }
}
