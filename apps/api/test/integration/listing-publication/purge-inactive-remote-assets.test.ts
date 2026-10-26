import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { purgeInactiveListing } from '../../../../../packages/verticals/src/publication/purge-inactive-listing';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { getPurgeAfterCommit } from '../../../src/utils/listing-publication/purge-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    cleanupPurgeAssetFixtures,
    createPurgeAssetFixture,
    type PurgeAssetFixture
} from './purge-remote-assets.helpers';

const storage = vi.hoisted(() => ({
    stored: new Set<string>(),
    down: false,
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

const fixtures: PurgeAssetFixture[] = [];
const day = 86_400_000;
const now = new Date('2026-10-10T12:00:00.000Z');
beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
});
afterAll(async () => {
    await cleanupPurgeAssetFixtures(fixtures);
    await testDb.teardown();
});

describe('TEST:1702:4 AC:1702:1 PB9 deletes the menu file and dish photos after its commit', () => {
    it('deletes the marked menu, dish, and gallery assets from an expired archived gastronomy', async () => {
        const fixture = await createPurgeAssetFixture(
            VerticalEnum.VENUE,
            PublicationStatusEnum.ARCHIVED
        );
        fixtures.push(fixture);
        await getDb().execute(
            sql`UPDATE gastronomies SET publication_status = 'ARCHIVED', inactive_since = ${new Date(now.getTime() - 200 * day)}, deadlines_version = 1, deletion_announced_at = ${new Date(now.getTime() - day)} WHERE id = ${fixture.listingId}::uuid`
        );
        for (const publicId of fixture.publicIds) storage.stored.add(publicId);
        const result = await purgeInactiveListing({
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
            vertical: VerticalEnum.VENUE,
            listingId: fixture.listingId,
            ownerId: fixture.ownerId,
            correlationId: randomUUID()
        });
        expect(result.purged).toBe(true);
        expect(
            storage.deleteCalls.filter((id) => id.startsWith(`${fixture.listingId}:`)).sort()
        ).toEqual([...fixture.publicIds].sort());
        const media = await getDb().execute(
            sql`SELECT id FROM gastronomy_media WHERE gastronomy_id = ${fixture.listingId}::uuid`
        );
        const listing = await getDb().execute(
            sql`SELECT publication_status FROM gastronomies WHERE id = ${fixture.listingId}::uuid`
        );
        expect(media.rows).toEqual([]);
        expect(listing.rows).toEqual([{ publication_status: 'PURGED' }]);
        expect(
            [...storage.stored].filter((id) => id.startsWith(`${fixture.listingId}:`)).sort()
        ).toEqual([]);
    });
});
