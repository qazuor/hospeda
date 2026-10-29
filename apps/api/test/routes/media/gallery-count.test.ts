/**
 * HOS-372 — `resolveVisibleGalleryCount` must read each entity type's photo
 * count from whichever store actually owns it.
 *
 * This resolver exists because the gallery cap used to be enforced by two
 * independent copies of the same check (protected upload + admin upload) that
 * had already drifted: the admin copy counted relational rows for
 * accommodations while the protected copy still read the JSONB blob for every
 * type. A duplicated limit check fails OPEN when someone updates one side only
 * — the cap silently stops applying instead of breaking loudly.
 *
 * Venue and experience verticals had ZERO cap coverage before this file.
 *
 * Note on why counting the JSONB would be wrong for venue and experience: once photos live
 * in `venue_media` / `experience_media`, `media.gallery` stops being
 * written and eventually the column is dropped — so a JSONB-based count reads 0
 * forever, and the cap never fires no matter how many photos are uploaded.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    accommodationMediaModel,
    venueMediaModel,
    experienceMediaModel,
    postMediaModel,
    eventMediaModel
} = vi.hoisted(() => ({
    accommodationMediaModel: { findByAccommodation: vi.fn() },
    venueMediaModel: { findByVenue: vi.fn() },
    experienceMediaModel: { findByExperience: vi.fn() },
    postMediaModel: { count: vi.fn() },
    eventMediaModel: { count: vi.fn() }
}));

vi.mock('@repo/db', () => ({
    accommodationMediaModel,
    venueMediaModel,
    experienceMediaModel,
    postMediaModel,
    eventMediaModel
}));

import { resolveVisibleGalleryCount } from '../../../src/routes/media/gallery-count';

const ENTITY_ID = '00000000-0000-4000-8000-000000000001';

/**
 * An entity whose JSONB blob claims a big gallery. Any relational-backed type
 * must IGNORE this — if a test reads 3 for those, the resolver fell back to the
 * blob.
 */
const entityWithJsonbGallery = {
    media: { gallery: [{ url: 'a' }, { url: 'b' }, { url: 'c' }] }
};

describe('resolveVisibleGalleryCount (HOS-372)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        accommodationMediaModel.findByAccommodation.mockResolvedValue({ items: [], total: 7 });
        venueMediaModel.findByVenue.mockResolvedValue({ items: [], total: 5 });
        experienceMediaModel.findByExperience.mockResolvedValue({ items: [], total: 4 });
        postMediaModel.count.mockResolvedValue(6);
        eventMediaModel.count.mockResolvedValue(2);
    });

    it('TEST:1819:6 AC:1:3 resolves venue gallery count through venue media', async () => {
        const count = await resolveVisibleGalleryCount({
            entityType: 'venue',
            entityId: ENTITY_ID,
            entity: entityWithJsonbGallery
        });

        expect(count).toBe(5);
        expect(venueMediaModel.findByVenue).toHaveBeenCalledWith({
            venueId: ENTITY_ID,
            state: 'visible',
            isFeatured: false
        });
    });

    it('counts venue photos from venue_media, not from the JSONB blob', async () => {
        const count = await resolveVisibleGalleryCount({
            entityType: 'venue',
            entityId: ENTITY_ID,
            entity: entityWithJsonbGallery
        });

        expect(count).toBe(5);
        // Exact equality, NOT objectContaining: a partial matcher stays green
        // when a filter is dropped, which is precisely the failure this asserts.
        expect(venueMediaModel.findByVenue).toHaveBeenCalledWith({
            venueId: ENTITY_ID,
            state: 'visible',
            isFeatured: false
        });
    });

    it('counts experience photos from experience_media, not from the JSONB blob', async () => {
        const count = await resolveVisibleGalleryCount({
            entityType: 'experience',
            entityId: ENTITY_ID,
            entity: entityWithJsonbGallery
        });

        expect(count).toBe(4);
        expect(experienceMediaModel.findByExperience).toHaveBeenCalledWith({
            experienceId: ENTITY_ID,
            state: 'visible',
            isFeatured: false
        });
    });

    it('counts accommodation photos from accommodation_media', async () => {
        const count = await resolveVisibleGalleryCount({
            entityType: 'accommodation',
            entityId: ENTITY_ID,
            entity: entityWithJsonbGallery
        });

        expect(count).toBe(7);
        expect(accommodationMediaModel.findByAccommodation).toHaveBeenCalledWith({
            accommodationId: ENTITY_ID,
            state: 'visible',
            isFeatured: false
        });
    });

    // HOS-791 ------------------------------------------------------------
    it.each([
        ['accommodation', () => accommodationMediaModel.findByAccommodation],
        ['venue', () => venueMediaModel.findByVenue],
        ['experience', () => experienceMediaModel.findByExperience]
    ])('excludes the featured image from the %s count (HOS-791)', async (entityType, getMock) => {
        // The featured image is not a gallery item. Counting it charged the
        // gallery a slot it never used, so an owner's gallery closed one
        // photo early while the system reported the cap as reached.
        //
        // This is the same rule the JSONB branch below has always followed:
        // `media.gallery` is a SIBLING of `media.featuredImage`, never a
        // container for it. Before HOS-791 the two branches of this one
        // function disagreed about what "gallery count" meant.
        await resolveVisibleGalleryCount({ entityType, entityId: ENTITY_ID, entity: {} });

        const call = getMock().mock.calls[0]?.[0];
        expect(call?.isFeatured).toBe(false);
    });

    it('excludes archived rows by asking only for visible ones', async () => {
        // An archived photo occupies no gallery slot; counting it would cap an
        // owner below their real allowance.
        await resolveVisibleGalleryCount({
            entityType: 'venue',
            entityId: ENTITY_ID,
            entity: {}
        });

        const call = venueMediaModel.findByVenue.mock.calls[0]?.[0];
        expect(call?.state).toBe('visible');
    });

    for (const entityType of ['destination']) {
        it(`still reads the JSONB blob for ${entityType}, which never migrated`, async () => {
            const count = await resolveVisibleGalleryCount({
                entityType,
                entityId: ENTITY_ID,
                entity: entityWithJsonbGallery
            });

            expect(count).toBe(3);
            expect(venueMediaModel.findByVenue).not.toHaveBeenCalled();
            expect(accommodationMediaModel.findByAccommodation).not.toHaveBeenCalled();
        });
    }

    // HOS-1164: the composed `media.gallery` on a service-loaded entity only holds
    // APPROVED rows (composeListingMedia moderation gate), while the register
    // path (`addPostMedia`/`addEventMedia`) counts rows in EVERY moderation
    // state. Counting the composed blob here let a caller who had registered 15
    // PENDING rows keep uploading to Cloudinary. Both paths must count the rows.
    it('counts post photos from post_media rows, ignoring the composed entity', async () => {
        const count = await resolveVisibleGalleryCount({
            entityType: 'post',
            entityId: ENTITY_ID,
            entity: entityWithJsonbGallery
        });

        expect(count).toBe(6);
        expect(postMediaModel.count).toHaveBeenCalledWith({
            postId: ENTITY_ID,
            state: 'visible',
            isFeatured: false,
            deletedAt: null
        });
    });

    it('counts event photos from event_media rows, ignoring the composed entity', async () => {
        const count = await resolveVisibleGalleryCount({
            entityType: 'event',
            entityId: ENTITY_ID,
            entity: entityWithJsonbGallery
        });

        expect(count).toBe(2);
        expect(eventMediaModel.count).toHaveBeenCalledWith({
            eventId: ENTITY_ID,
            state: 'visible',
            isFeatured: false,
            deletedAt: null
        });
    });

    it('treats a missing media object as zero rather than throwing', async () => {
        expect(
            await resolveVisibleGalleryCount({
                entityType: 'destination',
                entityId: ENTITY_ID,
                entity: {}
            })
        ).toBe(0);

        expect(
            await resolveVisibleGalleryCount({
                entityType: 'destination',
                entityId: ENTITY_ID,
                entity: null
            })
        ).toBe(0);
    });
});
