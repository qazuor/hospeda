/**
 * Regression tests for the read-side videos source (HOS-372).
 *
 * The `media` JSONB column was dropped from `accommodations`; videos moved to a
 * dedicated `videos` column on the entity. `attachComposedMedia*` must therefore
 * source videos from `entity.videos`, NOT from `entity.media.videos` — the latter
 * is always `undefined` post-drop, which silently strips every video from the
 * composed response.
 *
 * The existing `videos-field-exposure.test.ts` guard does NOT cover this: it
 * asserts the SCHEMA exposes the field, not that composition populates it.
 *
 * @module test/services/accommodation/accommodation.media-read
 */

import type { AccommodationMediaModel } from '@repo/db';
import type { Accommodation, AccommodationMedia, Video } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    attachComposedMedia,
    attachComposedMediaList
} from '../../../src/services/accommodation/accommodation.media-read';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVideo(url: string): Video {
    return { url, moderationState: ModerationStatusEnum.APPROVED };
}

/**
 * Builds a relational `accommodation_media` row with sensible defaults: a
 * `visible`, non-featured photo at `sortOrder` 0 unless overridden.
 */
function makeRow(overrides: Partial<AccommodationMedia> = {}): AccommodationMedia {
    return {
        url: 'https://cdn.example.com/photo.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    } as unknown as AccommodationMedia;
}

/**
 * Minimal accommodation carrying only what the read helpers touch: `id` and the
 * `videos` column. `media` is deliberately absent — the column no longer exists,
 * so a real DB row never carries it.
 */
function makeEntity(id: string, videos?: Video[]): Accommodation {
    return { id, videos } as unknown as Accommodation;
}

/**
 * Stubs the batch finder so the helpers resolve rows without touching a DB.
 */
function makeMediaModel(rowsById: Record<string, AccommodationMedia[]>): AccommodationMediaModel {
    return {
        findByAccommodations: vi.fn(
            async ({ accommodationIds }: { accommodationIds: string[] }) => {
                const grouped = new Map<string, AccommodationMedia[]>();
                for (const id of accommodationIds) {
                    grouped.set(id, rowsById[id] ?? []);
                }
                return grouped;
            }
        )
    } as unknown as AccommodationMediaModel;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attachComposedMedia — videos source (HOS-372 regression)', () => {
    it('composes videos from the entity videos column alongside relational photos', async () => {
        const video = makeVideo('https://youtu.be/abc123');
        const entity = makeEntity('acc-1', [video]);
        const mediaModel = makeMediaModel({
            'acc-1': [makeRow({ isFeatured: true, url: 'https://cdn.example.com/feat.jpg' })]
        });

        const result = await attachComposedMedia({ entity, mediaModel });

        expect(result?.media?.featuredImage?.url).toBe('https://cdn.example.com/feat.jpg');
        expect(result?.media?.videos).toEqual([video]);
    });

    it('composes videos even when the listing has no photo rows at all', async () => {
        // Videos-only listing: without a photo row the composed object would be
        // empty and the helper would fall back to the (nonexistent) media value,
        // dropping the videos entirely.
        const video = makeVideo('https://vimeo.com/999');
        const entity = makeEntity('acc-2', [video]);
        const mediaModel = makeMediaModel({});

        const result = await attachComposedMedia({ entity, mediaModel });

        expect(result?.media?.videos).toEqual([video]);
    });

    it('omits videos when the column is empty', async () => {
        const entity = makeEntity('acc-3', []);
        const mediaModel = makeMediaModel({
            'acc-3': [makeRow({ url: 'https://cdn.example.com/g.jpg' })]
        });

        const result = await attachComposedMedia({ entity, mediaModel });

        expect(result?.media?.videos).toBeUndefined();
        expect(result?.media?.gallery).toHaveLength(1);
    });
});

describe('attachComposedMediaList — videos source (HOS-372 regression)', () => {
    it('composes each listing videos from its own videos column', async () => {
        const videoA = makeVideo('https://youtu.be/aaa');
        const videoB = makeVideo('https://youtu.be/bbb');
        const items = [makeEntity('acc-a', [videoA]), makeEntity('acc-b', [videoB])];
        const mediaModel = makeMediaModel({
            'acc-a': [makeRow({ isFeatured: true })],
            'acc-b': [makeRow({ isFeatured: true })]
        });

        const [a, b] = await attachComposedMediaList({ items, mediaModel });

        expect(a?.media?.videos).toEqual([videoA]);
        expect(b?.media?.videos).toEqual([videoB]);
    });
});
