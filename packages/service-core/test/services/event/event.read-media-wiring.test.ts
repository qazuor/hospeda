/**
 * HOS-390 guard — every event read path must compose media from `event_media`.
 *
 * Twin of `post/post.read-media-wiring.test.ts`; see that file for the full
 * rationale. The short version: the failure mode is silent (photos persist,
 * every write test passes, the photos just never appear), and the three
 * lifecycle hooks are NOT the whole read surface — six public card feeds read
 * the model directly and bypass `_afterList` entirely.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockEventMediaModel = {
    findByEvents: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        EventMediaModel: vi.fn(function () {
            return mockEventMediaModel;
        })
    };
});

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

// ---------------------------------------------------------------------------

import { ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../../src/types';

const EVENT_ID = '00000000-0000-4000-8000-0000000000c1';
const FEATURED_URL = 'https://cdn.example.com/featured.jpg';
const GALLERY_URL = 'https://cdn.example.com/gallery.jpg';

/** Rows as `EventMediaModel.findByEvents` returns them. */
function buildRows() {
    const base = {
        eventId: EVENT_ID,
        moderationState: ModerationStatusEnum.APPROVED,
        caption: null,
        description: null,
        alt: null,
        publicId: null,
        attribution: null,
        archivedAt: null,
        state: 'visible' as const
    };
    return [
        { ...base, id: 'row-1', url: FEATURED_URL, isFeatured: true, sortOrder: 0 },
        { ...base, id: 'row-2', url: GALLERY_URL, isFeatured: false, sortOrder: 1 }
    ];
}

/**
 * An event whose JSONB media is EMPTY — the post-cutover shape. If a read path
 * is unwired, the composed result keeps this empty value and the assertions
 * fail, which is precisely the regression being guarded.
 */
function buildEvent() {
    return { id: EVENT_ID, media: {} } as never;
}

const actor: Actor = {
    id: 'actor-1',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.EVENT_VIEW_ALL, PermissionEnum.EVENT_UPDATE]
};
const ctx = {} as ServiceContext;

type ComposedMedia = {
    featuredImage?: { url?: string };
    gallery?: { url?: string }[];
};

type ReadHooks = {
    _afterGetByField: (e: unknown, a: unknown, c: unknown) => Promise<{ media?: unknown }>;
    _afterList: (r: unknown, a: unknown, c: unknown) => Promise<{ items: { media?: unknown }[] }>;
    _afterSearch: (r: unknown, a: unknown, c: unknown) => Promise<{ items: { media?: unknown }[] }>;
};

function makeService() {
    const model = {
        findAll: vi.fn().mockResolvedValue({ items: [buildEvent()], total: 1 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [buildEvent()], total: 1 })
    };
    return new EventService({ model } as unknown as ServiceConfig & { model?: never });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockEventMediaModel.findByEvents.mockResolvedValue(new Map([[EVENT_ID, buildRows()]]));
});

// ---------------------------------------------------------------------------
// The three lifecycle chokepoints
// ---------------------------------------------------------------------------

describe('event lifecycle hooks compose media from the relational table', () => {
    it('_afterGetByField composes the single-entity read', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        const result = await hooks._afterGetByField(buildEvent(), actor, ctx);

        const media = result?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
        expect(media?.gallery?.[0]?.url).toBe(GALLERY_URL);
    });

    it('_afterList composes every item', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        const result = await hooks._afterList({ items: [buildEvent()] }, actor, ctx);

        expect((result.items[0]?.media as ComposedMedia)?.featuredImage?.url).toBe(FEATURED_URL);
    });

    it('_afterSearch composes every item', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        const result = await hooks._afterSearch({ items: [buildEvent()] }, actor, ctx);

        expect((result.items[0]?.media as ComposedMedia)?.featuredImage?.url).toBe(FEATURED_URL);
    });

    it('batches the list read into one query rather than one per item', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        await hooks._afterList(
            { items: [buildEvent(), { id: 'other-id', media: {} }] },
            actor,
            ctx
        );

        expect(mockEventMediaModel.findByEvents).toHaveBeenCalledTimes(1);
    });

    it('leaves a null single-entity read alone', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        await expect(hooks._afterGetByField(null, actor, ctx)).resolves.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The card feeds that bypass _afterList
// ---------------------------------------------------------------------------

describe('event card feeds compose media even though they bypass _afterList', () => {
    /**
     * Each entry is a public method that reads the model directly and builds its
     * own paginated result. Adding a new one WITHOUT composing is the regression
     * this table is here to catch — add the method here when you add it to the
     * service.
     */
    const feeds = [
        {
            name: 'getByAuthor',
            call: (s: EventService) =>
                s.getByAuthor(actor, {
                    authorId: '00000000-0000-4000-8000-0000000000a1'
                } as never)
        },
        {
            name: 'getByLocation',
            call: (s: EventService) =>
                s.getByLocation(actor, {
                    locationId: '00000000-0000-4000-8000-0000000000a2'
                } as never)
        },
        {
            name: 'getByOrganizer',
            call: (s: EventService) =>
                s.getByOrganizer(actor, {
                    organizerId: '00000000-0000-4000-8000-0000000000a3'
                } as never)
        },
        { name: 'getUpcoming', call: (s: EventService) => s.getUpcoming(actor, {} as never) },
        {
            name: 'getByCategory',
            call: (s: EventService) => s.getByCategory(actor, { category: 'MUSIC' } as never)
        },
        { name: 'getFreeEvents', call: (s: EventService) => s.getFreeEvents(actor) }
    ] as const;

    it.each(feeds)('$name returns events with media composed from rows', async ({ call }) => {
        const service = makeService();

        const result = await call(service);

        expect(result.error).toBeUndefined();
        const first = (result.data as { items?: { media?: unknown }[] } | undefined)?.items?.[0];
        const media = first?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
        expect(media?.gallery?.[0]?.url).toBe(GALLERY_URL);
    });
});
