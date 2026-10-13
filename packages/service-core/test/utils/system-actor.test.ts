import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { ADMINISTRATIVE_ACTION_PERMISSION_SET } from '@repo/verticals';
import { describe, expect, it } from 'vitest';
import {
    createSystemActor,
    isSystemActor,
    SYSTEM_ACTOR_ID,
    SystemActorDefinitionError
} from '../../src/utils/system-actor';

const makeActor = (permissions: readonly PermissionEnum[] = []) =>
    createSystemActor({ jobId: 'test.job', permissions });

function expectDefinitionError(
    run: () => unknown,
    code: SystemActorDefinitionError['code'],
    permission?: PermissionEnum
): void {
    try {
        run();
        throw new Error('Expected system actor construction to fail');
    } catch (error) {
        expect(error).toBeInstanceOf(SystemActorDefinitionError);
        const definitionError = error as SystemActorDefinitionError;
        expect(definitionError.code).toBe(code);
        if (permission) {
            expect(definitionError.permissions).toContain(permission);
        }
    }
}

describe('TEST:V5:14 — la fábrica de actores de sistema', () => {
    it.each([
        ...ADMINISTRATIVE_ACTION_PERMISSION_SET
    ])('rejects administrative permission %s', (permission) => {
        expectDefinitionError(
            () => makeActor([permission]),
            'ADMINISTRATIVE_PERMISSION',
            permission
        );
        expect(() => makeActor([permission])).toThrow(/ACC_\d+/);
    });

    it.each([
        PermissionEnum.ACCOMMODATION_DELETE_ANY,
        PermissionEnum.ACCOMMODATION_HARD_DELETE,
        PermissionEnum.GASTRONOMY_DELETE,
        PermissionEnum.EXPERIENCE_DELETE
    ])('TEST:V8a:10 still rejects the retiring delete permission %s (V6.7, HOS-1477)', (permission) => {
        expectDefinitionError(
            () => makeActor([permission]),
            'ADMINISTRATIVE_PERMISSION',
            permission
        );
        expect(() => makeActor([permission])).toThrow(/ACC_23/);
    });

    it('TEST:V8a:15 rejects the action 24 own permission user.closeOnRequest', () => {
        expectDefinitionError(
            () => makeActor([PermissionEnum.USER_CLOSE_ON_REQUEST]),
            'ADMINISTRATIVE_PERMISSION',
            PermissionEnum.USER_CLOSE_ON_REQUEST
        );
        expect(() => makeActor([PermissionEnum.USER_CLOSE_ON_REQUEST])).toThrow(
            /administrative action ACC_24$/
        );
    });

    it.each([
        PermissionEnum.USER_DELETE,
        PermissionEnum.USER_HARD_DELETE
    ])('TEST:V8a:15 still rejects the retiring account permission %s as former ACC_24', (permission) => {
        expectDefinitionError(
            () => makeActor([permission]),
            'ADMINISTRATIVE_PERMISSION',
            permission
        );
        expect(() => makeActor([permission])).toThrow(/administrative action ACC_24$/);
    });

    it('rejects the complete PermissionEnum with its explicit error', () => {
        const allPermissions = Object.values(PermissionEnum);
        expectDefinitionError(() => makeActor(allPermissions), 'ALL_PERMISSIONS');
    });

    it('builds an immutable SYSTEM actor with the exact declared permissions', () => {
        const permissions = [PermissionEnum.CONVERSATION_VIEW_ANY];
        const actor = createSystemActor({ jobId: 'conversation.test-job', permissions });

        expect(actor.id).toBe(SYSTEM_ACTOR_ID);
        expect(actor.roles).toEqual([RoleEnum.SYSTEM]);
        expect(actor.roles).not.toContain(RoleEnum.SUPER_ADMIN);
        expect(actor._isSystemActor).toBe(true);
        expect(isSystemActor(actor)).toBe(true);
        expect(actor._systemJobId).toBe('conversation.test-job');
        expect(actor.permissions).toEqual(permissions);
        expect(Object.isFrozen(actor)).toBe(true);
        expect(Object.isFrozen(actor.roles)).toBe(true);
        expect(Object.isFrozen(actor.permissions)).toBe(true);
    });

    it.each(['', 'Conversation.job', 'conversation job'])('rejects invalid jobId %j', (jobId) => {
        expectDefinitionError(() => createSystemActor({ jobId, permissions: [] }), 'INVALID_INPUT');
    });

    it('rejects a value outside PermissionEnum', () => {
        expectDefinitionError(
            () => makeActor(['NOT_A_PERMISSION' as PermissionEnum]),
            'INVALID_INPUT'
        );
    });
});
