/**
 * event.media-read.test.ts
 *
 * Unit tests for the event media read-composition helpers (HOS-390).
 *
 * The interesting behavior here is the DELIBERATE divergence from the
 * accommodation/gastronomy molde: because `events.media` JSONB is NOT dropped
 * (videos still live there), falling back to the entity's own `media` on an
 * empty composition would resurrect photos the author just deleted. These tests
 * pin that down — the relational rows are authoritative for photos, and the only
 * preserved case is a `null` media with nothing to compose.
 *
 * No DB is touched: the model is a hand-rolled stub.
 */

import type { Event, EventMedia } from '@repo/schemas';
import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    attachComposedEventMedia,
    attachComposedEventMediaList
} from '../../../src/services/event/event.media-read';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EVENT_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-a000-000000000002';

const BLOB_PHOTO_URL = 'https://cdn.example.com/legacy-blob-photo.jpg';
const VIDEO = { url: 'https://youtube.com/watch?v=abc' };

function makeRow(overrides: Partial<EventMedia> = {}): EventMedia {
    return {
        id: '00000000-0000-4000-a000-00000000000a',
        eventId: EVENT_ID,
        url: 'https://cdn.example.com/row.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as EventMedia;
}

/** A event carrying the pre-HOS-390 photo blob, as an un-backfilled row would. */
function makeEventWithBlob(overrides: Partial<Event> = {}): Event {
    return {
        id: EVENT_ID,
        media: {
            featuredImage: { url: BLOB_PHOTO_URL, moderationState: ModerationStatusEnum.APPROVED },
            gallery: [{ url: BLOB_PHOTO_URL, moderationState: ModerationStatusEnum.APPROVED }]
        },
        ...overrides
    } as unknown as Event;
}

/** Stub model whose `findByEvents` returns the supplied grouping. */
function makeMediaModel(grouped: Map<string, EventMedia[]>) {
    return {
        findByEvents: vi.fn().mockResolvedValue(grouped)
    } as unknown as Parameters<typeof attachComposedEventMedia>[0]['mediaModel'];
}

// ---------------------------------------------------------------------------
// attachComposedEventMedia
// ---------------------------------------------------------------------------

describe('attachComposedEventMedia', () => {
    it('returns null untouched for a single-read miss', async () => {
        const mediaModel = makeMediaModel(new Map());

        const result = await attachComposedEventMedia({ entity: null, mediaModel });

        expect(result).toBeNull();
        expect(mediaModel.findByEvents).not.toHaveBeenCalled();
    });

    it('composes the gallery and featured image from the relational rows', async () => {
        const featured = makeRow({
            id: '00000000-0000-4000-a000-00000000000f',
            url: 'https://cdn.example.com/featured.jpg',
            isFeatured: true
        });
        const second = makeRow({
            id: '00000000-0000-4000-a000-00000000000b',
            url: 'https://cdn.example.com/second.jpg',
            sortOrder: 1
        });
        const first = makeRow({ url: 'https://cdn.example.com/first.jpg', sortOrder: 0 });
        const mediaModel = makeMediaModel(new Map([[EVENT_ID, [second, featured, first]]]));

        const result = await attachComposedEventMedia({
            entity: makeEventWithBlob(),
            mediaModel
        });

        expect(result?.media?.featuredImage?.url).toBe('https://cdn.example.com/featured.jpg');
        expect(result?.media?.gallery?.map((i) => i.url)).toEqual([
            'https://cdn.example.com/first.jpg',
            'https://cdn.example.com/second.jpg'
        ]);
    });

    it('keeps videos, which still live in the JSONB blob', async () => {
        const mediaModel = makeMediaModel(new Map([[EVENT_ID, [makeRow()]]]));
        const entity = makeEventWithBlob({
            media: { videos: [VIDEO] }
        } as unknown as Partial<Event>);

        const result = await attachComposedEventMedia({ entity, mediaModel });

        expect(result?.media?.videos).toEqual([VIDEO]);
        expect(result?.media?.gallery?.[0]?.url).toBe('https://cdn.example.com/row.jpg');
    });

    it('does NOT resurrect blob photos when the event has zero relational rows', async () => {
        // The anti-regression case: an author who deleted every photo (or an event
        // the backfill has not reached) must NOT get the legacy blob gallery back.
        const mediaModel = makeMediaModel(new Map());

        const result = await attachComposedEventMedia({
            entity: makeEventWithBlob(),
            mediaModel
        });

        expect(result?.media?.gallery).toBeUndefined();
        expect(result?.media?.featuredImage).toBeUndefined();
    });

    it('does not let the presence of videos decide whether blob photos survive', async () => {
        // Same zero-row state as above, but WITH videos. Under the molde's
        // `hasContent` fallback these two cases diverge (photos vanish here,
        // come back above); the authoritative rule keeps them identical.
        const mediaModel = makeMediaModel(new Map());
        const entity = makeEventWithBlob({
            media: {
                gallery: [{ url: BLOB_PHOTO_URL, moderationState: ModerationStatusEnum.APPROVED }],
                videos: [VIDEO]
            }
        } as unknown as Partial<Event>);

        const result = await attachComposedEventMedia({ entity, mediaModel });

        expect(result?.media?.gallery).toBeUndefined();
        expect(result?.media?.videos).toEqual([VIDEO]);
    });

    it('preserves a null media rather than drifting it to an empty object', async () => {
        const mediaModel = makeMediaModel(new Map());
        const entity = { id: EVENT_ID, media: null } as unknown as Event;

        const result = await attachComposedEventMedia({ entity, mediaModel });

        expect(result?.media).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// attachComposedEventMediaList
// ---------------------------------------------------------------------------

describe('attachComposedEventMediaList', () => {
    it('returns an empty list without querying', async () => {
        const mediaModel = makeMediaModel(new Map());

        const result = await attachComposedEventMediaList({ items: [], mediaModel });

        expect(result).toEqual([]);
        expect(mediaModel.findByEvents).not.toHaveBeenCalled();
    });

    it('returns an empty array for a nullish item list instead of throwing', async () => {
        // Reachable from a model stub or an error path that yields a result
        // object with no `items` key. Spreading it would raise a TypeError.
        const mediaModel = makeMediaModel(new Map());

        await expect(
            attachComposedEventMediaList({ items: undefined as never, mediaModel })
        ).resolves.toEqual([]);
        expect(mediaModel.findByEvents).not.toHaveBeenCalled();
    });

    it('batches every event into a single query (no N+1)', async () => {
        const mediaModel = makeMediaModel(
            new Map([[EVENT_ID, [makeRow({ url: 'https://cdn.example.com/a.jpg' })]]])
        );
        const items = [
            makeEventWithBlob(),
            makeEventWithBlob({ id: OTHER_EVENT_ID } as Partial<Event>)
        ];

        const result = await attachComposedEventMediaList({ items, mediaModel });

        expect(mediaModel.findByEvents).toHaveBeenCalledTimes(1);
        expect(mediaModel.findByEvents).toHaveBeenCalledWith(
            expect.objectContaining({ eventIds: [EVENT_ID, OTHER_EVENT_ID] })
        );
        // The event WITH rows composes them; the one without gets no photos back.
        expect(result[0]?.media?.gallery?.map((i) => i.url)).toEqual([
            'https://cdn.example.com/a.jpg'
        ]);
        expect(result[1]?.media?.gallery).toBeUndefined();
    });
});
