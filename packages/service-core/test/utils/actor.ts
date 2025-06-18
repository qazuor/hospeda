import { type PermissionEnum, RoleEnum } from '@repo/types';
import type { Actor } from '../../src/types';

/**
 * Utilidad para crear un actor seguro y configurable para tests.
 * @param options - Opciones para id, role y permissions
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
