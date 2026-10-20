/**
 * TEST:V8a:7 backend half of row 4 (HOS-1492, V8a.1b, run 1, H3): the trial
 * summary reads the trial row, the promo redemptions and the support
 * extensions, over the real database. Trial rows cannot be deleted (extras
 * trigger), so every case uses fresh users; the rest is cleaned in `afterEach`.
 */
import { randomUUID } from 'node:crypto';
import { domainEventModel, getDb, sql, trialRedemptions } from '@repo/db';
import { type TrialSummaryResponse, VerticalEnum } from '@repo/schemas';
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
const DAY = 86_400_000;
const createdOwners: string[] = [];

async function owner(): Promise<string> {
    const created = await createOwner();
    createdOwners.push(created.id);
    return created.id;
}

async function readSummary(vertical: string, headers: Record<string, string>) {
    const response = await app.request(`/api/v1/protected/publish/trial-summary/${vertical}`, {
        headers
    });
    const body = (await response.json()) as { data?: TrialSummaryResponse };
    return { status: response.status, data: body.data };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const ids = createdOwners.splice(0);
    if (ids.length === 0) return;
    await getDb().execute(
        sql`DELETE FROM canje_de_trial WHERE user_id = ANY(${sql.param(ids)}::uuid[])`
    );
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('HOS-1492 trial summary read — %s', (vertical) => {
    it('TEST:V8a:7 row 4: totals the trial days and splits base, promo and support', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const userId = await owner();
        await createTrial({ userId, vertical, status: 'TRIAL_ACTIVE' });
        const [trial] = (
            await getDb().execute(
                sql<{
                    id: string;
                    endsAt: Date;
                }>`SELECT id, ends_at AS "endsAt" FROM trial WHERE user_id = ${userId}::uuid AND vertical = ${vertical}`
            )
        ).rows;
        const previousEnd = new Date(String(trial?.endsAt));
        const newEnd = new Date(previousEnd.getTime() + 15 * DAY);
        await getDb().execute(
            sql`UPDATE trial SET ends_at = ${newEnd} WHERE id = ${String(trial?.id)}::uuid`
        );
        await getDb()
            .insert(trialRedemptions)
            .values({ userId, vertical, redemptionKey: `test-${randomUUID()}`, appliedDays: 10 });
        await domainEventModel.insert({
            eventType: 'trial.extended',
            entityType: 'trial',
            entityId: String(trial?.id),
            actorType: 'admin',
            actorId: userId,
            reason: 'Cortesía',
            correlationId: randomUUID(),
            changes: [
                { field: 'endsAt', old: previousEnd.toISOString(), new: newEnd.toISOString() },
                { field: 'days', new: 5 },
                { field: 'origin', new: 'SUPER_ADMIN' }
            ]
        });

        // Act
        const response = await readSummary(vertical, actorHeaders({ id: userId }));

        // Assert
        const [row] = (
            await getDb().execute(
                sql<{
                    status: string;
                    startedAt: Date;
                    endsAt: Date;
                }>`SELECT status, started_at AS "startedAt", ends_at AS "endsAt" FROM trial WHERE user_id = ${userId}::uuid AND vertical = ${vertical}`
            )
        ).rows;
        expect(response.status).toBe(200);
        expect(response.data).toEqual({
            status: row?.status,
            startedAt: new Date(String(row?.startedAt)).toISOString(),
            endsAt: new Date(String(row?.endsAt)).toISOString(),
            totalDays: 45,
            origins: { base: 30, promo: 10, support: 5 }
        });
    });

    it('TEST:V8a:7 row 4: NONE without a trial row', async () => {
        // Arrange
        const userId = await owner();

        // Act
        const response = await readSummary(vertical, actorHeaders({ id: userId }));

        // Assert
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: 'NONE' });
        const rows = await getDb().execute(
            sql`SELECT id FROM trial WHERE user_id = ${userId}::uuid`
        );
        expect(rows.rows).toHaveLength(0);
    });

    it('rejects a guest with 401', async () => {
        // Act
        const response = await readSummary(vertical, {
            'content-type': 'application/json',
            'user-agent': 'vitest'
        });

        // Assert
        expect(response.status).toBe(401);
    });
});

describe('HOS-1492 trial summary read — vertical param', () => {
    it('rejects a vertical outside the listing verticals with 400', async () => {
        // Arrange
        const userId = await owner();

        // Act
        const response = await readSummary('partner', actorHeaders({ id: userId }));

        // Assert
        expect(response.status).toBe(400);
    });
});
