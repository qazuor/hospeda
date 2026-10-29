import { randomUUID } from 'node:crypto';
import { accommodationCalendarSync, getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    type CalendarConnectionRevocationPort,
    getCalendarConnectionRevocationPort,
    setCalendarConnectionRevocationPort
} from '@repo/service-core';
import { type RemoteDeletionRetryPorts, runRemoteDeletionRetry } from '@repo/verticals';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { purgeInactiveListing } from '../../../../../packages/verticals/src/publication/purge-inactive-listing';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { getPurgeAfterCommit } from '../../../src/utils/listing-publication/purge-ports';
import { getRemoteDeletionRetryPorts } from '../../../src/utils/listing-publication/remote-deletion-retry-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from './publication-routes.helpers';

const storage = vi.hoisted(() => ({
    stored: new Set<string>(),
    down: true,
    deleteCalls: [] as string[],
    observed: [] as string[]
}));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        delete: async ({ publicId }: { readonly publicId: string }) => {
            storage.deleteCalls.push(publicId);
            const listingId = publicId.split(':')[0];
            const result = await getDb().execute(sql<{ status: string }>`
                SELECT publication_status AS status FROM accommodations WHERE id = ${listingId}::uuid
            `);
            storage.observed.push(String(result.rows[0]?.status));
            if (storage.down) throw new Error('storage down');
            storage.stored.delete(publicId);
        }
    })
}));

const calendar = {
    down: true,
    revokeCalls: [] as { accommodationId: string; provider: string }[],
    observed: [] as string[]
};
const fakeRevocation: CalendarConnectionRevocationPort = {
    revoke: async ({ accommodationId, provider }) => {
        calendar.revokeCalls.push({ accommodationId, provider });
        const result = await getDb().execute(sql<{ status: string }>`
            SELECT publication_status AS status FROM accommodations WHERE id = ${accommodationId}::uuid
        `);
        calendar.observed.push(String(result.rows[0]?.status));
        return calendar.down ? { revoked: false, reason: 'provider down' } : { revoked: true };
    }
};

type Vertical =
    | typeof VerticalEnum.ACCOMMODATION
    | typeof VerticalEnum.VENUE
    | typeof VerticalEnum.EXPERIENCE;
const verticalConfig: Readonly<Record<Vertical, { table: string; media: string; fk: string }>> = {
    [VerticalEnum.ACCOMMODATION]: {
        table: 'accommodations',
        media: 'accommodation_media',
        fk: 'accommodation_id'
    },
    [VerticalEnum.VENUE]: {
        table: 'venues',
        media: 'venue_media',
        fk: 'venue_id'
    },
    [VerticalEnum.EXPERIENCE]: {
        table: 'experiences',
        media: 'experience_media',
        fk: 'experience_id'
    }
};
type Fixture = {
    ownerId: string;
    destinationId: string;
    listingId: string;
    mediaId: string;
    publicId: string;
    connectionId?: string;
    vertical: Vertical;
};
const nonAccommodationVerticals: readonly Vertical[] = [
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
];
const fixtures: Fixture[] = [];
let previousRevocation: CalendarConnectionRevocationPort | undefined;
const day = 86_400_000;
const now = new Date('2026-10-10T12:00:00.000Z');

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
    previousRevocation = getCalendarConnectionRevocationPort();
    setCalendarConnectionRevocationPort(fakeRevocation);
});

afterAll(async () => {
    setCalendarConnectionRevocationPort(previousRevocation);
    for (const fixture of fixtures) {
        const config = verticalConfig[fixture.vertical];
        if (fixture.connectionId)
            await getDb().execute(
                sql`DELETE FROM accommodation_calendar_sync WHERE id = ${fixture.connectionId}::uuid`
            );
        await getDb().execute(
            sql`DELETE FROM ${sql.identifier(config.media)} WHERE id = ${fixture.mediaId}::uuid`
        );
        await getDb().execute(
            sql`UPDATE ${sql.identifier(config.table)} SET deleted_at = now() WHERE id = ${fixture.listingId}::uuid`
        );
        await getDb().execute(
            sql`UPDATE users SET deleted_at = now() WHERE id = ${fixture.ownerId}::uuid`
        );
        storage.stored.delete(fixture.publicId);
    }
    await testDb.teardown();
});

async function createFixture(
    vertical: Vertical,
    options: { calendar?: boolean; provider?: string } = {}
): Promise<Fixture> {
    const owner = await createOwner();
    const destinationId = await createVerticalDestination();
    const listingId =
        vertical === VerticalEnum.ACCOMMODATION
            ? await createListing({
                  ownerId: owner.id,
                  destinationId,
                  status: PublicationStatusEnum.ARCHIVED,
                  complete: false
              })
            : await createVerticalListing({
                  vertical,
                  ownerId: owner.id,
                  destinationId,
                  status: PublicationStatusEnum.ARCHIVED,
                  complete: false
              });
    const config = verticalConfig[vertical];
    await getDb().execute(
        sql`UPDATE ${sql.identifier(config.table)} SET publication_status = 'ARCHIVED', inactive_since = ${new Date(now.getTime() - 200 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(now.getTime() - day)} WHERE id = ${listingId}::uuid`
    );
    const publicId = `${listingId}:${randomUUID()}`;
    const media = await getDb().execute(
        sql<{
            id: string;
        }>`INSERT INTO ${sql.identifier(config.media)} (${sql.identifier(config.fk)}, url, public_id, sort_order) VALUES (${listingId}::uuid, ${`https://example.test/${publicId}`}, ${publicId}, 0) RETURNING id`
    );
    const mediaId = String(media.rows[0]?.id);
    const fixture: Fixture = {
        ownerId: owner.id,
        destinationId,
        listingId,
        mediaId,
        publicId,
        vertical
    };
    if (options.calendar) {
        const [connection] = await getDb()
            .insert(accommodationCalendarSync)
            .values({
                accommodationId: listingId,
                provider: options.provider ?? 'GOOGLE_CALENDAR',
                accessTokenCiphertext: 'fixture-ciphertext',
                accessTokenIv: 'fixture-iv',
                accessTokenAuthTag: 'fixture-tag',
                createdById: owner.id
            })
            .returning({ id: accommodationCalendarSync.id });
        if (!connection) throw new Error('Calendar fixture was not created');
        fixture.connectionId = connection.id;
    }
    fixtures.push(fixture);
    storage.stored.add(publicId);
    return fixture;
}

async function runPurge(fixture: Fixture) {
    return purgeInactiveListing({
        ...getListingPublicationPorts(),
        billing: {
            coverage: async () => ({ covered: false, sources: [] }),
            retentionStopped: async () => ({
                stopped: false,
                pauseEndedAt: null,
                coverageLostAt: null
            })
        },
        afterCommit: getPurgeAfterCommit(),
        clock: { now: () => now },
        previousPassStartedAt: now,
        vertical: fixture.vertical,
        listingId: fixture.listingId,
        ownerId: fixture.ownerId,
        correlationId: randomUUID()
    });
}

function ownPopulation(owned: readonly Fixture[]): RemoteDeletionRetryPorts['pending'] {
    const production = getRemoteDeletionRetryPorts().pending;
    const mediaIds = new Set(owned.map(({ mediaId }) => mediaId));
    const connectionIds = new Set(
        owned.flatMap(({ connectionId }) => (connectionId ? [connectionId] : []))
    );
    return {
        listMarkedMedia: async ({ after, limit }) => {
            const all = await production.listMarkedMedia({ after, limit });
            return { ...all, items: all.items.filter(({ mediaId }) => mediaIds.has(mediaId)) };
        },
        listMarkedCalendarConnections: async ({ after, limit }) => {
            const all = await production.listMarkedCalendarConnections({ after, limit });
            return {
                ...all,
                items: all.items.filter(({ connectionId }) => connectionIds.has(connectionId))
            };
        }
    };
}

async function mediaRow(fixture: Fixture) {
    return getDb().execute(
        sql<{
            pending: Date | null;
            publicId: string | null;
        }>`SELECT remote_deletion_pending_at AS pending, public_id AS "publicId" FROM ${sql.identifier(verticalConfig[fixture.vertical].media)} WHERE id = ${fixture.mediaId}::uuid`
    );
}

describe('TEST:V9b:3 AC:V9b:3 — production remote deletion adapters and daily retry', () => {
    it('marks after the commit, retries failures, confirms both remotes, and covers other verticals and iCal', async () => {
        const accommodation = await createFixture(VerticalEnum.ACCOMMODATION, { calendar: true });
        storage.down = true;
        calendar.down = true;
        storage.observed.length = 0;
        calendar.observed.length = 0;
        const failed = await runPurge(accommodation);
        expect(failed).toMatchObject({
            purged: true,
            warnings: ['REMOTE_DELETION_FAILED', 'REMOTE_DELETION_FAILED']
        });
        expect(storage.observed).toEqual([PublicationStatusEnum.PURGED]);
        expect(calendar.observed).toEqual([PublicationStatusEnum.PURGED]);
        expect((await mediaRow(accommodation)).rows).toEqual([
            expect.objectContaining({
                pending: expect.anything(),
                publicId: accommodation.publicId
            })
        ]);
        const connection = await getDb().execute(
            sql<{
                pending: Date | null;
                active: boolean;
                token: string;
            }>`SELECT remote_deletion_pending_at AS pending, is_active AS active, access_token_ciphertext AS token FROM accommodation_calendar_sync WHERE id = ${accommodation.connectionId}::uuid`
        );
        expect(connection.rows).toEqual([
            expect.objectContaining({
                pending: expect.anything(),
                active: false,
                token: 'fixture-ciphertext'
            })
        ]);

        const pings: string[] = [];
        const monitor: RemoteDeletionRetryPorts['monitor'] = {
            ping: async ({ job }) => {
                pings.push(job);
            }
        };
        const retry = async () =>
            runRemoteDeletionRetry({
                ports: {
                    ...getRemoteDeletionRetryPorts(),
                    pending: ownPopulation([accommodation]),
                    monitor
                }
            });
        const stillDown = await retry();
        expect(stillDown.complete).toBe(true);
        expect(stillDown.failures.map(({ kind, id }) => ({ kind, id }))).toEqual([
            { kind: 'media', id: accommodation.mediaId },
            { kind: 'calendar', id: accommodation.connectionId }
        ]);
        expect(pings).toEqual(['listing-remote-deletion-retry']);
        expect((await mediaRow(accommodation)).rows[0]?.pending).toBeTruthy();
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM accommodation_calendar_sync WHERE id = ${accommodation.connectionId}::uuid`
                )
            ).rows
        ).toHaveLength(1);

        storage.down = false;
        calendar.down = false;
        const recovered = await retry();
        expect(recovered).toMatchObject({ complete: true, mediaDeleted: 1, calendarDeleted: 1 });
        expect(
            recovered.failures.filter(
                ({ id }) => id === accommodation.mediaId || id === accommodation.connectionId
            )
        ).toEqual([]);
        expect((await mediaRow(accommodation)).rows).toEqual([]);
        expect(storage.stored.has(accommodation.publicId)).toBe(false);
        expect(calendar.revokeCalls.at(-1)).toEqual({
            accommodationId: accommodation.listingId,
            provider: 'GOOGLE_CALENDAR'
        });
        expect(
            (
                await getDb().execute(
                    sql`SELECT count(*)::int AS count FROM accommodation_calendar_sync WHERE accommodation_id = ${accommodation.listingId}::uuid`
                )
            ).rows[0]?.count
        ).toBe(0);

        const immediate = await createFixture(VerticalEnum.ACCOMMODATION, { calendar: true });
        storage.down = false;
        calendar.down = false;
        const revocationsBefore = calendar.revokeCalls.length;
        const immediateResult = await runPurge(immediate);
        expect(immediateResult).toMatchObject({ purged: true, warnings: [] });
        expect(storage.stored.has(immediate.publicId)).toBe(false);
        expect(calendar.revokeCalls.slice(revocationsBefore)).toEqual([
            { accommodationId: immediate.listingId, provider: 'GOOGLE_CALENDAR' }
        ]);
        expect((await mediaRow(immediate)).rows).toEqual([]);
        expect(
            (await retry()).failures.some(
                ({ id }) => id === immediate.mediaId || id === immediate.connectionId
            )
        ).toBe(false);

        for (const vertical of nonAccommodationVerticals) {
            const other = await createFixture(vertical);
            storage.down = true;
            const first = await runPurge(other);
            expect(first).toMatchObject({ purged: true, warnings: ['REMOTE_DELETION_FAILED'] });
            expect((await mediaRow(other)).rows[0]?.pending).toBeTruthy();
            storage.down = false;
            const daily = await retryFor([other]);
            expect(daily.mediaDeleted).toBe(1);
            expect((await mediaRow(other)).rows).toEqual([]);
            expect(storage.stored.has(other.publicId)).toBe(false);
        }

        const ical = await createFixture(VerticalEnum.ACCOMMODATION, {
            calendar: true,
            provider: 'AIRBNB'
        });
        calendar.down = true;
        const icalBefore = calendar.revokeCalls.length;
        const icalResult = await runPurge(ical);
        expect(icalResult).toMatchObject({ purged: true, warnings: [] });
        expect(calendar.revokeCalls.slice(icalBefore)).toEqual([
            { accommodationId: ical.listingId, provider: 'AIRBNB' }
        ]);
        expect(
            (
                await getDb().execute(
                    sql`SELECT id FROM accommodation_calendar_sync WHERE id = ${ical.connectionId}::uuid`
                )
            ).rows
        ).toEqual([]);
    });
});

async function retryFor(owned: readonly Fixture[]) {
    return runRemoteDeletionRetry({
        ports: {
            ...getRemoteDeletionRetryPorts(),
            pending: ownPopulation(owned),
            monitor: { ping: async () => {} }
        }
    });
}
