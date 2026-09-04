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
 * disposing of the previous cover in the SAME transaction.
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
 * The subtler half, and the one these tests exist for: the PREVIOUS cover does
 * not vanish. `setFeaturedMedia` demotes it into the gallery, which is a +1 to
 * the gallery per replacement — repeat that and the gallery grows past the cap
 * one cover-swap at a time. So the primitive demotes only while the gallery has
 * room and archives otherwise, which keeps the post-condition
 * `visible gallery <= effective cap` true no matter how often it is called.
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
            writeLog.push(patch.state === 'archived' ? 'archive' : 'demote');
            return makeMediaRow(patch);
        }
    );
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

    it('archives the previous cover when the gallery has no room for it', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(mockMediaModel.update).toHaveBeenCalledTimes(1);
        const [where, patch] = mockMediaModel.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(where.id).toBe(PREVIOUS_FEATURED_ID);
        expect(patch.isFeatured).toBe(false);
        expect(patch.state).toBe('archived');

        expect(result.data?.previousFeatured?.id).toBe(PREVIOUS_FEATURED_ID);
        expect(result.data?.previousFeatured?.disposition).toBe('archived');
    });

    it('demotes the previous cover into the gallery when there IS room', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        const [where, patch] = mockMediaModel.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(where.id).toBe(PREVIOUS_FEATURED_ID);
        expect(patch.isFeatured).toBe(false);
        expect(patch.state).toBeUndefined();

        expect(result.data?.previousFeatured?.disposition).toBe('demoted');
    });

    it('clears the previous cover BEFORE creating the new one (partial unique index)', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        // Setting the new row first would transiently leave two featured rows,
        // which `uq_accommodation_media_single_featured` rejects.
        expect(writeLog).toEqual(['demote', 'create']);
    });

    it('touches nothing else when the accommodation has no cover yet', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: false });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(mockMediaModel.update).not.toHaveBeenCalled();
        expect(result.data?.previousFeatured).toBeNull();
        expect(writeLog).toEqual(['create']);
    });

    it('measures the gallery alone — the featured row is excluded from the count (HOS-791)', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 3, previousFeatured: true });

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD
        });

        expect(mockMediaModel.count).toHaveBeenCalledTimes(1);
        const where = mockMediaModel.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where.isFeatured).toBe(false);
        expect(where.state).toBe('visible');
        expect(where.accommodationId).toBe(ACCOMMODATION_ID);
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
    it('never leaves more visible gallery rows than the cap, however often it is called', async () => {
        const service = buildService();

        // The DB is simulated as a counter: rows demoted into the gallery raise
        // it, rows archived do not. Starting one below the cap so the first
        // replacement demotes and every later one must archive.
        let galleryCount = ENTITY_CAP - 1;
        mockMediaModel.count.mockImplementation(async () => galleryCount);
        mockMediaModel.findFeatured.mockResolvedValue(
            makeMediaRow({ id: PREVIOUS_FEATURED_ID, isFeatured: true, sortOrder: 0 })
        );
        mockMediaModel.update.mockImplementation(
            async (_where: unknown, patch: Record<string, unknown>) => {
                if (patch.state === 'archived') {
                    // Archived rows leave the visible gallery — no growth.
                } else {
                    galleryCount += 1;
                }
                return makeMediaRow(patch);
            }
        );

        for (let i = 0; i < 25; i++) {
            const result = await service.addFeaturedMedia(ownerActor, {
                accommodationId: ACCOMMODATION_ID,
                media: VALID_PAYLOAD
            });
            expect(result.error).toBeUndefined();
            expect(galleryCount).toBeLessThanOrEqual(ENTITY_CAP);
        }

        expect(galleryCount).toBe(ENTITY_CAP);
    });

    it('honours a plan cap tighter than the entity cap', async () => {
        const service = buildService();
        arrangeGallery({ galleryCount: 15, previousFeatured: true });

        const result = await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: VALID_PAYLOAD,
            planGalleryCap: 15
        });

        // 15 gallery photos on a 15-photo plan: demoting the old cover would
        // make 16, so it is archived instead — and the swap still succeeds.
        const patch = mockMediaModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.state).toBe('archived');
        expect(result.data?.previousFeatured?.disposition).toBe('archived');
        expect(result.error).toBeUndefined();
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

        const patch = mockMediaModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.state).toBe('archived');
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
