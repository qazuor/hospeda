/**
 * actorFactory.ts
 *
 * Factory functions and builder for generating Actor mock data for tests.
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
 * This is the base factory function for all actor types.
 *
 * @param overrides - Partial actor object to override default values.
 * @returns {Actor} A complete mock Actor object.
 *
 * @example
 * const actor = createActor({ id: 'user-1', role: RoleEnum.ADMIN });
 */
export const createActor = (overrides: Partial<Actor> = {}): Actor => ({
    ...baseActor,
    ...overrides
});

/**
 * Creates a mock GUEST actor (anonymous, no permissions).
 *
 * @param overrides - Partial actor object to override default guest values.
 * @returns {Actor} A mock guest Actor object.
 */
export const createGuestActor = (overrides: Partial<Actor> = {}): Actor =>
    createActor({
        id: '', // Guests are anonymous
        role: RoleEnum.GUEST,
        permissions: [],
        ...overrides
    });

/**
 * Creates a mock HOST actor (can manage own accommodations).
 *
 * @param overrides - Partial actor object to override default host values.
 * @returns {Actor} A mock host Actor object.
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
 * Creates a mock ADMIN actor (can manage any accommodation).
 *
 * @param overrides - Partial actor object to override default admin values.
 * @returns {Actor} A mock admin Actor object.
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
 * Creates a mock SUPER_ADMIN actor (all permissions).
 *
 * @param overrides - Partial actor object to override default super admin values.
 * @returns {Actor} A mock super admin Actor object.
 */
export const createSuperAdminActor = (overrides: Partial<Actor> = {}): Actor =>
    createActor({
        id: getMockId('user', 'super-admin'),
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum), // All permissions
        ...overrides
    });

/**
 * Builder pattern for generating Actor mocks in tests.
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
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public guest(): this {
        this.data.id = '';
        this.data.role = RoleEnum.GUEST;
        this.data.permissions = [];
        return this;
    }
    /**
     * Sets the actor as a host (can manage own accommodations).
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
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
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
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
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public superAdmin(): this {
        this.data.id = getMockId('user', 'super-admin');
        this.data.role = RoleEnum.SUPER_ADMIN;
        this.data.permissions = Object.values(PermissionEnum);
        return this;
    }
    /**
     * Sets a custom ID for the actor.
     * @param id - The user ID to assign.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withId(id: string): this {
        this.data.id = id;
        return this;
    }
    /**
     * Sets custom permissions for the actor.
     * @param permissions - Array of permissions to assign.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withPermissions(permissions: Actor['permissions']): this {
        this.data.permissions = permissions;
        return this;
    }
    /**
     * Sets a custom role for the actor.
     * @param role - The role to assign.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withRole(role: RoleEnum): this {
        this.data.role = role;
        return this;
    }
    /**
     * Applies arbitrary overrides to the actor object.
     * @param overrides - Partial actor fields to override.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withOverrides(overrides: Partial<Actor>): this {
        Object.assign(this.data, overrides);
        return this;
    }
    /**
     * Builds and returns the Actor object with all applied overrides.
     * @returns {Actor} The resulting mock Actor object.
     */
    public build(): Actor {
        return { ...baseActor, ...this.data };
    }
}
