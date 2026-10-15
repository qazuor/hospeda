/** TEST:V9b:3 AC:V9b:3 — real PostgreSQL rows with fake remote providers. */
import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { accommodationCalendarSync, accommodationReviews, listingPurgeModel } from '@repo/db';
import { PublicationStatusEnum as Status, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { purgeInactiveListing } from '../../src/publication/purge-inactive-listing';
import { runRemoteDeletionRetry } from '../../src/publication/remote-deletion-retry';
import { createPublicationFixtureTracker } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const fixtures = createPublicationFixtureTracker(db);
const mediaIds = new Map<string, string>();
const calendarIds = new Set<string>();
const reviewIds = new Set<string>();
const t0 = new Date('2026-10-12T12:00:00.000Z');
const day = 86_400_000;
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;

afterEach(async () => {
    for (const [id, table] of mediaIds)
        await db.execute(sql`DELETE FROM ${sql.raw(table)} WHERE id = ${id}`);
    mediaIds.clear();
    for (const id of calendarIds)
        await db.delete(accommodationCalendarSync).where(eq(accommodationCalendarSync.id, id));
    calendarIds.clear();
    for (const id of reviewIds)
        await db.delete(accommodationReviews).where(eq(accommodationReviews.id, id));
    reviewIds.clear();
    await fixtures.cleanup();
});
afterAll(async () => pool.end());

async function archivedListing(vertical: (typeof verticals)[number]) {
    const { userId, destinationId } = await fixtures.owner();
    const listing = await fixtures.listing({
        vertical,
        userId,
        destinationId,
        status: Status.ARCHIVED
    });
    const table = vertical === VerticalEnum.GASTRONOMY ? 'gastronomies' : `${vertical}s`;
    await db.execute(
        sql`UPDATE ${sql.raw(table)} SET inactive_since = ${new Date(t0.getTime() - 300 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() - day)} WHERE id = ${listing.id}`
    );
    const adapter = createPublicationTestAdapter({
        db,
        covered: { value: false },
        limit: { value: 2 }
    });
    return { userId, listing, adapter, table };
}

async function retryPorts(args: {
    readonly mediaId: string;
    readonly vertical: (typeof verticals)[number];
    readonly publicId: string;
    readonly storage: Set<string>;
    readonly fail: { value: boolean };
}) {
    let pings = 0;
    const ports = {
        pending: {
            async listMarkedMedia({
                after,
                limit
            }: {
                after: { vertical: (typeof verticals)[number]; mediaId: string } | null;
                limit: number;
            }) {
                let cursor = after;
                const items: Awaited<
                    ReturnType<typeof listingPurgeModel.listMarkedMedia>
                >['items'][number][] = [];
                let next: typeof cursor = null;
                do {
                    const page = await listingPurgeModel.listMarkedMedia({
                        tx: db,
                        after: cursor,
                        limit
                    });
                    items.push(...page.items.filter((row) => row.mediaId === args.mediaId));
                    next = page.next;
                    cursor = page.next;
                } while (cursor !== null);
                return { items, next };
            },
            async listMarkedCalendarConnections() {
                return { items: [], next: null };
            }
        },
        remote: {
            async deleteRemoteMedia(input: {
                vertical: (typeof verticals)[number];
                mediaId: string;
                publicId: string | null;
            }) {
                if (args.fail.value) throw new Error('fake storage unavailable');
                args.storage.delete(args.publicId);
                await listingPurgeModel.deleteMarkedMedia({
                    tx: db,
                    vertical: input.vertical,
                    mediaId: input.mediaId
                });
            },
            async revokeCalendarConnection() {}
        },
        monitor: {
            async ping() {
                pings += 1;
            }
        }
    };
    return { ports, pingCount: () => pings };
}

describe.each(verticals)('TEST:V9b:3 AC:V9b:3 %s remote media', (vertical) => {
    it('marks in PB9, calls after commit, and daily retry confirms a failed deletion', async () => {
        const { userId, listing, adapter, table } = await archivedListing(vertical);
        const mediaTable =
            vertical === VerticalEnum.ACCOMMODATION ? 'accommodation_media' : `${vertical}_media`;
        const fk = vertical === VerticalEnum.ACCOMMODATION ? 'accommodation_id' : `${vertical}_id`;
        const publicId = `pb9/${randomUUID()}`;
        const inserted = await db.execute(
            sql`INSERT INTO ${sql.raw(mediaTable)} (${sql.raw(fk)}, url, public_id, sort_order) VALUES (${listing.id}, 'https://fake.test/photo.jpg', ${publicId}, 0) RETURNING id`
        );
        const mediaId = String(inserted.rows[0]?.id);
        mediaIds.set(mediaId, mediaTable);
        const reads: { status: string; marked: Date | null }[] = [];
        const storage = new Set([publicId]);
        let firstAttemptFails = true;
        const afterCommit = {
            async deleteRemoteMedia(input: {
                vertical: (typeof verticals)[number];
                mediaId: string;
                publicId: string | null;
            }) {
                const visible = await pool.query(
                    `SELECT l.publication_status, m.remote_deletion_pending_at AS marked FROM ${table} l JOIN ${mediaTable} m ON m.${fk} = l.id WHERE l.id = $1 AND m.id = $2`,
                    [listing.id, input.mediaId]
                );
                reads.push({
                    status: visible.rows[0].publication_status,
                    marked: visible.rows[0].marked
                });
                if (firstAttemptFails) throw new Error('fake storage unavailable');
                storage.delete(String(input.publicId));
                await listingPurgeModel.deleteMarkedMedia({
                    tx: db,
                    vertical,
                    mediaId: input.mediaId
                });
            },
            async revokeCalendarConnection() {}
        };
        const result = await purgeInactiveListing({
            ...adapter,
            clock: { now: () => t0 },
            afterCommit,
            vertical,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(result).toMatchObject({ purged: true, warnings: ['REMOTE_DELETION_FAILED'] });
        expect(reads).toHaveLength(1);
        expect(reads[0]?.status).toBe('PURGED');
        expect(reads[0]?.marked).toEqual(t0);
        const marked = await pool.query(
            `SELECT public_id, remote_deletion_pending_at FROM ${mediaTable} WHERE id = $1`,
            [mediaId]
        );
        expect(marked.rows).toHaveLength(1);
        expect(marked.rows[0]).toMatchObject({ public_id: publicId });
        expect(marked.rows[0].remote_deletion_pending_at).toEqual(t0);
        expect(storage.has(publicId)).toBe(true);
        const retry = await retryPorts({
            mediaId,
            vertical,
            publicId,
            storage,
            fail: { value: true }
        });
        const failed = await runRemoteDeletionRetry({ ports: retry.ports });
        expect(failed.failures).toContainEqual(
            expect.objectContaining({ kind: 'media', id: mediaId })
        );
        expect(retry.pingCount()).toBe(1);
        firstAttemptFails = false;
        retry.ports.remote.deleteRemoteMedia = afterCommit.deleteRemoteMedia;
        const succeeded = await runRemoteDeletionRetry({ ports: retry.ports });
        expect(succeeded.mediaDeleted).toBe(1);
        expect(
            await pool.query(`SELECT id FROM ${mediaTable} WHERE id = $1`, [mediaId])
        ).toMatchObject({ rows: [] });
        expect(storage.size).toBe(0);
    });
});

describe('TEST:V9b:3 AC:V9b:3 calendar revocation', () => {
    it('confirms a live provider immediately and still completes calendar when photo storage fails', async () => {
        const { userId, listing, adapter } = await archivedListing(VerticalEnum.ACCOMMODATION);
        const media = await db.execute(
            sql`INSERT INTO accommodation_media (accommodation_id, url, public_id, sort_order) VALUES (${listing.id}, 'https://fake.test/photo.jpg', ${`pb9/${randomUUID()}`}, 0) RETURNING id`
        );
        const mediaId = String(media.rows[0]?.id);
        mediaIds.set(mediaId, 'accommodation_media');
        const [connection] = await db
            .insert(accommodationCalendarSync)
            .values({
                accommodationId: listing.id,
                provider: 'GOOGLE_CALENDAR',
                accessTokenCiphertext: 'fake-ciphertext',
                accessTokenIv: 'fake-iv',
                accessTokenAuthTag: 'fake-tag',
                createdById: userId
            })
            .returning({ id: accommodationCalendarSync.id });
        if (!connection) throw new Error('calendar fixture insert failed');
        calendarIds.add(connection.id);
        const revocations: { accommodationId: string; connectionId: string; provider: string }[] =
            [];
        const result = await purgeInactiveListing({
            ...adapter,
            clock: { now: () => t0 },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID(),
            afterCommit: {
                async deleteRemoteMedia() {
                    throw new Error('fake storage unavailable');
                },
                async revokeCalendarConnection(input) {
                    revocations.push(input);
                    await listingPurgeModel.deleteMarkedCalendarConnection({
                        tx: db,
                        connectionId: input.connectionId
                    });
                }
            }
        });
        expect(result).toMatchObject({ purged: true, warnings: ['REMOTE_DELETION_FAILED'] });
        expect(revocations).toEqual([
            {
                accommodationId: listing.id,
                connectionId: connection.id,
                provider: 'GOOGLE_CALENDAR'
            }
        ]);
        expect(
            await db
                .select()
                .from(accommodationCalendarSync)
                .where(eq(accommodationCalendarSync.id, connection.id))
        ).toEqual([]);
    });

    it('leaves ciphertext pending on failure, then retry revokes and deletes the row', async () => {
        const { userId, listing, adapter } = await archivedListing(VerticalEnum.ACCOMMODATION);
        const [connection] = await db
            .insert(accommodationCalendarSync)
            .values({
                accommodationId: listing.id,
                provider: 'GOOGLE_CALENDAR',
                accessTokenCiphertext: 'fake-ciphertext',
                accessTokenIv: 'fake-iv',
                accessTokenAuthTag: 'fake-tag',
                createdById: userId
            })
            .returning({ id: accommodationCalendarSync.id });
        if (!connection) throw new Error('calendar fixture insert failed');
        calendarIds.add(connection.id);
        let fail = true;
        const revocations: { accommodationId: string; connectionId: string; provider: string }[] =
            [];
        const afterCommit = {
            async deleteRemoteMedia() {},
            async revokeCalendarConnection(input: {
                accommodationId: string;
                connectionId: string;
                provider: string;
            }) {
                revocations.push(input);
                if (fail) throw new Error('fake provider unavailable');
                await listingPurgeModel.deleteMarkedCalendarConnection({
                    tx: db,
                    connectionId: input.connectionId
                });
            }
        };
        const result = await purgeInactiveListing({
            ...adapter,
            clock: { now: () => t0 },
            afterCommit,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        expect(result).toMatchObject({ purged: true, warnings: ['REMOTE_DELETION_FAILED'] });
        const pending = await db
            .select()
            .from(accommodationCalendarSync)
            .where(eq(accommodationCalendarSync.id, connection.id));
        expect(pending).toHaveLength(1);
        expect(pending[0]).toMatchObject({
            isActive: false,
            accessTokenCiphertext: 'fake-ciphertext',
            remoteDeletionPendingAt: t0
        });
        expect(revocations[0]).toEqual({
            accommodationId: listing.id,
            connectionId: connection.id,
            provider: 'GOOGLE_CALENDAR'
        });
        fail = false;
        const retry = await runRemoteDeletionRetry({
            ports: {
                pending: {
                    async listMarkedMedia() {
                        return { items: [], next: null };
                    },
                    async listMarkedCalendarConnections({ after, limit }) {
                        const page = await listingPurgeModel.listMarkedCalendarConnections({
                            tx: db,
                            after,
                            limit
                        });
                        return {
                            items: page.items.filter((row) => row.connectionId === connection.id),
                            next: null
                        };
                    }
                },
                remote: {
                    async deleteRemoteMedia() {},
                    async revokeCalendarConnection(input) {
                        revocations.push(input);
                        await listingPurgeModel.deleteMarkedCalendarConnection({
                            tx: db,
                            connectionId: input.connectionId
                        });
                    }
                },
                monitor: { async ping() {} }
            }
        });
        expect(retry.calendarDeleted).toBe(1);
        expect(revocations.at(-1)).toEqual({
            accommodationId: listing.id,
            connectionId: connection.id,
            provider: 'GOOGLE_CALENDAR'
        });
        const count = await pool.query(
            'SELECT count(*)::int AS count FROM accommodation_calendar_sync WHERE accommodation_id = $1',
            [listing.id]
        );
        expect(count.rows[0].count).toBe(0);
    });
});

describe('TEST:V9b:3 AC:V9b:3 non-purged listings and third-party reviews', () => {
    it('does not call remote ports or mark media when the listing is not due or archived', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const notDue = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.ARCHIVED
        });
        const published = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.PUBLISHED
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${t0}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() + day)} WHERE id = ${notDue.id}`
        );
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date(t0.getTime() - 300 * day)}, deadlines_version = 1 WHERE id = ${published.id}`
        );
        const media = await db.execute(
            sql`INSERT INTO accommodation_media (accommodation_id, url, public_id, sort_order) VALUES (${notDue.id}, 'https://fake.test/not-due.jpg', 'not-due', 0), (${published.id}, 'https://fake.test/published.jpg', 'published', 0) RETURNING id`
        );
        for (const row of media.rows) mediaIds.set(String(row.id), 'accommodation_media');
        let calls = 0;
        const afterCommit = {
            async deleteRemoteMedia() {
                calls += 1;
            },
            async revokeCalendarConnection() {
                calls += 1;
            }
        };
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 2 }
        });
        for (const listing of [notDue, published]) {
            const result = await purgeInactiveListing({
                ...adapter,
                clock: { now: () => t0 },
                afterCommit,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                ownerId: userId,
                correlationId: randomUUID()
            });
            expect(result).toMatchObject({ purged: false });
        }
        expect(calls).toBe(0);
        const rows = await pool.query(
            'SELECT remote_deletion_pending_at FROM accommodation_media WHERE accommodation_id = ANY($1::uuid[])',
            [[notDue.id, published.id]]
        );
        expect(rows.rows).toEqual([
            { remote_deletion_pending_at: null },
            { remote_deletion_pending_at: null }
        ]);
    });

    it('preserves the complete third-party review row after PB9', async () => {
        const { userId, destinationId } = await fixtures.owner();
        const reviewer = await fixtures.owner();
        const listing = await fixtures.listing({
            vertical: VerticalEnum.ACCOMMODATION,
            userId,
            destinationId,
            status: Status.ARCHIVED
        });
        await db.execute(
            sql`UPDATE accommodations SET inactive_since = ${new Date(t0.getTime() - 300 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(t0.getTime() - day)} WHERE id = ${listing.id}`
        );
        const [review] = await db
            .insert(accommodationReviews)
            .values({
                accommodationId: listing.id,
                userId: reviewer.userId,
                title: 'Third party',
                content: 'Retain exactly',
                rating: {
                    cleanliness: 5,
                    hospitality: 5,
                    services: 5,
                    accuracy: 5,
                    communication: 5,
                    location: 5
                },
                averageRating: 5
            })
            .returning({ id: accommodationReviews.id });
        if (!review) throw new Error('review fixture insert failed');
        reviewIds.add(review.id);
        const before = await db
            .select()
            .from(accommodationReviews)
            .where(eq(accommodationReviews.id, review.id));
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 2 }
        });
        await purgeInactiveListing({
            ...adapter,
            clock: { now: () => t0 },
            afterCommit: { async deleteRemoteMedia() {}, async revokeCalendarConnection() {} },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: listing.id,
            ownerId: userId,
            correlationId: randomUUID()
        });
        const after = await db
            .select()
            .from(accommodationReviews)
            .where(eq(accommodationReviews.id, review.id));
        expect(after).toEqual(before);
    });
});
