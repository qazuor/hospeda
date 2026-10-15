/** TEST:V5:17 — action 26 changes SUPER_ADMIN only with its own permission, reason, and audit. */

import { randomUUID } from 'node:crypto';
import { and, eq, getDb, sql, userRole, userRoleAudit } from '@repo/db';
import { RoleGrantActionEnum as AuditAction, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    readResponse
} from '../listing-publication/publication-routes.helpers';

const app = initApp();
const createdIds: string[] = [];
const reason = 'Aprobado por revisión de seguridad';
const actionPermissions = [
    PermissionEnum.USER_UPDATE_ROLES,
    PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE
];

async function account(): Promise<string> {
    const created = await createOwner();
    createdIds.push(created.id);
    await getDb().insert(userRole).values({ userId: created.id, role: RoleEnum.USER });
    return created.id;
}

function headers(id: string, permissions: readonly PermissionEnum[]) {
    return actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions]
    });
}

async function request(input: {
    readonly method: 'POST' | 'DELETE';
    readonly actorId: string;
    readonly userId: string;
    readonly permissions: readonly PermissionEnum[];
    readonly reason?: string;
    readonly role?: RoleEnum;
}) {
    const role = input.role ?? RoleEnum.SUPER_ADMIN;
    const url =
        input.method === 'POST'
            ? `/api/v1/admin/users/${input.userId}/roles`
            : `/api/v1/admin/users/${input.userId}/roles/${role}${input.reason === undefined ? '' : `?reason=${encodeURIComponent(input.reason)}`}`;
    const response = await app.request(url, {
        method: input.method,
        headers: headers(input.actorId, input.permissions),
        ...(input.method === 'POST'
            ? {
                  body: JSON.stringify({
                      role,
                      ...(input.reason === undefined ? {} : { reason: input.reason })
                  })
              }
            : {})
    });
    return readResponse(response);
}

async function subjectRoles(userId: string) {
    return getDb()
        .select()
        .from(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.role, RoleEnum.SUPER_ADMIN)));
}

async function auditRows(userId: string, action: AuditAction) {
    return getDb()
        .select()
        .from(userRoleAudit)
        .where(
            and(
                eq(userRoleAudit.userId, userId),
                eq(userRoleAudit.role, RoleEnum.SUPER_ADMIN),
                eq(userRoleAudit.action, action)
            )
        );
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const db = getDb();
    for (const id of createdIds.splice(0)) {
        await db.delete(userRoleAudit).where(eq(userRoleAudit.userId, id));
        await db.delete(userRole).where(eq(userRole.userId, id));
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V5:17 action 26 role assignment and removal', () => {
    it('assigns and removes with actor, subject, reason, and one audit row per change', async () => {
        const actorId = await account();
        const subjectId = await account();
        const assigned = await request({
            method: 'POST',
            actorId,
            userId: subjectId,
            permissions: actionPermissions,
            reason
        });
        expect(assigned.status).toBe(201);
        expect(await subjectRoles(subjectId)).toHaveLength(1);
        const grants = await auditRows(subjectId, AuditAction.GRANT);
        expect(grants).toHaveLength(1);
        expect(grants.some((row) => row.by === actorId && row.reason === reason)).toBe(true);

        const removed = await request({
            method: 'DELETE',
            actorId,
            userId: subjectId,
            permissions: actionPermissions,
            reason: 'Fin de la cobertura'
        });
        expect(removed.status).toBe(200);
        expect(await subjectRoles(subjectId)).toHaveLength(0);
        const revokes = await auditRows(subjectId, AuditAction.REVOKE);
        expect(revokes).toHaveLength(1);
        expect(
            revokes.some((row) => row.by === actorId && row.reason === 'Fin de la cobertura')
        ).toBe(true);
    });

    it.each([
        'POST',
        'DELETE'
    ] as const)('refuses self %s and leaves roles/audit unchanged', async (method) => {
        const id = await account();
        const response = await request({
            method,
            actorId: id,
            userId: id,
            permissions: actionPermissions,
            reason
        });
        expect(response.status).toBe(403);
        expect(await subjectRoles(id)).toHaveLength(0);
        expect(await auditRows(id, AuditAction.GRANT)).toHaveLength(0);
        expect(await auditRows(id, AuditAction.REVOKE)).toHaveLength(0);
    });

    it.each([
        ['POST', undefined],
        ['POST', '   '],
        ['DELETE', undefined],
        ['DELETE', '   ']
    ] as const)('rejects %s with missing or blank reason (%s) without writes', async (method, reasonValue) => {
        const actorId = await account();
        const subjectId = await account();
        const response = await request({
            method,
            actorId,
            userId: subjectId,
            permissions: actionPermissions,
            reason: reasonValue
        });
        expect(response.status).toBe(400);
        expect(await subjectRoles(subjectId)).toHaveLength(0);
        expect(await auditRows(subjectId, AuditAction.GRANT)).toHaveLength(0);
        expect(await auditRows(subjectId, AuditAction.REVOKE)).toHaveLength(0);
    });

    it('refuses ADMIN action 26 but permits the legacy HOST assignment', async () => {
        const actorId = await account();
        const subjectId = await account();
        const denied = await request({
            method: 'POST',
            actorId,
            userId: subjectId,
            permissions: [PermissionEnum.USER_UPDATE_ROLES],
            reason
        });
        expect(denied.status).toBe(403);
        expect(await subjectRoles(subjectId)).toHaveLength(0);
        const legacy = await request({
            method: 'POST',
            actorId,
            userId: subjectId,
            permissions: [PermissionEnum.USER_UPDATE_ROLES],
            role: RoleEnum.HOST
        });
        expect(legacy.status).toBe(201);
        expect(
            await getDb()
                .select()
                .from(userRole)
                .where(and(eq(userRole.userId, subjectId), eq(userRole.role, RoleEnum.HOST)))
        ).toHaveLength(1);
    });

    it('an ADMIN cannot remove SUPER_ADMIN from another account', async () => {
        const actorId = await account();
        const subjectId = await account();
        await getDb().insert(userRole).values({ userId: subjectId, role: RoleEnum.SUPER_ADMIN });
        const response = await request({
            method: 'DELETE',
            actorId,
            userId: subjectId,
            permissions: [PermissionEnum.USER_UPDATE_ROLES],
            reason
        });
        expect(response.status).toBe(403);
        expect(await subjectRoles(subjectId)).toHaveLength(1);
        expect(await auditRows(subjectId, AuditAction.REVOKE)).toHaveLength(0);
    });

    it('permission refusal precedes missing reason, and a missing subject is 404', async () => {
        const actorId = await account();
        const subjectId = await account();
        const noPermission = await request({
            method: 'POST',
            actorId,
            userId: subjectId,
            permissions: [PermissionEnum.USER_UPDATE_ROLES]
        });
        expect(noPermission.status).toBe(403);
        const missing = await request({
            method: 'POST',
            actorId,
            userId: randomUUID(),
            permissions: actionPermissions,
            reason
        });
        expect(missing.status).toBe(404);
    });

    it('is idempotent and does not add a second grant audit', async () => {
        const actorId = await account();
        const subjectId = await account();
        await request({
            method: 'POST',
            actorId,
            userId: subjectId,
            permissions: actionPermissions,
            reason
        });
        const repeated = await request({
            method: 'POST',
            actorId,
            userId: subjectId,
            permissions: actionPermissions,
            reason
        });
        expect(repeated.status).toBe(201);
        expect(await auditRows(subjectId, AuditAction.GRANT)).toHaveLength(1);
    });
});
