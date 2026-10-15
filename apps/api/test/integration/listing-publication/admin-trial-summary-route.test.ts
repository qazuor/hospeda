/** TEST:V8a:7 (panel, fila 4): admin reads another user's trial facts. */
import { randomUUID } from 'node:crypto';
import { domainEventModel, getDb, sql, trialRedemptions } from '@repo/db';
import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createTrial,
    ensurePublicationCatalog
} from './publication-routes.helpers';

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;
const owners: string[] = [];
const adminHeaders = (id: string) =>
    actorHeaders({
        id,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
        ]
    });
async function newOwner(): Promise<string> {
    const row = await createOwner();
    owners.push(row.id);
    return row.id;
}
async function request(userId: string, vertical: string, headers: Record<string, string>) {
    return app.request(`/api/v1/admin/users/${userId}/trial-summary?vertical=${vertical}`, {
        headers
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const ids = owners.splice(0);
    if (ids.length)
        await getDb().execute(
            sql`DELETE FROM canje_de_trial WHERE user_id = ANY(${sql.param(ids)}::uuid[])`
        );
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V8a:7 (panel, fila 4) admin trial summary — %s', (vertical) => {
    it('returns the target summary and ceiling pinned to its trial row', async () => {
        await ensurePublicationCatalog(vertical);
        const actorId = await newOwner();
        const subjectId = await newOwner();
        await createTrial({ userId: actorId, vertical, status: 'TRIAL_ACTIVE' });
        await createTrial({ userId: subjectId, vertical, status: 'TRIAL_ACTIVE' });
        const [trial] = (
            await getDb().execute(sql<{
                id: string;
                startedAt: Date;
                endsAt: Date;
                deadlineVersion: number;
            }>`
            SELECT id, started_at AS "startedAt", ends_at AS "endsAt", deadlines_version AS "deadlineVersion" FROM trial
            WHERE user_id = ${subjectId}::uuid AND vertical = ${vertical}`)
        ).rows;
        const before = new Date(String(trial?.endsAt));
        const after = new Date(before.getTime() + 15 * 86_400_000);
        await getDb().execute(
            sql`UPDATE trial SET ends_at = ${after} WHERE id = ${String(trial?.id)}::uuid`
        );
        await getDb()
            .insert(trialRedemptions)
            .values({
                userId: subjectId,
                vertical,
                redemptionKey: `admin-summary-${randomUUID()}`,
                appliedDays: 10
            });
        await domainEventModel.insert({
            eventType: 'trial.extended',
            entityType: 'trial',
            entityId: String(trial?.id),
            actorType: 'admin',
            actorId,
            reason: 'TEST:V8a:7 panel row 4',
            correlationId: randomUUID(),
            changes: [{ field: 'days', new: 5 }]
        });
        const [deadline] = (
            await getDb().execute(sql<{ days: number }>`
            SELECT ("values"->'7'->>'days')::int AS days FROM vertical_deadline_version
            WHERE version = ${trial?.deadlineVersion}`)
        ).rows;
        const response = await request(subjectId, vertical, adminHeaders(actorId));
        expect(response.status).toBe(200);
        const body = (await response.json()) as { data: unknown };
        expect(body.data).toStrictEqual({
            summary: {
                status: 'TRIAL_ACTIVE',
                startedAt: new Date(String(trial?.startedAt)).toISOString(),
                endsAt: after.toISOString(),
                totalDays: 45,
                origins: { base: 30, promo: 10, support: 5 }
            },
            ceilingDays: deadline?.days
        });
    });
    it('returns NONE and null ceiling without a trial', async () => {
        const actorId = await newOwner();
        const subjectId = await newOwner();
        const response = await request(subjectId, vertical, adminHeaders(actorId));
        expect(response.status).toBe(200);
        expect(((await response.json()) as { data: unknown }).data).toStrictEqual({
            summary: { status: 'NONE' },
            ceilingDays: null
        });
    });
});

describe('TEST:V8a:7 (panel, fila 4) admin trial summary authorization', () => {
    it('returns 401 without session', async () => {
        const response = await app.request(
            `/api/v1/admin/users/${randomUUID()}/trial-summary?vertical=accommodation`,
            { headers: { 'user-agent': 'vitest' } }
        );
        expect(response.status).toBe(401);
    });
    it('returns 403 without inspection permission', async () => {
        const owner = await createOwner();
        const response = await request(owner.id, 'accommodation', actorHeaders({ id: owner.id }));
        expect(response.status).toBe(403);
    });
    it('returns 404 for a missing user', async () => {
        const owner = await createOwner();
        owners.push(owner.id);
        const response = await request(randomUUID(), 'accommodation', adminHeaders(owner.id));
        expect(response.status).toBe(404);
    });
});

it('TEST:V8a:7 (panel, fila 4) returns a converted row born without a clock', async () => {
    const vertical = VerticalEnum.ACCOMMODATION;
    await ensurePublicationCatalog(vertical);
    const actorId = await newOwner();
    const subjectId = await newOwner();
    await createTrial({ userId: subjectId, vertical, status: 'TRIAL_EXPIRED' });
    await getDb().execute(sql`UPDATE trial SET status = 'TRIAL_CONVERTED', started_at = NULL,
        ends_at = NULL, email_pseudonym = ${randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '')}
        WHERE user_id = ${subjectId}::uuid AND vertical = ${vertical}`);
    const [row] = (
        await getDb().execute(sql<{ deadlinesVersion: number | null; days: number }>`
        SELECT t.deadlines_version AS "deadlinesVersion",
        (v.values->'7'->>'days')::int AS days FROM trial t
        JOIN vertical_deadline_version v ON v.version = COALESCE(t.deadlines_version, 1)
        WHERE t.user_id = ${subjectId}::uuid AND t.vertical = ${vertical}`)
    ).rows;
    const response = await request(subjectId, vertical, adminHeaders(actorId));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toStrictEqual({
        summary: {
            status: 'TRIAL_CONVERTED',
            startedAt: null,
            endsAt: null,
            totalDays: 0,
            origins: { base: 0, promo: 0, support: 0 }
        },
        ceilingDays: row?.days
    });
});
