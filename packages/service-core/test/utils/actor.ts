import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '../../src/types';

/**
 * Utility to create a safe and configurable actor for tests.
 * @param options - Options for id, role, and permissions
 * @returns Actor
 */
export const getSafeActor = ({
    id = 'user-1',
    role = RoleEnum.USER,
    permissions = []
}: Partial<Actor> = {}): Actor => ({
    id,
    role,
    permissions: permissions as PermissionEnum[]
});
