import { ServiceErrorCode } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { grantRole, revokeRole, getUserRoles, changeSuperAdminRole } = vi.hoisted(() => ({
    grantRole: vi.fn(),
    revokeRole: vi.fn(),
    getUserRoles: vi.fn(),
    changeSuperAdminRole: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    grantRole,
    revokeRole,
    getUserRoles,
    changeSuperAdminRole
}));

import { ServiceError } from '@repo/service-core';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('roles route action 26 dispatch', () => {
    let app: AppOpenAPI;
    const actorId = '11111111-1111-4111-8111-111111111111';
    const subjectId = '22222222-2222-4222-8222-222222222222';
    const base = `/api/v1/admin/users/${subjectId}/roles`;
    const headers = (permissions: string[]) => ({
        authorization: 'Bearer mock-token',
        'user-agent': 'vitest',
        'x-mock-actor-id': actorId,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...permissions])
    });

    beforeAll(() => {
        app = initApp();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        grantRole.mockResolvedValue({ data: { changed: true } });
        revokeRole.mockResolvedValue({ data: { changed: true } });
        getUserRoles.mockResolvedValue(['USER', 'SUPER_ADMIN']);
        changeSuperAdminRole.mockResolvedValue({ changed: true });
    });

    it.each([
        ['POST', 'ASSIGN'],
        ['DELETE', 'REMOVE']
    ] as const)('dispatches SUPER_ADMIN %s to action 26', async (method, change) => {
        const response = await app.request(
            method === 'POST' ? base : `${base}/SUPER_ADMIN?reason=approved`,
            {
                method,
                headers: {
                    ...headers(['user.update.roles']),
                    ...(method === 'POST' ? { 'content-type': 'application/json' } : {})
                },
                ...(method === 'POST'
                    ? { body: JSON.stringify({ role: 'SUPER_ADMIN', reason: 'approved' }) }
                    : {})
            }
        );
        expect(response.status).toBe(method === 'POST' ? 201 : 200);
        expect(changeSuperAdminRole).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: actorId }),
            userId: subjectId,
            change,
            reason: 'approved'
        });
        expect(grantRole).not.toHaveBeenCalled();
        expect(revokeRole).not.toHaveBeenCalled();
    });

    it('keeps HOST on the existing grant path', async () => {
        const response = await app.request(base, {
            method: 'POST',
            headers: { ...headers(['user.update.roles']), 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'HOST' })
        });
        expect(response.status).toBe(201);
        expect(grantRole).toHaveBeenCalledOnce();
        expect(changeSuperAdminRole).not.toHaveBeenCalled();
    });

    it.each([
        [ServiceErrorCode.FORBIDDEN, 403],
        [ServiceErrorCode.VALIDATION_ERROR, 400],
        [ServiceErrorCode.NOT_FOUND, 404]
    ])('passes service error %s as HTTP %i', async (code, status) => {
        changeSuperAdminRole.mockRejectedValue(new ServiceError(code, 'Rejected'));
        const response = await app.request(base, {
            method: 'POST',
            headers: { ...headers(['user.update.roles']), 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'SUPER_ADMIN', reason: 'ok' })
        });
        expect(response.status).toBe(status);
    });

    it('blocks without USER_UPDATE_ROLES before dispatch', async () => {
        const response = await app.request(base, {
            method: 'POST',
            headers: { ...headers([]), 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'SUPER_ADMIN' })
        });
        expect(response.status).toBe(403);
        expect(changeSuperAdminRole).not.toHaveBeenCalled();
        expect(grantRole).not.toHaveBeenCalled();
    });
});
