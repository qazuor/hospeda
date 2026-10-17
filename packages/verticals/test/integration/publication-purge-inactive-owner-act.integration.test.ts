import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 4 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const DAY = 86_400_000;
const now = new Date('2026-10-10T12:00:00.000Z');
type Vertical = VerticalEnum.ACCOMMODATION | VerticalEnum.GASTRONOMY | VerticalEnum.EXPERIENCE;
const verticals: readonly Vertical[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
];
const tableByVertical: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.GASTRONOMY]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
} as const;

afterEach(async () => fixtures.cleanup());
afterAll(async () => pool.end());

async function archivedListing(vertical: Vertical) {
    const owner = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical,
        userId: owner.userId,
        destinationId: owner.destinationId,
        status: Status.ARCHIVED
    });
    await db.execute(sql`UPDATE ${sql.identifier(tableByVertical[vertical])}
        SET inactive_since = ${new Date(now.getTime() - 300 * DAY)}, deadlines_version = 1,
            deletion_announced_at = ${new Date(now.getTime() - DAY)}
        WHERE id = ${listing.id}`);
    return { ownerId: owner.userId, listingId: listing.id };
}

async function recordOwnerAct(args: {
    readonly vertical: Vertical;
    readonly listingId: string;
    readonly actorType: 'owner' | 'admin';
    readonly occurredAt: Date;
}) {
    await domainEventModel.insert({
        eventType: 'listing.edited',
        entityType: args.vertical,
        entityId: args.listingId,
        actorType: args.actorType,
        actorId: randomUUID(),
        correlationId: randomUUID(),
        occurredAt: args.occurredAt,
        tx: db
    });
}

async function purge(args: {
    readonly vertical: Vertical;
    readonly ownerId: string;
    readonly listingId: string;
}) {
    const adapter = createPublicationTestAdapter({
        db,
        covered: { value: false },
        limit: { value: 2 }
    });
    return purgeInactiveListing({
        ...adapter,
        vertical: args.vertical,
        listingId: args.listingId,
        ownerId: args.ownerId,
        correlationId: randomUUID(),
        clock: { now: () => now },
        previousPassStartedAt: now,
        afterCommit: {
            emitListingPurged: async () => {},
            deleteRemoteMedia: async () => {},
            revokeCalendarConnection: async () => {}
        }
    });
}

describe.each(verticals)('TEST:V9b:9 AC:V9b:9 PB9 reads V9a owner act: %s', (vertical) => {
    it('keeps a recent edit row unchanged, then purges after an older edit; ignores an admin edit', async () => {
        const recent = await archivedListing(vertical);
        await recordOwnerAct({
            ...recent,
            vertical,
            actorType: 'owner',
            occurredAt: new Date(now.getTime() - 10 * DAY)
        });
        const beforeResult = await db.execute(
            sql`SELECT * FROM ${sql.identifier(tableByVertical[vertical])} WHERE id = ${recent.listingId}`
        );
        const before = beforeResult.rows[0];
        expect(await purge({ ...recent, vertical })).toEqual({ purged: false, reason: 'NOT_DUE' });
        const afterResult = await db.execute(
            sql`SELECT * FROM ${sql.identifier(tableByVertical[vertical])} WHERE id = ${recent.listingId}`
        );
        const stripUpdatedAt = (row: Record<string, unknown> | undefined) => {
            if (!row) return row;
            const { updated_at: _updatedAt, ...rest } = row;
            return rest;
        };
        expect(stripUpdatedAt(afterResult.rows[0])).toEqual(stripUpdatedAt(before));

        const old = await archivedListing(vertical);
        await recordOwnerAct({
            ...old,
            vertical,
            actorType: 'owner',
            occurredAt: new Date(now.getTime() - 200 * DAY)
        });
        expect(await purge({ ...old, vertical })).toMatchObject({ purged: true });

        const admin = await archivedListing(vertical);
        await recordOwnerAct({
            ...admin,
            vertical,
            actorType: 'admin',
            occurredAt: new Date(now.getTime() - 10 * DAY)
        });
        expect(await purge({ ...admin, vertical })).toMatchObject({ purged: true });

        for (const fixture of [old, admin]) {
            const row = await db.execute(
                sql`SELECT publication_status, description FROM ${sql.identifier(tableByVertical[vertical])} WHERE id = ${fixture.listingId}`
            );
            expect(row.rows[0]?.publication_status).toBe(Status.PURGED);
            expect(row.rows[0]?.description).toBe('');
        }
    });
});
