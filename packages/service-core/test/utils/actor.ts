import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '../../src/types';

/**
 * Utility to create a safe and configurable actor for tests.
 * @param options - Options for id, role, and permissions
 * @returns Actor
 */
export const getSafeActor = ({
    id = 'user-1',
    roles = [RoleEnum.USER],
    permissions = []
}: Partial<Actor> = {}): Actor => ({
    id,
    roles,
    permissions: permissions as PermissionEnum[]
});
