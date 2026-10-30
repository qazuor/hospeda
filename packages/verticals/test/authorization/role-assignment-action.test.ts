import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ADMINISTRATIVE_ACTIONS, resolveRoleAssignmentAction } from '../../src';

describe('resolveRoleAssignmentAction', () => {
    it('maps SUPER_ADMIN to ACC_26', () => {
        const action = resolveRoleAssignmentAction({ role: RoleEnum.SUPER_ADMIN });
        expect(action).toBe('ACC_26');
        expect(ADMINISTRATIVE_ACTIONS).toContain(action);
    });

    it.each([
        RoleEnum.HOST,
        RoleEnum.ADMIN,
        RoleEnum.CLIENT_MANAGER,
        RoleEnum.USER
    ])('returns null for %s', (role) => expect(resolveRoleAssignmentAction({ role })).toBeNull());
});
