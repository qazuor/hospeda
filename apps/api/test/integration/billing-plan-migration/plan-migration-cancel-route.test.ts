import { emailOutbox, eq, getDb, planMigrationSubscriptions, planMigrations } from '@repo/db';
import { PlanMigrationCancelResultSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import { cleanup, headers, launchMigrationCase, migrationCase, path } from './support/fixtures.js';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

let app: ReturnType<typeof initApp>;

function migrationAudits(id: string) {
    return audit.mock.calls.filter(
        ([call]) => call.resourceId === id && call.metadata?.administrativeAction === 'ACC_17'
    );
}

/** Send a cancellation request with the same auth bridge as the existing route test. */
async function cancel(args: {
    readonly id: string;
    readonly actorId?: string;
    readonly allowed?: boolean;
}) {
    return app.request(`${path}/${args.id}/cancel`, {
        method: 'POST',
        headers: args.actorId
            ? headers(args.actorId, args.allowed)
            : { 'Content-Type': 'application/json', 'User-Agent': 'vitest' }
    });
}

describe('TEST:B12:7 AC:B12:7 cancelar una migración anunciada', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });
    afterEach(async () => {
        await cleanup();
        audit.mockClear();
    });
    afterAll(async () => testDb.teardown());

    it('answers 401 and 403 before touching the announced migration', async () => {
        const seeded = await migrationCase();
        const id = await launchMigrationCase({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        audit.mockClear();
        expect((await cancel({ id })).status).toBe(401);
        expect((await cancel({ id, actorId: seeded.actorId, allowed: false })).status).toBe(403);
        const [migration] = await getDb()
            .select()
            .from(planMigrations)
            .where(eq(planMigrations.id, id));
        const rows = await getDb()
            .select({ status: planMigrationSubscriptions.status })
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        expect(migration?.cancelledAt).toBeNull();
        expect(rows).toEqual([{ status: 'PENDIENTE' }]);
        expect(migrationAudits(id)).toHaveLength(0);
    });

    it('cancels pending scope, queues a notice and audits ACC_17 exactly once', async () => {
        const seeded = await migrationCase();
        const id = await launchMigrationCase({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        audit.mockClear();
        const response = await cancel({ id, actorId: seeded.actorId });
        const payload = await response.json();
        expect(response.status, JSON.stringify(payload)).toBe(200);
        expect(
            PlanMigrationCancelResultSchema.parse({
                ...payload.data,
                cancelledAt: new Date(payload.data.cancelledAt)
            })
        ).toEqual({
            planMigrationId: id,
            cancelledAt: expect.any(Date),
            rows: { cancelled: 1, alreadyStarted: 0, untouched: 0 }
        });
        const rows = await getDb()
            .select({ status: planMigrationSubscriptions.status })
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        expect(rows).toEqual([{ status: 'CANCELADA' }]);
        const outbox = await getDb()
            .select({ template: emailOutbox.template })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, seeded.customer.userId));
        expect(
            outbox
                .map((mail) => mail.template)
                .filter((name) => name.startsWith('billing.plan-migration-'))
                .sort()
        ).toEqual(['billing.plan-migration-announced', 'billing.plan-migration-cancelled']);
        expect(migrationAudits(id)).toHaveLength(1);
        expect(migrationAudits(id)[0]?.[0]).toMatchObject({
            actorId: seeded.actorId,
            resourceId: id,
            metadata: { administrativeAction: 'ACC_17', planMigrationId: id }
        });
    });

    it('returns exact 409, 404 and 400 codes without auditing a rejection', async () => {
        const seeded = await migrationCase();
        const id = await launchMigrationCase({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        expect((await cancel({ id, actorId: seeded.actorId })).status).toBe(200);
        audit.mockClear();
        for (const item of [
            { id, status: 409, code: 'PLAN_MIGRATION_ALREADY_CANCELLED' },
            { id: crypto.randomUUID(), status: 404, code: 'PLAN_MIGRATION_NOT_FOUND' },
            { id: 'not-a-uuid', status: 400, code: 'VALIDATION_ERROR' }
        ]) {
            const response = await cancel({ id: item.id, actorId: seeded.actorId });
            const payload = await response.json();
            expect(response.status, JSON.stringify(payload)).toBe(item.status);
            expect(payload.error.code).toBe(item.code);
        }
        expect(migrationAudits(id)).toHaveLength(0);
    });
});
