import { eq, getDb, partners, users } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

function headers(userId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': userId,
        'x-mock-actor-role': 'ADMIN',
        'x-mock-actor-permissions': JSON.stringify([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.PARTNER_MANAGE
        ])
    };
}

describe('TEST:V5:8 manual payment account subject', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    afterAll(async () => testDb.teardown());

    it('rejects self payment without writing, then records a staff payment with its subject', async () => {
        const db = getDb();
        const [owner, staff] = await db
            .insert(users)
            .values([
                {
                    email: `v5-owner-${crypto.randomUUID()}@example.test`,
                    displayName: 'Partner owner',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                },
                {
                    email: `v5-staff-${crypto.randomUUID()}@example.test`,
                    displayName: 'Staff',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                }
            ])
            .returning();
        if (!owner || !staff) throw new Error('Missing test users');
        const [partner] = await db
            .insert(partners)
            .values({
                slug: `v5-${crypto.randomUUID()}`,
                name: 'Manual payment partner',
                type: 'business',
                tier: 'silver',
                lifecycleState: 'DRAFT',
                ownerUserId: owner.id,
                contentApprovedAt: new Date()
            })
            .returning();
        if (!partner) throw new Error('Missing test partner');
        const app = initApp();
        const path = `/api/v1/admin/partners/${partner.id}/manual-payment`;
        const request = (userId: string) =>
            app.request(path, {
                method: 'POST',
                headers: headers(userId),
                body: JSON.stringify({ note: 'Paid offline' })
            });

        audit.mockClear();
        const denied = await request(owner.id);
        expect(denied.status).toBe(403);
        expect((await denied.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
        const [unchanged] = await db.select().from(partners).where(eq(partners.id, partner.id));
        expect(unchanged).toEqual(partner);
        expect(audit).not.toHaveBeenCalled();

        const accepted = await request(staff.id);
        expect(accepted.status).toBe(200);
        const [updated] = await db.select().from(partners).where(eq(partners.id, partner.id));
        expect(updated?.lifecycleState).toBe('ACTIVE');
        expect(updated?.startsAt).toBeInstanceOf(Date);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: staff.id,
                metadata: expect.objectContaining({
                    subjectId: owner.id,
                    administrativeAction: 'ACC_3',
                    note: 'Paid offline'
                })
            })
        );
    });
});
