import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findById, grantRole, revokeRole } = vi.hoisted(() => ({
    findById: vi.fn(),
    grantRole: vi.fn(),
    revokeRole: vi.fn()
}));

vi.mock('@repo/db', () => ({
    UserModel: class {
        findById = findById;
    }
}));
vi.mock('../../../src/services/user-role/user-role.service.js', () => ({ grantRole, revokeRole }));

import { changeSuperAdminRole } from '../../../src/services/user-role/super-admin-role.service';
import { ServiceError } from '../../../src/types';
import { createActor, createSuperAdminActor } from '../../factories/actorFactory';

const subject = '22222222-2222-4222-8222-222222222222';
const permittedActor = () => createSuperAdminActor({ id: '11111111-1111-4111-8111-111111111111' });
const invoke = (overrides: Partial<Parameters<typeof changeSuperAdminRole>[0]> = {}) =>
    changeSuperAdminRole({
        actor: permittedActor(),
        userId: subject,
        change: 'ASSIGN',
        reason: '  approved  ',
        ...overrides
    });

describe('changeSuperAdminRole', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findById.mockResolvedValue({ id: subject });
        grantRole.mockResolvedValue({ data: { changed: true } });
        revokeRole.mockResolvedValue({ data: { changed: true } });
    });

    it.each([
        [
            'without the action permission',
            createActor({ permissions: [PermissionEnum.USER_UPDATE_ROLES] })
        ],
        [
            'with only USER_UPDATE_ROLES',
            createActor({ permissions: [PermissionEnum.USER_UPDATE_ROLES] })
        ],
        ['as a system actor', createSuperAdminActor({ _isSystemActor: true })]
    ])('rejects %s before any read or write', async (_label, actor) => {
        await expect(invoke({ actor })).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(findById).not.toHaveBeenCalled();
        expect(grantRole).not.toHaveBeenCalled();
        expect(revokeRole).not.toHaveBeenCalled();
    });

    it.each(['ASSIGN', 'REMOVE'] as const)('rejects self %s before reading', async (change) => {
        const actor = permittedActor();
        await expect(invoke({ actor, userId: actor.id, change })).rejects.toMatchObject({
            code: ServiceErrorCode.FORBIDDEN
        });
        expect(findById).not.toHaveBeenCalled();
    });

    it.each([undefined, '', '   '])('rejects missing or blank reason (%s)', async (reason) => {
        await expect(invoke({ reason })).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR
        });
        expect(findById).not.toHaveBeenCalled();
        expect(grantRole).not.toHaveBeenCalled();
    });

    it('rejects reasons longer than 500 characters', async () => {
        await expect(invoke({ reason: 'x'.repeat(501) })).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR
        });
        expect(findById).not.toHaveBeenCalled();
    });

    it('checks permission before reason validation', async () => {
        await expect(invoke({ actor: createActor(), reason: undefined })).rejects.toMatchObject({
            code: ServiceErrorCode.FORBIDDEN
        });
    });

    it('returns 404 for a missing subject', async () => {
        findById.mockResolvedValue(null);
        await expect(invoke()).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        expect(grantRole).not.toHaveBeenCalled();
    });

    it('assigns with actor attribution and a trimmed reason', async () => {
        const actor = permittedActor();
        await expect(invoke({ actor })).resolves.toEqual({ changed: true });
        expect(grantRole).toHaveBeenCalledWith({
            userId: subject,
            role: RoleEnum.SUPER_ADMIN,
            grantedBy: actor.id,
            reason: 'approved',
            ctx: undefined
        });
    });

    it('removes with actor attribution and a trimmed reason', async () => {
        const actor = permittedActor();
        await expect(invoke({ actor, change: 'REMOVE' })).resolves.toEqual({ changed: true });
        expect(revokeRole).toHaveBeenCalledWith({
            userId: subject,
            role: RoleEnum.SUPER_ADMIN,
            revokedBy: actor.id,
            reason: 'approved',
            ctx: undefined
        });
    });

    it('preserves the primitive error reason and propagates no-op outcomes', async () => {
        grantRole.mockResolvedValue({
            error: new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Last role',
                undefined,
                'LAST_ROLE_REVOKE_REASON'
            )
        });
        await expect(invoke()).rejects.toMatchObject({ reason: 'LAST_ROLE_REVOKE_REASON' });
        grantRole.mockResolvedValue({ data: { changed: false } });
        await expect(invoke()).resolves.toEqual({ changed: false });
    });
});
