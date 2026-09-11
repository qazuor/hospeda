/**
 * packages/service-core/test/services/accommodation/addFeaturedMedia.test.ts
 *
 * HOS-803 — a cover photo must be BORN featured, in one transaction.
 *
 * ## The bug this file pins
 *
 * Uploading a cover used to be two requests: `addMedia` (which creates an
 * ordinary gallery row) followed by `setFeaturedMedia` (which promotes it).
 * The first of those two passes the gallery cap gate — and since HOS-791 that
 * gate counts the gallery ALONE. So a host whose gallery sits exactly at the
 * cap was refused at step 1 and could never reach step 2: the one action
 * HOS-791 declared free of gallery quota was the only one they could not do.
 *
 * `addFeaturedMedia` closes that by creating the row already featured and
 * SOFT-DELETING the previous cover in the SAME transaction.
 *
 * ## The counter-invariant
 *
 * The exemption is only safe because the server guarantees the outcome. The
 * hole in the rejected design (a client-supplied "this one is featured" flag on
 * the ordinary `addMedia`) was that the promised second request could never be
 * required nor verified — send the flag on every upload and the plan cap is
 * gone. Here the row is featured on arrival and the partial unique index allows
 * exactly one, so repetition cannot accumulate exempt rows.
 *
 * The subtler half, and the one these tests exist for: the PREVIOUS cover must
 * not survive. `setFeaturedMedia` demotes it into the gallery, and carrying
 * that onto the UPLOAD path would make every replacement a +1 to the gallery —
 * repeat it and the gallery grows past the cap one swap at a time. Deleting it
 * makes the whole operation quota-neutral: one row in the featured slot, one
 * out of the table, gallery untouched.
 *
 * This covers the UPLOAD path only. Promotion of a photo already in the gallery
 * is unchanged and is asserted as such below.
 *
 * All DB interactions are mocked at the MODEL level (not the Drizzle level) so
 * the `where` filters are visible to assertions — see
 * `apps/api/test/services/photo-limit-gallery-only.guard.test.ts` for why the
 * Drizzle-level fixtures used elsewhere in this directory cannot see them.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockMediaModel = {
    findAll: vi.fn(),
    count: vi.fn(),
    findById: vi.fn(),
    findByAccommodation: vi.fn(),
    findFeatured: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
};

/** Records the order in which the model was written to, across methods. */
const writeLog: string[] = [];

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationMediaModel: vi.fn(function () {
            return mockMediaModel;
        }),
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ __tx: true }))
    };
});

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

// ---------------------------------------------------------------------------

import { getGalleryCap, ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
const NEW_MEDIA_ID = '00000000-0000-4000-8000-0000000000b1';
const PREVIOUS_FEATURED_ID = '00000000-0000-4000-8000-0000000000b2';
const OWNER_ID = '00000000-0000-4000-8000-0000000000ff';

const NOW = new Date('2026-01-15T12:00:00.000Z');

/** The per-entity cap. 50 for accommodations — the invariant that never lifts. */
const ENTITY_CAP = getGalleryCap('accommodation');

const VALID_PAYLOAD = {
    url: 'https://res.cloudinary.com/demo/image/upload/new-cover.jpg',
    publicId: 'hospeda/dev/new-cover',
    moderationState: ModerationStatusEnum.APPROVED
};

function makeMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: NEW_MEDIA_ID,
        accommodationId: ACCOMMODATION_ID,
        url: VALID_PAYLOAD.url,
        publicId: VALID_PAYLOAD.publicId,
        caption: undefined,
        description: undefined,
        alt: undefined,
        attribution: null,
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible' as const,
        isFeatured: true,
        sortOrder: 7,
        archivedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
        ...overrides
    };
}

const ownerActor = {
    id: OWNER_ID,
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

const strangerActor = {
    id: '00000000-0000-4000-8000-0000000000ee',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

function buildService(ownerId: string = OWNER_ID) {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({
            id: ACCOMMODATION_ID,
            ownerId,
            visibility: 'PRIVATE',
            lifecycleState: 'DRAFT'
        })
    };
    return new AccommodationService({} as ServiceConfig, accommodationModel as never);
}

/** Arranges the media model for "the gallery holds `galleryCount` photos". */
function arrangeGallery({
    galleryCount,
    previousFeatured
}: {
    galleryCount: number;
    previousFeatured: boolean;
}) {
    mockMediaModel.count.mockResolvedValue(galleryCount);
    mockMediaModel.findAll.mockResolvedValue({
        items: [{ sortOrder: galleryCount - 1 }],
        total: galleryCount
    });
    mockMediaModel.findFeatured.mockResolvedValue(
        previousFeatured
            ? makeMediaRow({ id: PREVIOUS_FEATURED_ID, isFeatured: true, sortOrder: 0 })
            : null
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    writeLog.length = 0;

    mockMediaModel.count.mockResolvedValue(0);
    mockMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
    mockMediaModel.findFeatured.mockResolvedValue(null);
    mockMediaModel.findById.mockResolvedValue(null);
    mockMediaModel.create.mockImplementation(async (row: Record<string, unknown>) => {
        writeLog.push('create');
        return makeMediaRow(row);
    });
    mockMediaModel.update.mockImplementation(
        async (_where: unknown, patch: Record<string, unknown>) => {
            writeLog.push('update');
            return makeMediaRow(patch);
        }
    );
    mockMediaModel.softDelete.mockImplementation(async () => {
        writeLog.push('softDelete');
        return 1;
    });
});

// ---------------------------------------------------------------------------
// The bug's precondition — documents WHY a dedicated path is needed.
// ---------------------------------------------------------------------------

describe('HOS-803 precondition — the old two-step cannot start when the gallery is full', () => {
    it('addMedia refuses at the entity cap, so no row exists to promote', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await service.addMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        // This is the wall the cover upload hits at step 1 of 2.
        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The regression proper.
// ---------------------------------------------------------------------------

describe('AccommodationService.addFeaturedMedia (HOS-803)', () => {
    it('succeeds with the gallery exactly at the cap — the reported bug', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.media).toBeDefined();
    });

    it('creates the row ALREADY featured — never as a gallery row to promote later', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(mockMediaModel.create).toHaveBeenCalledTimes(1);
        const createdRow = mockMediaModel.create.mock.calls[0]?.[0] as Record<string, unknown>;

        // Read the field directly: `objectContaining` is blind to a missing key,
        // and "missing" is precisely the failure mode being excluded here.
        expect(createdRow.isFeatured).toBe(true);
        expect(createdRow.state).toBe('visible');
        expect(createdRow.accommodationId).toBe(ACCOMMODATION_ID);
        expect(createdRow.url).toBe(VALID_PAYLOAD.url);
    });

    it('soft-deletes the previous cover, stamping the actor', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(mockMediaModel.softDelete).toHaveBeenCalledTimes(1);
        const [where, deletedById] = mockMediaModel.softDelete.mock.calls[0] as [
            Record<string, unknown>,
            string
        ];
        expect(where.id).toBe(PREVIOUS_FEATURED_ID);
        // A soft delete must record WHO — see scripts/check-soft-delete-actor.ts.
        expect(deletedById).toBe(OWNER_ID);

        expect(result.data?.previousFeatured?.id).toBe(PREVIOUS_FEATURED_ID);
    });

    it('deletes the previous cover even when the gallery has room', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        // Unconditional: the old cover never lands in the gallery on this path,
        // however much room there is. Demoting it is what let the gallery grow
        // by one on every replacement.
        expect(mockMediaModel.softDelete).toHaveBeenCalledTimes(1);

        // The single `update` is the flag being cleared as part of the release
        // (HOS-803 C-1) — NOT a demotion. A demotion would leave the row alive;
        // this one is immediately followed by the soft delete.
        expect(mockMediaModel.update).toHaveBeenCalledTimes(1);
        const patch = mockMediaModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.isFeatured).toBe(false);
        expect(patch.state).toBeUndefined();
        expect(writeLog).toEqual(['update', 'softDelete', 'create']);
    });

    it('clears the previous cover BEFORE creating the new one (partial unique index)', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        // Two writes release the old cover before the insert: the flag is
        // cleared, then the row is soft-deleted. `softDelete` alone leaves it
        // flagged (C-1). Inserting first would leave two live featured rows,
        // which `uq_accommodation_media_single_featured` rejects.
        expect(writeLog).toEqual(['update', 'softDelete', 'create']);
    });

    it('touches nothing else when the accommodation has no cover yet', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: false });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(mockMediaModel.softDelete).not.toHaveBeenCalled();
        expect(result.data?.previousFeatured).toBeNull();
        expect(writeLog).toEqual(['create']);
    });

    it('does not count the gallery at all — the swap cannot move it', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        // One row into the featured slot, one out of the table, gallery
        // untouched. There is no cap arithmetic left to get wrong, which is
        // the point of the rule — not an oversight.
        expect(mockMediaModel.count).not.toHaveBeenCalled();
    });

    // ── Authorization ──────────────────────────────────────────────────────

    it('refuses an actor who does not own the accommodation', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 0, previousFeatured: false });

        const result = await service.addFeaturedMedia(strangerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(result.error).toBeDefined();
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for an accommodation that does not exist', async () => {
        const accommodationModel = { findById: vi.fn().mockResolvedValue(null) };
        const service = new AccommodationService({} as ServiceConfig, accommodationModel as never);

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The attack that killed the rejected design.
// ---------------------------------------------------------------------------

describe('HOS-803 — the gallery quota cannot be evaded through the featured path', () => {
    it('never grows the visible gallery, however often the cover is replaced', async () => {
        const service = buildService();

        // Membership, not a counter — the release is TWO writes and only the
        // pair together is quota-neutral. Clearing the flag alone would put the
        // row in the gallery; the soft delete takes it back out. Modelling both
        // is what makes this fail if either half is dropped.
        const gallery = new Set<string>();
        for (let i = 0; i < ENTITY_CAP; i++) gallery.add(`seed-${i}`);
        const deleted = new Set<string>();

        mockMediaModel.count.mockImplementation(async () => gallery.size);
        mockMediaModel.findFeatured.mockResolvedValue(
            makeMediaRow({ id: PREVIOUS_FEATURED_ID, isFeatured: true, sortOrder: 0 })
        );
        mockMediaModel.update.mockImplementation(
            async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
                // A row that loses `isFeatured` and stays alive IS a gallery row.
                if (patch.isFeatured === false && !deleted.has(where.id as string)) {
                    gallery.add(where.id as string);
                }
                return makeMediaRow(patch);
            }
        );
        mockMediaModel.softDelete.mockImplementation(async (where: Record<string, unknown>) => {
            deleted.add(where.id as string);
            gallery.delete(where.id as string);
            return 1;
        });

        for (let i = 0; i < 25; i++) {
            const result = await service.addFeaturedMedia(ownerActor, {
                accommodationId: ACCOMMODATION_ID,
                media: VALID_PAYLOAD
            });
            expect(result.error).toBeUndefined();
            // Inside the loop: a breach on cycle 2 must not be masked by 25.
            expect(gallery.size).toBeLessThanOrEqual(ENTITY_CAP);
        }

        expect(gallery.size).toBe(ENTITY_CAP);
        expect(mockMediaModel.softDelete).toHaveBeenCalledTimes(25);
    });

    it('leaves the deleted cover out of the gallery count the cap reads', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        const deletedId = (mockMediaModel.softDelete.mock.calls[0]?.[0] as Record<string, unknown>)
            .id;
        expect(deletedId).toBe(PREVIOUS_FEATURED_ID);

        // Now ask the cap the same question `addMedia` asks. The filter it
        // builds must exclude soft-deleted rows, or the replaced cover would
        // keep occupying a slot it no longer holds — a cap reported as reached
        // that is not. `addMedia` is the real code path, not a re-derivation.
        mockMediaModel.count.mockClear();
        mockMediaModel.count.mockResolvedValue(ENTITY_CAP - 1);

        await service.addMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        const where = mockMediaModel.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where.deletedAt).toBeNull();
        expect(where.state).toBe('visible');
        expect(where.isFeatured).toBe(false);
    });

    it('accepts a plan allowance that is exactly full', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 15, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD,
            planGalleryCap: 15
        });

        // 15 gallery photos on a 15-photo plan: the swap moves the gallery by
        // zero, so a full allowance is no reason to refuse. This is the exact
        // scenario HOS-803 was reported for.
        expect(result.error).toBeUndefined();
        expect(mockMediaModel.softDelete).toHaveBeenCalledTimes(1);
    });

    it('ignores a plan cap smuggled inside the media payload', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 15, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            // A client that could widen its own cap through the request body
            // would reopen exactly the hole this design closes.
            media: { ...VALID_PAYLOAD, planGalleryCap: 9999 } as never,
            planGalleryCap: 15
        });

        expect(result.error).toBeUndefined();
        const createdRow = mockMediaModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(createdRow.planGalleryCap).toBeUndefined();
    });

    it('refuses outright on a plan that grants no photos at all', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 0, previousFeatured: false });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD,
            planGalleryCap: 0
        });

        expect(result.error?.code).toBe('LIMIT_REACHED');
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The promotion path is a DIFFERENT operation and stays as it was.
// ---------------------------------------------------------------------------

describe('HOS-803 — promoting an existing gallery photo is unchanged', () => {
    it('still demotes the old cover into the gallery instead of deleting it', async () => {
        const service = buildService();
        const targetId = '00000000-0000-4000-8000-0000000000c1';

        mockMediaModel.findFeatured.mockResolvedValue(
            makeMediaRow({ id: PREVIOUS_FEATURED_ID, isFeatured: true, sortOrder: 0 })
        );
        mockMediaModel.findById.mockResolvedValue(
            makeMediaRow({ id: targetId, isFeatured: false, state: 'visible', sortOrder: 2 })
        );

        const result = await service.setFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            mediaId: targetId
        });

        expect(result.error).toBeUndefined();

        // The exchange is quota-neutral on its own: the promoted photo leaves
        // the gallery as the old cover enters it, so there is nothing to
        // delete and the count does not move. Deleting here would destroy a
        // photo the owner never asked to remove.
        expect(mockMediaModel.softDelete).not.toHaveBeenCalled();

        const demote = mockMediaModel.update.mock.calls.find(
            ([where]) => (where as Record<string, unknown>).id === PREVIOUS_FEATURED_ID
        );
        expect(demote).toBeDefined();
        expect((demote?.[1] as Record<string, unknown>).isFeatured).toBe(false);
        expect((demote?.[1] as Record<string, unknown>).state).toBeUndefined();
    });
});
