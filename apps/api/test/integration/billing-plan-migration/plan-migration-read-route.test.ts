import { eq, getDb, planMigrationSubscriptions, planMigrations } from '@repo/db';
import { PlanMigrationDetailRowSchema } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import { cleanup, headers, launchMigrationCase, migrationCase, path } from './support/fixtures.js';

let app: ReturnType<typeof initApp>;

/** Read one action 17 endpoint through the app router. */
async function read(args: {
    readonly url: string;
    readonly actorId?: string;
    readonly allowed?: boolean;
}) {
    return app.request(args.url, {
        headers: args.actorId
            ? headers(args.actorId, args.allowed)
            : { 'Content-Type': 'application/json', 'User-Agent': 'vitest' }
    });
}

describe('TEST:B12:6 AC:B12:6 y el panel la lista sin plazo y con su antigüedad desde el anuncio', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });
    afterEach(cleanup);
    afterAll(async () => testDb.teardown());

    it('answers 401 and 403 on list and detail before reading the cohort', async () => {
        const seeded = await migrationCase();
        const id = await launchMigrationCase({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        for (const url of [`${path}/`, `${path}/${id}`]) {
            expect((await read({ url })).status).toBe(401);
            expect((await read({ url, actorId: seeded.actorId, allowed: false })).status).toBe(403);
        }
        const [migration] = await getDb()
            .select()
            .from(planMigrations)
            .where(eq(planMigrations.id, id));
        expect(migration?.cancelledAt).toBeNull();
        expect(
            await getDb()
                .select({ status: planMigrationSubscriptions.status })
                .from(planMigrationSubscriptions)
                .where(eq(planMigrationSubscriptions.planMigrationId, id))
        ).toEqual([{ status: 'PENDIENTE' }]);
    });

    it('lists the owned migration with page and pageSize; rejects unknown limit', async () => {
        const seeded = await migrationCase();
        const id = await launchMigrationCase({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        const response = await read({
            url: `${path}/?page=1&pageSize=50`,
            actorId: seeded.actorId
        });
        const payload = await response.json();
        expect(response.status, JSON.stringify(payload)).toBe(200);
        expect(payload.data.items.filter((row: { id: string }) => row.id === id)).toEqual([
            expect.objectContaining({
                id,
                counts: { PENDIENTE: 1, PARA_RESOLVER: 0, APLICADA: 0, FUERA: 0, CANCELADA: 0 }
            })
        ]);
        expect(payload.data.pagination).toMatchObject({ page: 1, pageSize: 50 });
        const invalid = await read({ url: `${path}/?limit=1`, actorId: seeded.actorId });
        expect(invalid.status).toBe(400);
    });

    it('shows unresolved age without an application date and preserves /options priority', async () => {
        const seeded = await migrationCase({ withUnresolved: true });
        const id = await launchMigrationCase({
            actorId: seeded.actorId,
            sourceId: seeded.sourceId,
            targetId: seeded.upId
        });
        const response = await read({ url: `${path}/${id}`, actorId: seeded.actorId });
        const payload = await response.json();
        expect(response.status, JSON.stringify(payload)).toBe(200);
        const unresolved = payload.data.rows.find(
            (row: { subscriptionId: string }) =>
                row.subscriptionId === seeded.unresolvedCustomer?.subscriptionId
        );
        expect(PlanMigrationDetailRowSchema.parse(unresolved)).toEqual({
            id: expect.any(String),
            subscriptionId: seeded.unresolvedCustomer?.subscriptionId,
            ownerUserId: seeded.unresolvedCustomer?.userId,
            status: 'PARA_RESOLVER',
            outReason: null,
            applicationDate: null,
            appliedAt: null,
            ageDays: expect.any(Number)
        });
        const options = await read({ url: `${path}/options`, actorId: seeded.actorId });
        const optionsPayload = await options.json();
        expect(options.status, JSON.stringify(optionsPayload)).toBe(200);
        expect(optionsPayload.data).toEqual({
            sources: expect.any(Array),
            targets: expect.any(Object)
        });
        expect(
            optionsPayload.data.sources.filter((row: { id: string }) => row.id === seeded.sourceId)
        ).toHaveLength(1);
    });

    it('answers 404 for unknown detail and 400 for malformed id', async () => {
        const seeded = await migrationCase();
        const missing = await read({
            url: `${path}/${crypto.randomUUID()}`,
            actorId: seeded.actorId
        });
        expect(missing.status).toBe(404);
        expect((await missing.json()).error.code).toBe('PLAN_MIGRATION_NOT_FOUND');
        const malformed = await read({ url: `${path}/not-a-uuid`, actorId: seeded.actorId });
        expect(malformed.status).toBe(400);
    });
});
