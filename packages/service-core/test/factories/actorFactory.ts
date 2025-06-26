/**
 * actorFactory.ts
 *
 * Factory functions and builder for generating Actor mock data for tests.
 * All mock data for service-core tests should be created here.
 */

import { PermissionEnum, RoleEnum } from '@repo/types';
import type { Actor } from '../../src/types';
import { getMockId } from '../factories/utilsFactory';
import { BaseFactoryBuilder } from './baseEntityFactory';

/**
 * Base actor object with default values for a standard user.
 */
const baseActor: Actor = {
    id: getMockId('user'),
    role: RoleEnum.USER,
    permissions: []
};

/**
 * Creates a mock Actor object using the builder pattern, allowing for overrides.
 * @param overrides - Partial actor object to override default values.
 * @returns {Actor} A complete mock Actor object.
 * @example
 * const actor = createActor({ id: 'user-1', role: RoleEnum.ADMIN });
 */
export const createActor = (overrides: Partial<Actor> = {}): Actor =>
    new ActorFactoryBuilder().with(overrides).build();

/**
 * Creates a mock GUEST actor (anonymous, no permissions) using the builder.
 * @param overrides - Partial actor object to override default guest values.
 * @returns {Actor} A mock guest Actor object.
 */
export const createGuestActor = (overrides: Partial<Actor> = {}): Actor =>
    new ActorFactoryBuilder().guest().with(overrides).build();

/**
 * Creates a mock HOST actor (can manage own accommodations) using the builder.
 * @param overrides - Partial actor object to override default host values.
 * @returns {Actor} A mock host Actor object.
 */
export const createHostActor = (overrides: Partial<Actor> = {}): Actor =>
    new ActorFactoryBuilder().host().with(overrides).build();

/**
 * Creates a mock ADMIN actor (can manage any accommodation) using the builder.
 * @param overrides - Partial actor object to override default admin values.
 * @returns {Actor} A mock admin Actor object.
 */
export const createAdminActor = (overrides: Partial<Actor> = {}): Actor =>
    new ActorFactoryBuilder().admin().with(overrides).build();

/**
 * Creates a mock SUPER_ADMIN actor (all permissions) using the builder.
 * @param overrides - Partial actor object to override default super admin values.
 * @returns {Actor} A mock super admin Actor object.
 */
export const createSuperAdminActor = (overrides: Partial<Actor> = {}): Actor =>
    new ActorFactoryBuilder().superAdmin().with(overrides).build();

/**
 * Builder pattern for generating Actor mocks in tests.
 *
 * Allows fluent, type-safe creation of Actor objects for different roles and permissions.
 *
 * @example
 * const actor = new ActorFactoryBuilder().host().withId('user-123').withPermissions([PermissionEnum.ACCOMMODATION_CREATE]).build();
 */
export class ActorFactoryBuilder extends BaseFactoryBuilder<Actor> {
    constructor() {
        super(baseActor);
    }
    /**
     * Sets the actor as a guest (anonymous, no permissions).
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public guest(): this {
        return this.with({
            id: '',
            role: RoleEnum.GUEST,
            permissions: []
        });
    }
    /**
     * Sets the actor as a host (can manage own accommodations).
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public host(): this {
        return this.with({
            id: getMockId('user', 'host'),
            role: RoleEnum.HOST,
            permissions: [
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_DELETE_OWN
            ]
        });
    }
    /**
     * Sets the actor as an admin (can manage any accommodation).
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public admin(): this {
        return this.with({
            id: getMockId('user', 'admin'),
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ]
        });
    }
    /**
     * Sets the actor as a super admin (all permissions).
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public superAdmin(): this {
        return this.with({
            id: getMockId('user', 'super-admin'),
            role: RoleEnum.SUPER_ADMIN,
            permissions: Object.values(PermissionEnum)
        });
    }
    /**
     * Sets a custom ID for the actor.
     * @param id - The user ID to assign.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withId(id: string): this {
        return this.with({ id });
    }
    /**
     * Sets custom permissions for the actor.
     * @param permissions - Array of permissions to assign.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withPermissions(permissions: Actor['permissions']): this {
        return this.with({ permissions });
    }
    /**
     * Sets a custom role for the actor.
     * @param role - The role to assign.
     * @returns {ActorFactoryBuilder} The builder instance for chaining.
     */
    public withRole(role: RoleEnum): this {
        return this.with({ role });
    }
}
