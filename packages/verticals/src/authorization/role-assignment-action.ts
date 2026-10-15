import type { RoleEnum } from '@repo/schemas';
import { RoleEnum as Role } from '@repo/schemas';
import type { AdministrativeAction } from './administrative-actions';

/** Administrative action required to assign a particular role. */
export const ROLE_ASSIGNMENT_ACTION: Readonly<Partial<Record<RoleEnum, AdministrativeAction>>> = {
    [Role.SUPER_ADMIN]: 'ACC_26'
};

/**
 * Resolves the administrative action for the role being assigned, not the
 * actor's role.
 * @param input.role - Role the caller is attempting to assign.
 * @returns The action required for the role, or `null` for ordinary roles.
 */
export function resolveRoleAssignmentAction(input: {
    readonly role: RoleEnum;
}): AdministrativeAction | null {
    return ROLE_ASSIGNMENT_ACTION[input.role] ?? null;
}
