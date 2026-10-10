import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { accommodations, destinations, trials } from '@repo/db';
import { PublicationStatusEnum, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import { expireDueTrials } from '../../src/trial/trial-expiry';
import type { TrialAfterCommit, TrialExpiryScanner } from '../../src/trial/trial-machine-types';
import { seedActiveTrial } from './support/trial-machine-helpers';
import { createTrialMachineAdapter } from './support/trial-machine-unit-of-work';
import { bootstrapReaderOf, trialRowOf } from './support/trial-start-helpers';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
const vertical = VerticalEnum.ACCOMMODATION;
const day = 86_400_000;
const end = new Date('2026-10-10T12:00:00.000Z');
let current = end.getTime() - 60_000;
const clock = { now: () => new Date(current) };
const afterCommit: TrialAfterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {}
};

function ownScanner(scanner: TrialExpiryScanner, userIds: readonly string[]): TrialExpiryScanner {
    return {
        async findDueTrials({ now, limit }) {
            const rows = await scanner.findDueTrials({ now, limit: 100_000 });
            return rows.filter((row) => userIds.includes(row.userId)).slice(0, limit);
        }
    };
}

describe('TEST:V4:8 - T3 expires due trials and rereads the deadline', () => {
    it('expires after the clock advances, removes coverage, schedules five milestones and leaves inactive_since untouched', async () => {
        const { userId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: new Date(end.getTime() - 10 * day),
            endsAt: end
        });
        const [destination] = await db
            .insert(destinations)
            .values({
                destinationType: 'CITY',
                path: `/trial-machine-t3-${randomUUID()}`,
                slug: randomUUID(),
                name: 'Trial city',
                summary: 'Trial city',
                description: 'Trial city',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!destination) throw new Error('Destination insert failed');
        await db.insert(accommodations).values({
            type: 'HOTEL',
            slug: randomUUID(),
            name: 'Trial listing',
            summary: 'Trial listing',
            description: 'Trial listing',
            ownerId: userId,
            destinationId: destination.id,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            inactiveSince: null
        });
        const billing = createBootstrapBillingForVerticals({ reader: bootstrapReaderOf(db) });
        current = end.getTime() - 60_000;
        expect((await billing.coverage({ userId, vertical })).covered).toBe(true);
        const inactiveSinceOfOwner = async () =>
            (
                await db.execute(
                    sql`SELECT inactive_since FROM accommodations WHERE owner_id = ${userId}`
                )
            ).rows;
        const before = await inactiveSinceOfOwner();
        expect(before).toEqual([{ inactive_since: null }]);
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        current = end.getTime() + 60_000;
        expect(
            await expireDueTrials({
                scanner: ownScanner(adapter.scanner, [userId]),
                unitOfWork: adapter.unitOfWork,
                clock,
                afterCommit,
                batchSize: 10
            })
        ).toEqual({ expired: 1, skipped: 0, failed: 0 });
        const row = await trialRowOf(pool, userId, vertical);
        expect(row?.status).toBe('TRIAL_EXPIRED');
        expect(row?.deadlines_version).toBe(1);
        expect((await billing.coverage({ userId, vertical })).covered).toBe(false);
        expect(adapter.stats.recoveryCampaigns).toHaveLength(1);
        expect(adapter.stats.recoveryCampaigns[0]?.milestones).toEqual(
            [1, 5, 15, 30, 60].map((days) => new Date(end.getTime() + days * day))
        );
        const after = await inactiveSinceOfOwner();
        expect(after).toEqual(before);
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = now() WHERE owner_id = ${userId}`
        );
        const changed = await inactiveSinceOfOwner();
        expect(changed).toHaveLength(1);
        expect(changed[0]?.inactive_since).not.toBeNull();
        expect(changed).not.toEqual(before);
    });

    it('skips a scanned row whose end was extended before T3 takes the lock', async () => {
        const { userId, trialId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: new Date(end.getTime() - 10 * day),
            endsAt: end
        });
        current = end.getTime() + 60_000;
        const adapter = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        const scanned = await ownScanner(adapter.scanner, [userId]).findDueTrials({
            now: clock.now(),
            limit: 10
        });
        expect(scanned).toEqual([{ userId, vertical }]);
        await db
            .update(trials)
            .set({ endsAt: new Date(end.getTime() + 5 * day) })
            .where(eq(trials.id, trialId));
        const scanner: TrialExpiryScanner = { findDueTrials: async () => scanned };
        expect(
            await expireDueTrials({
                scanner,
                unitOfWork: adapter.unitOfWork,
                clock,
                afterCommit,
                batchSize: 10
            })
        ).toEqual({ expired: 0, skipped: 1, failed: 0 });
        expect((await trialRowOf(pool, userId, vertical))?.status).toBe('TRIAL_ACTIVE');
        expect(adapter.stats.recoveryCampaigns).toHaveLength(0);
    });

    it('rolls back when markExpired fails and schedules no recovery', async () => {
        const { userId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: new Date(end.getTime() - 10 * day),
            endsAt: end
        });
        current = end.getTime() + 60_000;
        const adapter = createTrialMachineAdapter({
            db,
            ceilingDays: () => 60,
            failOn: 'markExpired'
        });
        expect(
            await expireDueTrials({
                scanner: ownScanner(adapter.scanner, [userId]),
                unitOfWork: adapter.unitOfWork,
                clock,
                afterCommit,
                batchSize: 10
            })
        ).toEqual({ expired: 0, skipped: 0, failed: 1 });
        expect((await trialRowOf(pool, userId, vertical))?.status).toBe('TRIAL_ACTIVE');
        expect(adapter.stats.recoveryCampaigns).toHaveLength(0);
    });
});

describe('TEST:V4:9 - trial never becomes SUSPENDED', () => {
    // The declared transition table arrives in V4.6; its missing edge is checked there.
    it('Postgres rejects SUSPENDED with ck_trial_status, and TrialStatusEnum has no such value', async () => {
        const { trialId } = await seedActiveTrial({
            db,
            vertical,
            startedAt: end,
            endsAt: new Date(end.getTime() + day)
        });
        let failure: unknown;
        try {
            await db.execute(sql`UPDATE trial SET status = 'SUSPENDED' WHERE id = ${trialId}`);
        } catch (error) {
            failure = error;
        }
        const codes: string[] = [];
        const seen = new Set<unknown>();
        while (failure && typeof failure === 'object' && !seen.has(failure)) {
            seen.add(failure);
            const node = failure as { code?: string; cause?: unknown };
            if (node.code) codes.push(node.code);
            failure = node.cause;
        }
        expect(codes).toContain('23514');
        expect(Object.values(TrialStatusEnum)).not.toContain('SUSPENDED');
        expect(
            (
                await db
                    .select({ status: trials.status })
                    .from(trials)
                    .where(eq(trials.id, trialId))
            )[0]?.status
        ).toBe('TRIAL_ACTIVE');
    });
});
