import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { listingRetentionModel, trials } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { runInactivityArchive } from '../../src/publication/inactivity-archive-run';
import { seedPublicationListing, seedPublicationOwner } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const at = new Date('2026-10-11T12:00:00.000Z');
const clock = { now: () => new Date(at) };
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
const tables = {
    accommodation: 'accommodations',
    venue: 'gastronomies',
    experience: 'experiences'
} as const;
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
type DeadlineRow = {
    version: number;
    values: Record<string, unknown>;
    changed_key: number | null;
    previous_value: unknown;
    new_value: unknown;
    changed_by: string | null;
    created_at: Date;
};
let deadlineSnapshot: DeadlineRow[] = [];
let shortArchiveVersion = 0;

beforeAll(async () => {
    deadlineSnapshot = (
        await pool.query<DeadlineRow>(
            'SELECT version, values, changed_key, previous_value, new_value, changed_by, created_at FROM vertical_deadline_version ORDER BY version'
        )
    ).rows;
    shortArchiveVersion = Math.max(...deadlineSnapshot.map((row) => row.version)) + 1;
    const values = structuredClone(deadlineSnapshot.at(-1)?.values);
    if (!values) throw new Error('deadline version 1 fixture missing');
    values['1'] = { days: 60 };
    values['3'] = { months: 1 };
    await pool.query(
        'INSERT INTO vertical_deadline_version (version, values, changed_key, previous_value, new_value, changed_by) VALUES ($1, $2, NULL, NULL, NULL, NULL)',
        [shortArchiveVersion, values]
    );
});

afterAll(async () => {
    if (deadlineSnapshot.length > 0) {
        await pool.query('TRUNCATE vertical_deadline_version');
        for (const row of deadlineSnapshot) {
            await pool.query(
                'INSERT INTO vertical_deadline_version (version, values, changed_key, previous_value, new_value, changed_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                [
                    row.version,
                    row.values,
                    row.changed_key,
                    row.previous_value,
                    row.new_value,
                    row.changed_by,
                    row.created_at
                ]
            );
        }
    }
    await pool.end();
});

async function adapter(
    covered: boolean,
    retention?: { stopped: boolean; pauseEndedAt: Date | null }
) {
    return createPublicationTestAdapter({
        db,
        covered: { value: covered },
        limit: { value: 10 },
        retention
    });
}

async function setClockState(args: {
    vertical: (typeof verticals)[number];
    listingId: string;
    status: PublicationStatusEnum;
    inactiveSince: Date;
    version: number;
}) {
    await db.execute(
        sql`UPDATE ${sql.identifier(tables[args.vertical])} SET publication_status = ${args.status}, inactive_since = ${args.inactiveSince}, deadlines_version = ${args.version} WHERE id = ${args.listingId}`
    );
}

async function readRow(vertical: (typeof verticals)[number], listingId: string) {
    const result = await db.execute(
        sql`SELECT publication_status, inactive_since, deadlines_version, deletion_announced_at FROM ${sql.identifier(tables[vertical])} WHERE id = ${listingId}`
    );
    const row = result.rows[0];
    return row
        ? {
              publication_status: String(row.publication_status),
              inactive_since: new Date(String(row.inactive_since)),
              deadlines_version: Number(row.deadlines_version),
              deletion_announced_at: row.deletion_announced_at
                  ? new Date(String(row.deletion_announced_at))
                  : null
          }
        : undefined;
}

describe('TEST:V6:8 and TEST:V6:9 PB4/PB5 over Postgres', () => {
    it('TEST:V6:8 archives PUBLISHED with the stored version, writes deletion announcement, preserves the clock, and revalidates only public source', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const listing = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const inactiveSince = new Date(at.getTime() - 100 * 86_400_000);
        await setClockState({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince,
            version: 1
        });
        const state = await adapter(false);
        const result = await archiveInactiveListing({
            ...state,
            afterCommit,
            clock,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(result).toMatchObject({
            archived: true,
            transition: 'PB4',
            deletionAnnouncedAt: new Date(at.getTime() + 90 * 86_400_000)
        });
        expect(await readRow(VerticalEnum.ACCOMMODATION, listing.id)).toMatchObject({
            publication_status: 'ARCHIVED',
            inactive_since: inactiveSince,
            deadlines_version: 1,
            deletion_announced_at: new Date(at.getTime() + 90 * 86_400_000)
        });
        expect(afterCommit.revalidate).toHaveBeenCalledWith({
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: [listing.id]
        });
        const billingDown = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        await setClockState({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: billingDown.id,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            inactiveSince,
            version: 1
        });
        afterCommit.revalidate.mockClear();
        const downResult = await archiveInactiveListing({
            ...state,
            afterCommit,
            clock,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: billingDown.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(downResult).toMatchObject({ archived: true, transition: 'PB4' });
        expect(afterCommit.revalidate).not.toHaveBeenCalled();
    });

    it('TEST:V6:8 uses the row deadline version, honors coverage and retention pause, and counts from the later pause end', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const short = await seedPublicationListing({
            db,
            vertical: VerticalEnum.VENUE,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const original = await seedPublicationListing({
            db,
            vertical: VerticalEnum.VENUE,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const old = new Date(at.getTime() - 70 * 86_400_000);
        await setClockState({
            vertical: VerticalEnum.VENUE,
            listingId: short.id,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: old,
            version: shortArchiveVersion
        });
        await setClockState({
            vertical: VerticalEnum.VENUE,
            listingId: original.id,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: old,
            version: 1
        });
        const shortAdapter = await adapter(false);
        expect(
            (
                await archiveInactiveListing({
                    ...shortAdapter,
                    afterCommit,
                    clock,
                    vertical: VerticalEnum.VENUE,
                    listingId: short.id,
                    ownerId: userId,
                    correlationId: randomUUID()
                })
            ).archived
        ).toBe(true);
        expect(
            await archiveInactiveListing({
                ...shortAdapter,
                afterCommit,
                clock,
                vertical: VerticalEnum.VENUE,
                listingId: original.id,
                ownerId: userId,
                correlationId: randomUUID()
            })
        ).toMatchObject({ archived: false, reason: 'NOT_DUE' });
        expect((await readRow(VerticalEnum.VENUE, short.id))?.deletion_announced_at).toEqual(
            new Date(at.getTime() + 120 * 86_400_000)
        );

        const covered = await seedPublicationListing({
            db,
            vertical: VerticalEnum.EXPERIENCE,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        await setClockState({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: covered.id,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: old,
            version: 1
        });
        const coveredAdapter = await adapter(true);
        await archiveInactiveListing({
            ...coveredAdapter,
            afterCommit,
            clock,
            vertical: VerticalEnum.EXPERIENCE,
            listingId: covered.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(await readRow(VerticalEnum.EXPERIENCE, covered.id)).toMatchObject({
            publication_status: 'PUBLISHED',
            inactive_since: at,
            deadlines_version: shortArchiveVersion,
            deletion_announced_at: null
        });

        const stopped = await seedPublicationListing({
            db,
            vertical: VerticalEnum.EXPERIENCE,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        await setClockState({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: stopped.id,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: old,
            version: 1
        });
        const stoppedBefore = await readRow(VerticalEnum.EXPERIENCE, stopped.id);
        const stoppedAdapter = await adapter(false, { stopped: true, pauseEndedAt: null });
        await archiveInactiveListing({
            ...stoppedAdapter,
            afterCommit,
            clock,
            vertical: VerticalEnum.EXPERIENCE,
            listingId: stopped.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(await readRow(VerticalEnum.EXPERIENCE, stopped.id)).toEqual(stoppedBefore);

        const paused = await seedPublicationListing({
            db,
            vertical: VerticalEnum.EXPERIENCE,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        await setClockState({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: paused.id,
            status: PublicationStatusEnum.PUBLISHED,
            inactiveSince: new Date(at.getTime() - 200 * 86_400_000),
            version: 1
        });
        const recentPauseEnd = new Date(at.getTime() - 20 * 86_400_000);
        const pauseAdapter = await adapter(false, { stopped: false, pauseEndedAt: recentPauseEnd });
        expect(
            await archiveInactiveListing({
                ...pauseAdapter,
                afterCommit,
                clock,
                vertical: VerticalEnum.EXPERIENCE,
                listingId: paused.id,
                ownerId: userId,
                correlationId: randomUUID()
            })
        ).toMatchObject({ archived: false, reason: 'NOT_DUE' });
        const oldPauseEnd = new Date(at.getTime() - 100 * 86_400_000);
        const elapsedAdapter = await adapter(false, { stopped: false, pauseEndedAt: oldPauseEnd });
        expect(
            (
                await archiveInactiveListing({
                    ...elapsedAdapter,
                    afterCommit,
                    clock,
                    vertical: VerticalEnum.EXPERIENCE,
                    listingId: paused.id,
                    ownerId: userId,
                    correlationId: randomUUID()
                })
            ).archived
        ).toBe(true);
        expect((await readRow(VerticalEnum.EXPERIENCE, paused.id))?.deletion_announced_at).toEqual(
            new Date(at.getTime() + 90 * 86_400_000)
        );
    });

    it('TEST:V6:9 archives due DRAFT without trial or revalidation and leaves a future draft unchanged', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const draft = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        const future = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        const inactiveSince = new Date('2026-05-01T00:00:00Z');
        await setClockState({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: draft.id,
            status: PublicationStatusEnum.DRAFT,
            inactiveSince,
            version: 1
        });
        const futureStart = new Date(at.getTime() - 10 * 86_400_000);
        await setClockState({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: future.id,
            status: PublicationStatusEnum.DRAFT,
            inactiveSince: futureStart,
            version: 1
        });
        const state = await adapter(false);
        const trialsBefore = await db.select().from(trials).where(eq(trials.userId, userId));
        const result = await archiveInactiveListing({
            ...state,
            afterCommit,
            clock,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: draft.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(result).toMatchObject({ archived: true, transition: 'PB5' });
        expect(
            (await readRow(VerticalEnum.ACCOMMODATION, draft.id))?.deletion_announced_at
        ).toEqual(new Date(at.getTime() + 88 * 86_400_000));
        expect((await readRow(VerticalEnum.ACCOMMODATION, future.id))?.publication_status).toBe(
            'DRAFT'
        );
        const shortDraft = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        const threeMonthDraft = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        const twoMonthsAgo = new Date(at.getTime() - 60 * 86_400_000);
        await setClockState({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: shortDraft.id,
            status: PublicationStatusEnum.DRAFT,
            inactiveSince: twoMonthsAgo,
            version: shortArchiveVersion
        });
        await setClockState({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: threeMonthDraft.id,
            status: PublicationStatusEnum.DRAFT,
            inactiveSince: twoMonthsAgo,
            version: 1
        });
        expect(
            (
                await archiveInactiveListing({
                    ...state,
                    afterCommit,
                    clock,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: shortDraft.id,
                    ownerId: userId,
                    correlationId: randomUUID()
                })
            ).archived
        ).toBe(true);
        expect(
            await archiveInactiveListing({
                ...state,
                afterCommit,
                clock,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: threeMonthDraft.id,
                ownerId: userId,
                correlationId: randomUUID()
            })
        ).toMatchObject({ archived: false, reason: 'NOT_DUE' });
        expect(await db.select().from(trials).where(eq(trials.userId, userId))).toEqual(
            trialsBefore
        );
        expect(afterCommit.revalidate).not.toHaveBeenCalledWith({
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: [draft.id]
        });
    });

    it('TEST:V6:8 runner reads the real model population across all three verticals and is idempotent', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const state = await adapter(false);
        const ids: { vertical: (typeof verticals)[number]; id: string }[] = [];
        for (const vertical of verticals) {
            const listing = await seedPublicationListing({
                db,
                vertical,
                userId,
                destinationId,
                status: PublicationStatusEnum.PUBLISHED
            });
            ids.push({ vertical, id: listing.id });
            await setClockState({
                vertical,
                listingId: listing.id,
                status: PublicationStatusEnum.PUBLISHED,
                inactiveSince: new Date(at.getTime() - 100 * 86_400_000),
                version: 1
            });
        }
        const ports = {
            ...state,
            clock,
            afterCommit,
            population: {
                listDue: (input: {
                    now: Date;
                    after: { vertical: (typeof verticals)[number]; listingId: string } | null;
                    limit: number;
                }) =>
                    db.transaction((tx) =>
                        listingRetentionModel.listRetentionCandidates({ ...input, tx })
                    )
            }
        };
        const first = await runInactivityArchive({ ports });
        expect(first).toMatchObject({
            read: 3,
            archived: 3,
            archivedByTransition: { PB4: 3, PB5: 0 },
            complete: true
        });
        const second = await runInactivityArchive({ ports });
        expect(second).toMatchObject({ read: 0, archived: 0, complete: true });
        for (const item of ids)
            expect((await readRow(item.vertical, item.id))?.publication_status).toBe('ARCHIVED');
    });
});
