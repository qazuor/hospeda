/**
 * Regression tests for the post/event seeders' `postProcess` media hooks
 * (HOS-1034).
 *
 * The hooks read the new row's id from the value `createSeedFactory` hands
 * them. They used to read `result.id`, while the factory hands over the
 * service-result envelope `{ data: { id } }` — so every hook call returned
 * early and a fresh seed wrote the photos to the JSONB only, with no
 * `post_media` / `event_media` row. The public read path composes photos from
 * those tables, so every example post and event rendered with no image.
 *
 * These tests run the hooks THROUGH the real factory (with stub model/service,
 * mirroring `seedFactory-deterministicId.test.ts`) rather than calling them with
 * a hand-built result, because a hand-built result is exactly the assumption
 * that was wrong. Only the media models are mocked.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaModels = vi.hoisted(() => {
    const postRows: Record<string, unknown>[] = [];
    const eventRows: Record<string, unknown>[] = [];

    class FakePostMediaModel {
        async findByPost(): Promise<{ total: number }> {
            return { total: 0 };
        }
        async create(row: Record<string, unknown>): Promise<Record<string, unknown>> {
            postRows.push(row);
            return row;
        }
    }

    class FakeEventMediaModel {
        async findByEvent(): Promise<{ total: number }> {
            return { total: 0 };
        }
        async create(row: Record<string, unknown>): Promise<Record<string, unknown>> {
            eventRows.push(row);
            return row;
        }
    }

    return { postRows, eventRows, FakePostMediaModel, FakeEventMediaModel };
});

// The SOURCE path, not `@repo/db`: `vite-tsconfig-paths` maps `@repo/db` to
// `../db/src/index.ts` for files under `src/` (tsconfig `paths`), while this
// test file — outside that tsconfig's `include` — resolves the bare specifier
// to the package's `dist`. Mocking `@repo/db` here would replace a module the
// seeder never loads. If this ever misses, the hooks hit the real model and the
// tests fail with "Database not initialized" — loud, never a false green.
vi.mock('../../../db/src/index.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    PostMediaModel: mediaModels.FakePostMediaModel,
    EventMediaModel: mediaModels.FakeEventMediaModel
}));

import { postProcessEvent } from '../../src/example/events.seed.js';
import { postProcessPost } from '../../src/example/posts.seed.js';
import { IdMapper } from '../../src/utils/idMapper.js';
import { createImageProcessingCounters, type SeedContext } from '../../src/utils/seedContext.js';
import { createSeedFactory } from '../../src/utils/seedFactory.js';

const EXPLICIT_ID = '3f9a1c2e-0000-5000-8000-0000000010a4';

const MEDIA = {
    featuredImage: { url: 'https://cdn.example.test/featured.jpg' },
    gallery: [{ url: 'https://cdn.example.test/g1.jpg' }]
};

/** Stub service: never reached on the deterministic-id path. */
class StubService {
    async create(): Promise<{ data: { id: string } }> {
        return { data: { id: 'random-uuid-from-db' } };
    }
}

/** Stub model mirroring `BaseModelImpl.create()`: persists the id it was given. */
class StubModel {
    async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
        return { ...data };
    }
}

function buildContext(): SeedContext {
    return {
        continueOnError: false,
        validateManifests: false,
        resetDatabase: false,
        exclude: [],
        actor: { id: 'actor-1', role: 'super_admin', permissions: [] } as unknown as Actor,
        idMapper: new IdMapper(true),
        seedSource: 'example',
        imageCounters: createImageProcessingCounters()
    } as SeedContext;
}

/**
 * Runs one fixture through a real `createSeedFactory` wired to `postProcess`.
 * The normalizer drops `media` so the factory's own image pipeline stays out of
 * the test; the hook reads `media` from the RAW fixture item, as in production.
 */
async function runFactory(postProcess: (result: unknown, item: unknown) => Promise<void>) {
    const folder = mkdtempSync(join(tmpdir(), 'seed-content-media-hook-'));
    writeFileSync(
        join(folder, 'item.json'),
        JSON.stringify({ id: 'fixture-1', title: 'Fixture', name: 'Fixture', media: MEDIA })
    );

    const seed = createSeedFactory({
        entityName: 'TestContent',
        serviceClass: StubService,
        folder,
        files: ['item.json'],
        normalizer: (item) => {
            const { media: _media, ...rest } = item as Record<string, unknown>;
            return rest;
        },
        postProcess,
        deterministicId: { modelClass: StubModel, getId: () => EXPLICIT_ID }
    });

    await seed(buildContext());
}

describe('example content seeders — postProcess media hooks (HOS-1034)', () => {
    beforeEach(() => {
        mediaModels.postRows.length = 0;
        mediaModels.eventRows.length = 0;
    });

    it('should write post_media rows for the post the factory just created', async () => {
        // Act
        await runFactory(postProcessPost);

        // Assert
        expect(mediaModels.postRows.map((row) => row.postId)).toEqual([EXPLICIT_ID, EXPLICIT_ID]);
        expect(mediaModels.postRows[0]).toMatchObject({
            url: 'https://cdn.example.test/featured.jpg',
            isFeatured: true,
            sortOrder: 0
        });
    });

    it('should write event_media rows for the event the factory just created', async () => {
        // Act
        await runFactory(postProcessEvent);

        // Assert
        expect(mediaModels.eventRows.map((row) => row.eventId)).toEqual([EXPLICIT_ID, EXPLICIT_ID]);
    });

    it('should fail loudly instead of skipping when the result carries no id', async () => {
        // The old silent `return` is what let every fresh seed lose its photos.
        await expect(postProcessPost({ id: 'bare-row' }, { media: MEDIA })).rejects.toThrow(
            /no created id/
        );
        await expect(postProcessEvent(null, { media: MEDIA })).rejects.toThrow(/no created id/);
        expect(mediaModels.postRows).toHaveLength(0);
        expect(mediaModels.eventRows).toHaveLength(0);
    });
});
