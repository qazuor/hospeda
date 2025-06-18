/**
 * actorFactory.ts
 *
 * Factory functions for generating Actor mock data for tests.
 * All mock data for service-core tests should be created here.
 */

import type { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import type { Actor } from '../../src/types';
import { getMockId } from '../factories/utilsFactory';

export type ActorWithPermissions = Actor & { permissions: PermissionEnum[] };

const baseActor: ActorWithPermissions = {
    id: getMockId('user') as Actor['id'],
    role: RoleEnum.USER,
    permissions: []
};

/**
 * Generates a mock Actor with permissions.
 * @param overrides - Partial fields to override defaults
 * @returns ActorWithPermissions
 */
export const createActor = (
    overrides: Partial<ActorWithPermissions> = {}
): ActorWithPermissions => ({
    ...baseActor,
    ...overrides,
    id: (overrides.id ?? getMockId('user')) as Actor['id'],
    role: overrides.role ?? RoleEnum.USER,
    permissions: overrides.permissions ?? []
});

/**
 * Generates an array of mock Actors.
 * @param count - Number of actors to generate
 * @returns ActorWithPermissions[]
 */
export const createActors = (count = 3): ActorWithPermissions[] =>
    Array.from({ length: count }, (_, i) =>
        createActor({
            id: getMockId('user', `user-${i + 1}`) as Actor['id'],
            role: i === 0 ? RoleEnum.ADMIN : RoleEnum.USER,
            permissions: []
        })
    );
