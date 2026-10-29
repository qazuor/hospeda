import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { type RemoteDeletionRetryPorts, runRemoteDeletionRetry } from '@repo/verticals';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getRemoteDeletionRetryPorts } from '../../../src/utils/listing-publication/remote-deletion-retry-ports';
import { apiLogger } from '../../../src/utils/logger';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, readResponse } from './publication-routes.helpers';
import {
    cleanupPurgeAssetFixtures,
    createPurgeAssetFixture,
    type PurgeAssetFixture
} from './purge-remote-assets.helpers';

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

const app = initApp();
const fixtures: PurgeAssetFixture[] = [];
beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => {
    vi.restoreAllMocks();
    await cleanupPurgeAssetFixtures(fixtures);
    await testDb.teardown();
});

/** Returns a retry population containing only the explicitly owned media row ids. */
function ownPopulation(ids: ReadonlySet<string>): RemoteDeletionRetryPorts['pending'] {
    const production = getRemoteDeletionRetryPorts().pending;
    return {
        listMarkedMedia: async ({ limit }) => {
            const items: Awaited<ReturnType<typeof production.listMarkedMedia>>['items'][number][] =
                [];
            let after: Parameters<typeof production.listMarkedMedia>[0]['after'] = null;
            for (let pages = 0; pages < 10_000; pages += 1) {
                const page = await production.listMarkedMedia({ after, limit });
                items.push(...page.items.filter(({ mediaId }) => ids.has(mediaId)));
                if (page.next === null) return { items, next: null };
                after = page.next;
            }
            throw new Error('Marked media population never ended');
        },
        // This test seeds no calendars; isolate marked connections from other suites.
        listMarkedCalendarConnections: async () => ({ items: [], next: null })
    };
}

async function runOwnRetry(ids: ReadonlySet<string>) {
    return runRemoteDeletionRetry({
        ports: { ...getRemoteDeletionRetryPorts(), pending: ownPopulation(ids) }
    });
}

describe('TEST:1702:3 AC:1702:2 a failed remote deletion of the menu file and dish photos never reverts PB12, is retried and is logged', () => {
    it('keeps both marked rows while down, reports failures, then deletes them when storage recovers', async () => {
        const fixture = await createPurgeAssetFixture(
            VerticalEnum.VENUE,
            PublicationStatusEnum.DRAFT,
            { includeGallery: false }
        );
        fixtures.push(fixture);
        const remoteIds = fixture.publicIds.filter(
            (id) => id.endsWith(':menu-file') || id.endsWith(':dish-a')
        );
        for (const publicId of remoteIds) storage.stored.add(publicId);
        const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined);
        const response = await readResponse(
            await app.request(`/api/v1/protected/venues/${fixture.listingId}/purge`, {
                method: 'POST',
                headers: actorHeaders({ id: fixture.ownerId })
            })
        );
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ purged: true });
        const status = await getDb().execute(
            sql`SELECT publication_status FROM venues WHERE id = ${fixture.listingId}::uuid`
        );
        expect(status.rows).toEqual([{ publication_status: 'PURGED' }]);
        await vi.waitFor(() =>
            expect(storage.deleteCalls.filter((id) => remoteIds.includes(id)).sort()).toEqual(
                [...remoteIds].sort()
            )
        );
        const rows = await getDb().execute(
            sql<{
                id: string;
                public_id: string;
                remote_deletion_pending_at: Date | null;
            }>`SELECT id, public_id, remote_deletion_pending_at FROM venue_media WHERE venue_id = ${fixture.listingId}::uuid AND remote_deletion_pending_at IS NOT NULL ORDER BY public_id`
        );
        expect(rows.rows.map(({ public_id }) => public_id)).toEqual([...remoteIds].sort());
        expect(
            rows.rows.every(({ remote_deletion_pending_at }) => remote_deletion_pending_at !== null)
        ).toBe(true);
        expect(
            [...storage.stored].filter((id) => id.startsWith(`${fixture.listingId}:`)).sort()
        ).toEqual([...remoteIds].sort());
        const warningCalls = warn.mock.calls.filter(
            ([context]) => (context as { listingId?: string }).listingId === fixture.listingId
        );
        expect(warningCalls).toHaveLength(1);
        expect(warningCalls[0]?.[0]).toEqual({
            listingId: fixture.listingId,
            vertical: 'venue',
            warnings: ['REMOTE_DELETION_FAILED', 'REMOTE_DELETION_FAILED']
        });

        const ids = new Set(rows.rows.map(({ id }) => String(id)));
        const failed = await runOwnRetry(ids);
        expect(
            failed.failures
                .map(({ kind, id, vertical }) => ({ kind, id: String(id), vertical }))
                .sort((a, b) => a.id.localeCompare(b.id))
        ).toEqual(
            rows.rows
                .map(({ id }) => ({ kind: 'media', id: String(id), vertical: 'venue' }))
                .sort((a, b) => a.id.localeCompare(b.id))
        );
        expect(failed.failures.every(({ error }) => error instanceof Error)).toBe(true);
        const idList = sql.join(
            [...ids].map((id) => sql`${id}::uuid`),
            sql`, `
        );
        const stillMarked = await getDb().execute(
            sql`SELECT id FROM venue_media WHERE id IN (${idList}) AND remote_deletion_pending_at IS NOT NULL`
        );
        expect(stillMarked.rows.map((row) => String((row as { id: string }).id)).sort()).toEqual(
            [...ids].sort()
        );

        storage.down = false;
        const recovered = await runOwnRetry(ids);
        expect(recovered.mediaDeleted).toBe(2);
        expect(recovered.failures).toEqual([]);
        const remaining = await getDb().execute(
            sql`SELECT id FROM venue_media WHERE id IN (${idList})`
        );
        expect(remaining.rows).toEqual([]);
        expect([...storage.stored].filter((id) => remoteIds.includes(id)).sort()).toEqual([]);
    });
});
