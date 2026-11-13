import { eq, getDb, plans, planVersions } from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import { cleanup, headers, migrationCase, path } from './support/fixtures.js';

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

describe('TEST:B12:11 AC:B12:10 la cola del retiro se ve', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });
    afterEach(cleanup);
    afterAll(async () => testDb.teardown());

    it('lists the retired version with its live count and never answers 400 for its own path', async () => {
        const seeded = await migrationCase();
        const [plan] = await getDb()
            .select({ planId: plans.id, name: plans.name })
            .from(planVersions)
            .innerJoin(plans, eq(plans.id, planVersions.planId))
            .where(eq(planVersions.id, seeded.sourceId));
        if (!plan) throw new Error('Retired source plan missing');
        const response = await read({
            url: `${path}/retired-versions`,
            actorId: seeded.actorId
        });
        const payload = await response.json();
        expect(response.status, JSON.stringify(payload)).toBe(200);
        expect(
            payload.data.items.filter((row: { id: string }) => row.id === seeded.sourceId)
        ).toEqual([
            {
                id: seeded.sourceId,
                planId: plan.planId,
                name: plan.name,
                vertical: 'accommodation',
                // The source is the first version created for its plan.
                versionNumber: 1,
                liveSubscriptionCount: 1
            }
        ]);
        // The versions with nobody anchored and the current sellable targets stay out.
        expect(
            payload.data.items.filter((row: { id: string }) =>
                [seeded.retiredId, seeded.upId, seeded.downId].includes(row.id)
            )
        ).toEqual([]);
    });

    it('answers 401 and 403 before reading the retired versions', async () => {
        const seeded = await migrationCase();
        expect((await read({ url: `${path}/retired-versions` })).status).toBe(401);
        expect(
            (
                await read({
                    url: `${path}/retired-versions`,
                    actorId: seeded.actorId,
                    allowed: false
                })
            ).status
        ).toBe(403);
    });
});
