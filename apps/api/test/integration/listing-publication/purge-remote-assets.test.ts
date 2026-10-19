import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, readResponse } from './publication-routes.helpers';
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

const app = initApp();
const fixtures: PurgeAssetFixture[] = [];
const routeNames: Readonly<Record<PurgeAssetFixture['vertical'], string>> = {
    [VerticalEnum.GASTRONOMY]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences',
    [VerticalEnum.ACCOMMODATION]: 'accommodations'
};

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => {
    await cleanupPurgeAssetFixtures(fixtures);
    await testDb.teardown();
});

/** Waits for the final post-commit deletion call before database assertions run. */
async function waitForCalls(count: number): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (storage.deleteCalls.length < count) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for post-commit deletes');
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
}

async function purge(fixture: PurgeAssetFixture) {
    return readResponse(
        await app.request(
            `/api/v1/protected/${routeNames[fixture.vertical]}/${fixture.listingId}/purge`,
            { method: 'POST', headers: actorHeaders({ id: fixture.ownerId }) }
        )
    );
}

describe('TEST:1702:2 AC:1702:1 AC:1702:3 AC:1702:4 PB12 deletes every remote file of a purged listing', () => {
    it('deletes only uploaded assets and clears the purged listing content in every vertical', async () => {
        for (const vertical of [
            VerticalEnum.GASTRONOMY,
            VerticalEnum.EXPERIENCE,
            VerticalEnum.ACCOMMODATION
        ] as const) {
            const fixture = await createPurgeAssetFixture(vertical, PublicationStatusEnum.DRAFT);
            fixtures.push(fixture);
            for (const publicId of fixture.publicIds) storage.stored.add(publicId);
            const before = storage.deleteCalls.length;
            const response = await purge(fixture);
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual({ purged: true });
            await waitForCalls(before + fixture.publicIds.length);
            expect(
                storage.deleteCalls
                    .slice(before)
                    .filter((id) => id.startsWith(`${fixture.listingId}:`))
                    .sort()
            ).toEqual([...fixture.publicIds].sort());
            expect(
                [...storage.stored].filter((id) => id.startsWith(`${fixture.listingId}:`)).sort()
            ).toEqual([]);
            if (vertical === VerticalEnum.GASTRONOMY) {
                const media = await getDb().execute(
                    sql`SELECT id FROM gastronomy_media WHERE gastronomy_id = ${fixture.listingId}::uuid`
                );
                const content = await getDb().execute(
                    sql`SELECT menu_file_url, menu_file_public_id, menu_file_kind, videos FROM gastronomies WHERE id = ${fixture.listingId}::uuid`
                );
                const dishes = await getDb().execute(
                    sql`SELECT id FROM gastronomy_menu_items WHERE gastronomy_id = ${fixture.listingId}::uuid`
                );
                const sections = await getDb().execute(
                    sql`SELECT id FROM gastronomy_menu_sections WHERE gastronomy_id = ${fixture.listingId}::uuid`
                );
                expect(media.rows).toEqual([]);
                expect(content.rows).toEqual([
                    {
                        menu_file_url: null,
                        menu_file_public_id: null,
                        menu_file_kind: null,
                        videos: null
                    }
                ]);
                expect(dishes.rows).toEqual([]);
                expect(sections.rows).toEqual([]);
            } else if (vertical === VerticalEnum.EXPERIENCE) {
                const certificates = await getDb().execute(
                    sql`SELECT id FROM experience_certificates WHERE experience_id = ${fixture.listingId}::uuid`
                );
                const content = await getDb().execute(
                    sql`SELECT videos FROM experiences WHERE id = ${fixture.listingId}::uuid`
                );
                expect(certificates.rows).toEqual([]);
                expect(content.rows).toEqual([{ videos: null }]);
            } else {
                const content = await getDb().execute(
                    sql`SELECT videos FROM accommodations WHERE id = ${fixture.listingId}::uuid`
                );
                expect(content.rows).toEqual([{ videos: null }]);
            }
        }
    });
});
