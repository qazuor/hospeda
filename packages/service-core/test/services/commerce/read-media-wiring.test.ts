/**
 * HOS-372 guard — commerce read paths must compose media from the relational
 * tables.
 *
 * This exists because the wiring was missing once already. The composition
 * helpers (`attachComposedGastronomyMedia` and friends) were written, tested and
 * exported from the service barrels, while NOTHING called them: neither
 * `GastronomyService` nor `ExperienceService` defined `_afterGetByField` /
 * `_afterList` / `_afterSearch` at all.
 *
 * That failure mode is completely silent. Photos persist correctly into
 * `gastronomy_media` / `experience_media`, every write test passes, and the
 * photos simply never appear — not on the public page, not on the listing card,
 * not in the editor on reload. Nothing errors.
 *
 * So these tests assert the hooks are wired AND that they actually rebuild the
 * media shape from rows, per vertical, on all three read chokepoints.
 */
import { ModerationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { ServiceConfig, ServiceContext } from '../../../src/types';

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

const LISTING_ID = '00000000-0000-4000-8000-0000000000c1';
const FEATURED_URL = 'https://cdn.example.com/featured.jpg';
const GALLERY_URL = 'https://cdn.example.com/gallery.jpg';

/** Rows as the relational media model returns them. */
function buildRows(fkField: 'gastronomyId' | 'experienceId') {
    const base = {
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
        {
            ...base,
            id: 'row-1',
            [fkField]: LISTING_ID,
            url: FEATURED_URL,
            isFeatured: true,
            sortOrder: 0
        },
        {
            ...base,
            id: 'row-2',
            [fkField]: LISTING_ID,
            url: GALLERY_URL,
            isFeatured: false,
            sortOrder: 1
        }
    ];
}

/**
 * An entity whose JSONB media is EMPTY — the post-cutover shape. If a hook is
 * unwired, the composed result keeps this empty value and the assertions fail,
 * which is precisely the regression being guarded.
 */
function buildEntity() {
    return { id: LISTING_ID, media: {}, videos: [] } as never;
}

const actor = { id: 'actor-1', roles: [], permissions: [] } as never;
const ctx = {} as ServiceContext;

type ReadHooks = {
    _afterGetByField: (e: unknown, a: unknown, c: unknown) => Promise<{ media?: unknown }>;
    _afterList: (r: unknown, a: unknown, c: unknown) => Promise<{ items: { media?: unknown }[] }>;
    _afterSearch: (r: unknown, a: unknown, c: unknown) => Promise<{ items: { media?: unknown }[] }>;
};

type ComposedMedia = {
    featuredImage?: { url?: string };
    gallery?: { url?: string }[];
};

describe.each([
    {
        vertical: 'gastronomy',
        fk: 'gastronomyId' as const,
        finder: 'findByGastronomies' as const,
        build: (media: Record<string, unknown>) =>
            new GastronomyService({} as ServiceConfig, media as never)
    },
    {
        vertical: 'experience',
        fk: 'experienceId' as const,
        finder: 'findByExperiences' as const,
        build: (media: Record<string, unknown>) =>
            new ExperienceService({} as ServiceConfig, media as never)
    }
])('$vertical read paths compose media from the relational table', ({ fk, finder, build }) => {
    let mediaModel: Record<string, ReturnType<typeof vi.fn>>;
    let hooks: ReadHooks;

    beforeEach(() => {
        vi.clearAllMocks();
        mediaModel = {
            [finder]: vi.fn().mockResolvedValue(new Map([[LISTING_ID, buildRows(fk)]]))
        };
        hooks = build(mediaModel) as unknown as ReadHooks;
    });

    it('_afterGetByField composes the single-entity read', async () => {
        const result = await hooks._afterGetByField(buildEntity(), actor, ctx);

        const media = result?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
        expect(media?.gallery?.[0]?.url).toBe(GALLERY_URL);
    });

    it('_afterList composes every item', async () => {
        const result = await hooks._afterList({ items: [buildEntity()] }, actor, ctx);

        const media = result.items[0]?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
    });

    it('_afterSearch composes every item', async () => {
        const result = await hooks._afterSearch({ items: [buildEntity()] }, actor, ctx);

        const media = result.items[0]?.media as ComposedMedia;
        expect(media?.featuredImage?.url).toBe(FEATURED_URL);
    });

    it('batches the list read into one query rather than one per item', async () => {
        const second = { id: 'other-id', media: {}, videos: [] };
        await hooks._afterList({ items: [buildEntity(), second] }, actor, ctx);

        expect(mediaModel[finder]).toHaveBeenCalledTimes(1);
    });

    it('leaves a null single-entity read alone', async () => {
        await expect(hooks._afterGetByField(null, actor, ctx)).resolves.toBeNull();
    });
});
