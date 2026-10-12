import { randomUUID } from 'node:crypto';
import { accommodationCalendarSync, accommodationMedia, getDb, sql, userBookmarks } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import {
    type CalendarConnectionRevocationPort,
    getCalendarConnectionRevocationPort,
    setCalendarConnectionRevocationPort
} from '@repo/service-core';
import { type RemoteDeletionRetryPorts, runRemoteDeletionRetry } from '@repo/verticals';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getRemoteDeletionRetryPorts } from '../../../src/utils/listing-publication/remote-deletion-retry-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

/** The fake external storage: a set of public ids whose `delete` throws while it is down. */
const storage = vi.hoisted(() => ({
    stored: new Set<string>(),
    down: true,
    deleteCalls: [] as string[]
}));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        delete: async ({ publicId }: { readonly publicId: string }) => {
            storage.deleteCalls.push(publicId);
            if (storage.down) throw new Error('storage down');
            storage.stored.delete(publicId);
        }
    })
}));

const calendar = { down: true, revokeCalls: [] as string[] };
const fakeRevocation: CalendarConnectionRevocationPort = {
    revoke: async ({ accommodationId }) => {
        calendar.revokeCalls.push(accommodationId);
        return calendar.down ? { revoked: false, reason: 'provider down' } : { revoked: true };
    }
};

const app = initApp();
let previousRevocation: CalendarConnectionRevocationPort | undefined;
const fixture = {
    ownerId: '',
    fanId: '',
    bookmarkId: '',
    listingId: '',
    slug: '',
    mediaId: '',
    mediaUrl: '',
    publicId: '',
    connectionId: ''
};

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    previousRevocation = getCalendarConnectionRevocationPort();
    setCalendarConnectionRevocationPort(fakeRevocation);
});

afterAll(async () => {
    setCalendarConnectionRevocationPort(previousRevocation);
    const db = getDb();
    if (fixture.mediaId) {
        await db.execute(
            sql`DELETE FROM accommodation_media WHERE id = ${fixture.mediaId}::uuid AND remote_deletion_pending_at IS NOT NULL`
        );
    }
    if (fixture.connectionId) {
        await db.execute(
            sql`DELETE FROM accommodation_calendar_sync WHERE id = ${fixture.connectionId}::uuid AND remote_deletion_pending_at IS NOT NULL`
        );
    }
    if (fixture.bookmarkId) {
        await db.execute(sql`DELETE FROM user_bookmarks WHERE id = ${fixture.bookmarkId}::uuid`);
    }
    if (fixture.listingId) {
        await db.execute(
            sql`UPDATE accommodations SET deleted_at = now() WHERE id = ${fixture.listingId}::uuid AND deleted_at IS NULL`
        );
    }
    for (const userId of [fixture.ownerId, fixture.fanId].filter(Boolean)) {
        await db.execute(
            sql`UPDATE users SET deleted_at = now() WHERE id = ${userId}::uuid AND deleted_at IS NULL`
        );
    }
    await testDb.teardown();
});

/** Waits until `check` holds, so PB12's single post-commit attempt has settled before a run. */
async function waitFor(check: () => boolean, what: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (!check()) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
}

/**
 * Walks every real page of the production population and keeps only this test's rows, so a run
 * never touches the marked rows other suites leave in the shared database.
 */
function ownPopulation(): RemoteDeletionRetryPorts['pending'] {
    const { pending } = getRemoteDeletionRetryPorts();
    return {
        listMarkedMedia: async ({ limit }) => {
            const items: Awaited<ReturnType<typeof pending.listMarkedMedia>>['items'][number][] =
                [];
            let after: Parameters<typeof pending.listMarkedMedia>[0]['after'] = null;
            for (let pages = 0; pages < 10_000; pages += 1) {
                const page = await pending.listMarkedMedia({ after, limit });
                items.push(...page.items.filter((item) => item.mediaId === fixture.mediaId));
                if (page.next === null) return { items, next: null };
                after = page.next;
            }
            throw new Error('Marked media population never ended');
        },
        listMarkedCalendarConnections: async ({ limit }) => {
            const items: Awaited<
                ReturnType<typeof pending.listMarkedCalendarConnections>
            >['items'][number][] = [];
            let after: string | null = null;
            for (let pages = 0; pages < 10_000; pages += 1) {
                const page = await pending.listMarkedCalendarConnections({ after, limit });
                items.push(
                    ...page.items.filter((item) => item.connectionId === fixture.connectionId)
                );
                if (page.next === null) return { items, next: null };
                after = page.next;
            }
            throw new Error('Marked calendar population never ended');
        }
    };
}

async function readMedia() {
    const result = await getDb().execute(
        sql<{
            pending: Date | null;
        }>`SELECT remote_deletion_pending_at AS pending FROM accommodation_media WHERE id = ${fixture.mediaId}::uuid`
    );
    return result.rows[0];
}

async function readConnection() {
    const result = await getDb().execute(
        sql<{
            pending: Date | null;
            isActive: boolean;
        }>`SELECT remote_deletion_pending_at AS pending, is_active AS "isActive" FROM accommodation_calendar_sync WHERE id = ${fixture.connectionId}::uuid`
    );
    return result.rows[0];
}

describe('TEST:V6:38 the daily retry of the PB12 remote deletions', () => {
    const pings: string[] = [];
    const monitor: RemoteDeletionRetryPorts['monitor'] = {
        ping: async ({ job }) => {
            pings.push(job);
        }
    };

    it('TEST:V6:38 PB12 confirms with storage down and leaves both rows marked', async () => {
        await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
        const owner = await createOwner();
        fixture.ownerId = owner.id;
        fixture.listingId = await createListing({
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: PublicationStatusEnum.PUBLISHED,
            complete: false
        });
        const slugRow = await getDb().execute(
            sql<{
                slug: string;
            }>`SELECT slug FROM accommodations WHERE id = ${fixture.listingId}::uuid`
        );
        fixture.slug = String(slugRow.rows[0]?.slug);
        fixture.publicId = `retry-${randomUUID()}`;
        fixture.mediaUrl = `https://example.test/${fixture.publicId}.jpg`;
        storage.stored.add(fixture.publicId);
        const [media] = await getDb()
            .insert(accommodationMedia)
            .values({
                accommodationId: fixture.listingId,
                url: fixture.mediaUrl,
                publicId: fixture.publicId,
                moderationState: 'APPROVED',
                state: 'visible',
                isFeatured: true,
                sortOrder: 0
            })
            .returning({ id: accommodationMedia.id });
        if (!media) throw new Error('Media fixture was not created');
        fixture.mediaId = media.id;
        const [connection] = await getDb()
            .insert(accommodationCalendarSync)
            .values({
                accommodationId: fixture.listingId,
                provider: 'GOOGLE_CALENDAR',
                accessTokenCiphertext: 'fixture-ciphertext',
                accessTokenIv: 'fixture-iv',
                accessTokenAuthTag: 'fixture-tag',
                createdById: owner.id
            })
            .returning({ id: accommodationCalendarSync.id });
        if (!connection) throw new Error('Calendar fixture was not created');
        fixture.connectionId = connection.id;
        const fan = await createOwner();
        fixture.fanId = fan.id;
        const [bookmark] = await getDb()
            .insert(userBookmarks)
            .values({ userId: fan.id, entityId: fixture.listingId, entityType: 'ACCOMMODATION' })
            .returning({ id: userBookmarks.id });
        if (!bookmark) throw new Error('Bookmark fixture was not created');
        fixture.bookmarkId = bookmark.id;

        const response = await readResponse(
            await app.request(`/api/v1/protected/accommodations/${fixture.listingId}/purge`, {
                method: 'POST',
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ purged: true });
        await waitFor(
            () =>
                storage.deleteCalls.includes(fixture.publicId) &&
                calendar.revokeCalls.includes(fixture.listingId),
            'the PB12 post-commit attempts'
        );

        const listing = await getDb().execute(
            sql<{
                status: string;
            }>`SELECT publication_status AS status FROM accommodations WHERE id = ${fixture.listingId}::uuid`
        );
        expect(listing.rows[0]?.status).toBe(PublicationStatusEnum.PURGED);
        expect((await readMedia())?.pending).toBeTruthy();
        const marked = await readConnection();
        expect(marked?.pending).toBeTruthy();
        expect(marked?.isActive).toBe(false);
        expect(storage.stored.has(fixture.publicId)).toBe(true);
    });

    it('TEST:V6:38 no surface shows the purged listing or its marked photo', async () => {
        const anonymous = { accept: 'application/json', 'user-agent': 'vitest' };
        const surfaces: Readonly<
            Record<string, { path: string; headers: HeadersInit; status: number }>
        > = {
            'public by id': {
                path: `/api/v1/public/accommodations/${fixture.listingId}`,
                headers: anonymous,
                status: 404
            },
            'public by slug': {
                path: `/api/v1/public/accommodations/slug/${fixture.slug}`,
                headers: anonymous,
                status: 404
            },
            'owner by id': {
                path: `/api/v1/protected/accommodations/${fixture.listingId}`,
                headers: actorHeaders({ id: fixture.ownerId }),
                status: 404
            },
            'owner gallery': {
                path: `/api/v1/protected/accommodations/${fixture.listingId}/media`,
                headers: actorHeaders({ id: fixture.ownerId }),
                status: 200
            },
            'admin gallery': {
                path: `/api/v1/admin/accommodations/${fixture.listingId}/media`,
                headers: actorHeaders({
                    id: fixture.ownerId,
                    role: RoleEnum.ADMIN,
                    permissions: [
                        PermissionEnum.ACCESS_PANEL_ADMIN,
                        PermissionEnum.ACCESS_API_ADMIN,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]
                }),
                status: 200
            },
            'bookmarks of a fan': {
                path: '/api/v1/protected/user-bookmarks',
                headers: actorHeaders({
                    id: fixture.fanId,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.USER_BOOKMARK_VIEW]
                }),
                status: 200
            }
        };
        const seen: { name: string; status: number; showsMarkedPhoto: boolean }[] = [];
        for (const [name, surface] of Object.entries(surfaces)) {
            const response = await app.request(surface.path, { headers: surface.headers });
            const body = await response.text();
            seen.push({
                name,
                status: response.status,
                showsMarkedPhoto: [fixture.mediaId, fixture.mediaUrl, fixture.publicId].some(
                    (value) => body.includes(value)
                )
            });
        }
        expect(seen).toEqual(
            Object.entries(surfaces).map(([name, surface]) => ({
                name,
                status: surface.status,
                showsMarkedPhoto: false
            }))
        );
    });

    it('TEST:V6:38 a run with storage still down reports the pending rows as failures and pings', async () => {
        const summary = await runRemoteDeletionRetry({
            ports: { ...getRemoteDeletionRetryPorts(), pending: ownPopulation(), monitor }
        });
        expect(summary.complete).toBe(true);
        expect(
            summary.failures.filter(
                (failure) => failure.kind === 'media' && failure.id === fixture.mediaId
            )
        ).toHaveLength(1);
        expect(
            summary.failures.filter(
                (failure) => failure.kind === 'calendar' && failure.id === fixture.connectionId
            )
        ).toHaveLength(1);
        expect((await readMedia())?.pending).toBeTruthy();
        expect((await readConnection())?.pending).toBeTruthy();
        expect(storage.stored.has(fixture.publicId)).toBe(true);
        expect(pings).toEqual(['listing-remote-deletion-retry']);
    });

    it('TEST:V6:38 the next run with storage back deletes on both sides and pings again', async () => {
        storage.down = false;
        calendar.down = false;
        const revokesBefore = calendar.revokeCalls.length;
        const summary = await runRemoteDeletionRetry({
            ports: { ...getRemoteDeletionRetryPorts(), pending: ownPopulation(), monitor }
        });
        expect(summary.complete).toBe(true);
        expect(
            summary.failures.filter(
                (failure) => failure.id === fixture.mediaId || failure.id === fixture.connectionId
            )
        ).toEqual([]);
        expect(summary.mediaDeleted).toBe(1);
        expect(summary.calendarDeleted).toBe(1);
        expect(await readMedia()).toBeUndefined();
        expect(await readConnection()).toBeUndefined();
        expect(storage.stored.has(fixture.publicId)).toBe(false);
        expect(calendar.revokeCalls.slice(revokesBefore)).toEqual([fixture.listingId]);
        expect(pings).toEqual(['listing-remote-deletion-retry', 'listing-remote-deletion-retry']);
    });
});
