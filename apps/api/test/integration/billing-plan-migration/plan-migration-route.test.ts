import { eq, getDb, planMigrationSubscriptions, planMigrations } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import { cleanup, headers, migrationCase, path, trackMigration } from './support/fixtures.js';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

let app: ReturnType<typeof initApp>;
async function request(args: {
    path: string;
    actorId?: string;
    body?: Record<string, unknown>;
    allowed?: boolean;
}) {
    return app.request(args.path, {
        method: args.body ? 'POST' : 'GET',
        headers: args.actorId
            ? headers(args.actorId, args.allowed)
            : { 'Content-Type': 'application/json', 'User-Agent': 'vitest' },
        ...(args.body ? { body: JSON.stringify(args.body) } : {})
    });
}
async function preview(args: { actorId: string; sourceId: string; targetId: string }) {
    return request({
        path: `${path}/preview`,
        actorId: args.actorId,
        body: { sourcePlanVersionId: args.sourceId, targetPlanVersionId: args.targetId }
    });
}

describe('TEST:B12:2 AC:B12:2 la acción 17 y su previsualización, por el panel', () => {
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

    it('shows UP and DOWN from the real catalog, amounts, dates and the reached customer by id', async () => {
        const seeded = await migrationCase();
        const options = await request({ path: `${path}/options`, actorId: seeded.actorId });
        expect(options.status).toBe(200);
        const optionsData = (await options.json()).data;
        expect(
            optionsData.sources.filter((row: { id: string }) => row.id === seeded.sourceId)
        ).toHaveLength(1);
        for (const [targetId, direction, newAmount] of [
            [seeded.upId, 'UP', 300000],
            [seeded.downId, 'DOWN', 200000]
        ] as const) {
            const response = await preview({
                actorId: seeded.actorId,
                sourceId: seeded.sourceId,
                targetId
            });
            const payload = await response.json();
            expect(response.status, JSON.stringify(payload)).toBe(200);
            expect(
                payload.data.rows.map(
                    (row: {
                        subscriptionId: string;
                        direction: string;
                        currentAmount: number;
                        newAmount: number;
                        applicationDate: string;
                    }) => ({
                        subscriptionId: row.subscriptionId,
                        direction: row.direction,
                        currentAmount: row.currentAmount,
                        newAmount: row.newAmount,
                        applicationDate: row.applicationDate
                    })
                )
            ).toEqual([
                {
                    subscriptionId: seeded.customer.subscriptionId,
                    direction,
                    currentAmount: 250000,
                    newAmount,
                    applicationDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
                }
            ]);
        }
    });

    it('launches the previewed cohort, persists its rows and audits ACC_17 with the real actor', async () => {
        const seeded = await migrationCase();
        const shown = await preview({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        const fingerprint = (await shown.json()).data.cohortFingerprint;
        const launched = await request({
            path,
            actorId: seeded.actorId,
            body: {
                sourcePlanVersionId: seeded.sourceId,
                targetPlanVersionId: seeded.upId,
                cohortFingerprint: fingerprint
            }
        });
        const payload = await launched.json();
        expect(launched.status, JSON.stringify(payload)).toBe(200);
        const id = payload.data.planMigrationId;
        trackMigration(id);
        const [stored] = await getDb()
            .select()
            .from(planMigrations)
            .where(eq(planMigrations.id, id));
        const rows = await getDb()
            .select()
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        expect(stored).toMatchObject({
            id,
            sourcePlanVersionId: seeded.sourceId,
            targetPlanVersionId: seeded.upId,
            signedBy: seeded.actorId,
            deadlineVersion: payload.data.deadlineVersion
        });
        expect(
            rows.map((row) => ({ subscriptionId: row.subscriptionId, status: row.status }))
        ).toEqual([{ subscriptionId: seeded.customer.subscriptionId, status: 'PENDIENTE' }]);
        expect(audit.mock.calls.filter(([call]) => call.resourceId === id)).toHaveLength(1);
        expect(audit.mock.calls.find(([call]) => call.resourceId === id)?.[0]).toMatchObject({
            actorId: seeded.actorId,
            metadata: {
                administrativeAction: 'ACC_17',
                sourcePlanVersionId: seeded.sourceId,
                targetPlanVersionId: seeded.upId,
                rowCount: 1,
                excludedCount: 0,
                reason: 'RETIREMENT',
                deadlineVersion: payload.data.deadlineVersion
            }
        });
    });

    it('rejects business failures with their exact status and code', async () => {
        const seeded = await migrationCase();
        audit.mockClear();
        const cases = [
            {
                sourceId: seeded.sourceId,
                targetId: crypto.randomUUID(),
                status: 404,
                code: 'PLAN_VERSION_NOT_FOUND'
            },
            {
                sourceId: seeded.upId,
                targetId: seeded.downId,
                status: 422,
                code: 'PLAN_MIGRATION_SOURCE_NOT_RETIRED'
            },
            {
                sourceId: seeded.sourceId,
                targetId: seeded.retiredId,
                status: 422,
                code: 'PLAN_MIGRATION_TARGET_NOT_SELLABLE'
            },
            {
                sourceId: seeded.sourceId,
                targetId: seeded.sourceId,
                status: 422,
                code: 'PLAN_MIGRATION_SAME_VERSION'
            }
        ];
        for (const item of cases) {
            const response = await preview({
                actorId: seeded.actorId,
                sourceId: item.sourceId,
                targetId: item.targetId
            });
            const payload = await response.json();
            expect(response.status, JSON.stringify(payload)).toBe(item.status);
            expect(payload.error.code).toBe(item.code);
        }
        expect(audit.mock.calls).toHaveLength(0);
    });

    it('rejects a changed cohort at confirmation with 409 and no audit', async () => {
        const seeded = await migrationCase();
        audit.mockClear();
        const response = await request({
            path,
            actorId: seeded.actorId,
            body: {
                sourcePlanVersionId: seeded.sourceId,
                targetPlanVersionId: seeded.upId,
                cohortFingerprint: '0'.repeat(64)
            }
        });
        const payload = await response.json();
        expect(response.status, JSON.stringify(payload)).toBe(409);
        expect(payload.error.code).toBe('PLAN_MIGRATION_COHORT_CHANGED');
        expect(audit.mock.calls).toHaveLength(0);
    });

    it('shows the actor subscription as excluded with its reason', async () => {
        const seeded = await migrationCase();
        const response = await preview({
            actorId: seeded.customer.userId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        const payload = await response.json();
        expect(response.status, JSON.stringify(payload)).toBe(200);
        expect(
            payload.data.rows.map(
                (row: { subscriptionId: string; outcome: string; excludedReason: string }) => ({
                    subscriptionId: row.subscriptionId,
                    outcome: row.outcome,
                    excludedReason: row.excludedReason
                })
            )
        ).toEqual([
            {
                subscriptionId: seeded.customer.subscriptionId,
                outcome: 'EXCLUDED',
                excludedReason: 'ACTOR_IS_SUBJECT'
            }
        ]);
    });

    it('orders 401, 403 and 400 ahead of business logic on all three routes', async () => {
        const seeded = await migrationCase();
        for (const route of [`${path}/options`, `${path}/preview`, path]) {
            const body = route.endsWith('options')
                ? undefined
                : {
                      sourcePlanVersionId: seeded.sourceId,
                      targetPlanVersionId: seeded.upId,
                      cohortFingerprint: 'x'
                  };
            const unauthorized = await request({ path: route, body });
            expect(unauthorized.status).toBe(401);
            const forbidden = await request({
                path: route,
                actorId: seeded.actorId,
                body,
                allowed: false
            });
            expect(forbidden.status).toBe(403);
            if (body) {
                const malformed = await request({
                    path: route,
                    actorId: seeded.actorId,
                    body: { ...body, extra: true },
                    allowed: false
                });
                expect(malformed.status).toBe(403);
            }
        }
        const invalid = await request({
            path: `${path}/preview`,
            actorId: seeded.actorId,
            body: {
                sourcePlanVersionId: seeded.sourceId,
                targetPlanVersionId: seeded.upId,
                extra: true
            }
        });
        expect(invalid.status).toBe(400);
        expect(
            await getDb()
                .select()
                .from(planMigrations)
                .where(eq(planMigrations.sourcePlanVersionId, seeded.sourceId))
        ).toHaveLength(0);
    });
});
