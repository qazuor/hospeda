/**
 * HOS-390 guard — every post read path must compose media from `post_media`.
 *
 * This exists because the wiring is easy to leave half-done, and the failure is
 * completely silent: photos persist into `post_media`, every write test passes,
 * and the photos simply never appear on whichever surface was missed. Nothing
 * errors. Commerce hit exactly this (see `commerce/read-media-wiring.test.ts`),
 * where the composition helpers were written, tested and exported while nothing
 * called them.
 *
 * Posts have a second, sharper version of the problem: the three lifecycle
 * hooks are NOT the whole read surface. Six public card feeds (`getNews`,
 * `getFeatured`, `getByCategory` and the three `getByRelated*`) read the model
 * directly and return a bare `Post[]`, bypassing `_afterList` entirely. Wiring
 * only the hooks would ship a site where the post detail page has photos and
 * every card feed that links to it does not.
 *
 * So this file asserts BOTH: the three chokepoints, and each card feed by name.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockPostMediaModel = {
    findByPosts: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        PostMediaModel: vi.fn(function () {
            return mockPostMediaModel;
        }),
        REntityTagModel: vi.fn(function () {
            return { findEntityIdsByTags: vi.fn().mockResolvedValue([]) };
        })
    };
});

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

// ---------------------------------------------------------------------------

import { ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../../src/types';

const POST_ID = '00000000-0000-4000-8000-0000000000c1';
const FEATURED_URL = 'https://cdn.example.com/featured.jpg';
const GALLERY_URL = 'https://cdn.example.com/gallery.jpg';

/** Rows as `PostMediaModel.findByPosts` returns them. */
function buildRows() {
    const base = {
        postId: POST_ID,
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
 * A post whose JSONB media is EMPTY — the post-cutover shape. If a read path is
 * unwired, the composed result keeps this empty value and the assertions fail,
 * which is precisely the regression being guarded.
 */
function buildPost() {
    return { id: POST_ID, media: {} } as never;
}

const actor: Actor = {
    id: 'actor-1',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.POST_VIEW_ALL, PermissionEnum.POST_UPDATE]
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

function makeService(modelOverrides: Record<string, unknown> = {}) {
    const model = {
        findAll: vi.fn().mockResolvedValue({ items: [buildPost()], total: 1 }),
        ...modelOverrides
    };
    return new PostService({} as ServiceConfig, model as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockPostMediaModel.findByPosts.mockResolvedValue(new Map([[POST_ID, buildRows()]]));
});

// ---------------------------------------------------------------------------
// The three lifecycle chokepoints
// ---------------------------------------------------------------------------

describe('post lifecycle hooks compose media from the relational table', () => {
    it('_afterGetByField composes the single-entity read', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        const result = await hooks._afterGetByField(buildPost(), actor, ctx);

        const media = result?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
        expect(media?.gallery?.[0]?.url).toBe(GALLERY_URL);
    });

    it('_afterList composes every item', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        const result = await hooks._afterList({ items: [buildPost()] }, actor, ctx);

        expect((result.items[0]?.media as ComposedMedia)?.featuredImage?.url).toBe(FEATURED_URL);
    });

    it('_afterSearch composes every item', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        const result = await hooks._afterSearch({ items: [buildPost()] }, actor, ctx);

        expect((result.items[0]?.media as ComposedMedia)?.featuredImage?.url).toBe(FEATURED_URL);
    });

    it('batches the list read into one query rather than one per item', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        await hooks._afterList({ items: [buildPost(), { id: 'other-id', media: {} }] }, actor, ctx);

        expect(mockPostMediaModel.findByPosts).toHaveBeenCalledTimes(1);
    });

    it('leaves a null single-entity read alone', async () => {
        const hooks = makeService() as unknown as ReadHooks;

        await expect(hooks._afterGetByField(null, actor, ctx)).resolves.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// The card feeds that bypass _afterList
// ---------------------------------------------------------------------------

describe('post card feeds compose media even though they bypass _afterList', () => {
    /**
     * Each entry is a public method that reads the model directly and returns a
     * bare `Post[]`. Adding a new one WITHOUT composing is the regression this
     * table is here to catch — add the method here when you add it to the
     * service.
     */
    const feeds = [
        { name: 'getNews', call: (s: PostService) => s.getNews(actor, {}) },
        { name: 'getFeatured', call: (s: PostService) => s.getFeatured(actor, {}) },
        {
            name: 'getByCategory',
            call: (s: PostService) => s.getByCategory(actor, { category: 'GENERAL' } as never)
        },
        {
            name: 'getByRelatedAccommodation',
            call: (s: PostService) =>
                s.getByRelatedAccommodation(actor, {
                    accommodationId: '00000000-0000-4000-8000-0000000000a1'
                } as never)
        },
        {
            name: 'getByRelatedDestination',
            call: (s: PostService) =>
                s.getByRelatedDestination(actor, {
                    destinationId: '00000000-0000-4000-8000-0000000000a2'
                } as never)
        },
        {
            name: 'getByRelatedEvent',
            call: (s: PostService) =>
                s.getByRelatedEvent(actor, {
                    eventId: '00000000-0000-4000-8000-0000000000a3'
                } as never)
        }
    ] as const;

    it.each(feeds)('$name returns posts with media composed from rows', async ({ call }) => {
        const service = makeService();

        const result = await call(service);

        expect(result.error).toBeUndefined();
        const first = (result.data as { media?: unknown }[] | undefined)?.[0];
        const media = first?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
        expect(media?.gallery?.[0]?.url).toBe(GALLERY_URL);
    });
});
