/**
 * packages/service-core/test/services/accommodation/media-revalidation.test.ts
 *
 * HOS-389 §4 — a photo change must purge the public page.
 *
 * `AccommodationService` schedules ISR/Cloudflare revalidation from its create,
 * update, publish, unpublish, visibility and delete paths — but NOT from any of
 * its seven mutating media methods. So a host could replace the cover photo and
 * the public listing kept serving the old one from cache until some unrelated
 * edit happened to purge it.
 *
 * Two kinds of coverage, deliberately:
 *
 *  1. A behavioral test that the wiring really schedules — and, just as
 *     important, that it does NOT schedule for a listing with no public page.
 *     `updateMedia` is the vehicle because its DB shape is already pinned down
 *     by `updateMedia.test.ts`.
 *  2. A static guard over every mutating media method. What regresses here is an
 *     EIGHTH one arriving without the call, and a behavioral test only ever
 *     covers the method it drives.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resetDb, setDb } from '@repo/db';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

// Hoisted spy: the factory cannot close over a top-level const (vi.mock is
// hoisted above it), so the spy is created inside `vi.hoisted`.
const { mockScheduleRevalidation } = vi.hoisted(() => ({
    mockScheduleRevalidation: vi.fn()
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => ({ scheduleRevalidation: mockScheduleRevalidation }))
}));

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
const MEDIA_ID = '00000000-0000-4000-8000-0000000000b1';
const DESTINATION_ID = '00000000-0000-4000-8000-0000000000c1';

const NOW = new Date('2026-01-15T12:00:00.000Z');

const baseMediaRow = {
    id: MEDIA_ID,
    accommodationId: ACCOMMODATION_ID,
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    publicId: 'hospeda/dev/sample',
    caption: 'Vista al mar',
    description: 'Una hermosa vista al mar desde el balcon principal.',
    alt: 'Foto original',
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};

const ownerActor = {
    id: '00000000-0000-4000-8000-0000000000ff',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

/** Minimal Drizzle stub for `AccommodationMediaModel.findById` + `.update()`. */
function makeMediaDbMock(updateResult: unknown[]) {
    return {
        select: vi.fn(() => ({
            from: () => ({ where: () => ({ limit: () => Promise.resolve([baseMediaRow]) }) })
        })),
        update: vi.fn(() => ({
            set: () => ({ where: () => ({ returning: () => Promise.resolve(updateResult) }) })
        }))
    };
}

/**
 * Builds the service over an accommodation with the given publication state.
 * `_isPubliclyVisible` requires BOTH `lifecycleState: ACTIVE` and
 * `visibility: PUBLIC`, so a DRAFT listing is the negative control.
 */
function buildService({ isPublic }: { readonly isPublic: boolean }) {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({
            id: ACCOMMODATION_ID,
            ownerId: ownerActor.id,
            slug: 'cabana-del-rio',
            destinationId: DESTINATION_ID,
            lifecycleState: isPublic ? LifecycleStatusEnum.ACTIVE : LifecycleStatusEnum.DRAFT,
            visibility: isPublic ? VisibilityEnum.PUBLIC : VisibilityEnum.PRIVATE
        })
    };
    return new AccommodationService({} as ServiceConfig, accommodationModel as never);
}

describe('accommodation media — public-page revalidation (HOS-389 §4)', () => {
    beforeEach(() => {
        mockScheduleRevalidation.mockClear();
    });

    afterEach(() => {
        resetDb();
    });

    it('schedules revalidation after correcting a photo on a published listing', async () => {
        setDb(makeMediaDbMock([{ ...baseMediaRow, alt: 'Vista renovada del balcon' }]) as never);
        const service = buildService({ isPublic: true });

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'Vista renovada del balcon'
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: 'accommodation',
                id: ACCOMMODATION_ID,
                slug: 'cabana-del-rio'
            })
        );
    });

    it('schedules nothing for a listing with no public page', async () => {
        // A DRAFT/PRIVATE listing has no public footprint, so purging its paths
        // is wasted work — and in production it produced logged 404s (HOS-203).
        setDb(makeMediaDbMock([{ ...baseMediaRow, alt: 'Otro texto' }]) as never);
        const service = buildService({ isPublic: false });

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'Otro texto'
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).not.toHaveBeenCalled();
    });

    it('does not fail the write when scheduling throws', async () => {
        // Revalidation is a best-effort side effect: a purge problem must never
        // roll back the photo edit the host just made.
        mockScheduleRevalidation.mockImplementationOnce(() => {
            throw new Error('revalidation queue unavailable');
        });
        setDb(makeMediaDbMock([{ ...baseMediaRow, alt: 'Sigue guardando' }]) as never);
        const service = buildService({ isPublic: true });

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'Sigue guardando'
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.media.alt).toBe('Sigue guardando');
        // Non-vacuous: without the queued throw this test passes with the
        // try/catch removed.
        expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
    });
});

describe('every media method schedules revalidation — static guard (HOS-389 §4)', () => {
    /**
     * The mutating media methods on AccommodationService.
     *
     * `adminGetMedia` is deliberately absent — it is a read, and a read has
     * nothing to purge. `restoreMedia` was missed on the first pass of this
     * work and only surfaced while wiring the others up, which is the whole
     * argument for this guard existing.
     */
    const MEDIA_METHODS: readonly string[] = [
        'addMedia',
        'removeMedia',
        'reorderMedia',
        'setFeaturedMedia',
        'updateMedia',
        'archiveMedia',
        'restoreMedia'
    ];

    const source = readFileSync(
        resolve(__dirname, '../../../src/services/accommodation/accommodation.service.ts'),
        'utf8'
    );

    /**
     * Returns the body of `public async <name>(` up to the next `public async`
     * declaration — close enough to a method body for a containment check, and
     * far more honest than searching the whole 4500-line file, which would pass
     * for a method that never calls it.
     */
    function methodBody(name: string): string {
        const start = source.indexOf(`public async ${name}(`);
        expect(start, `${name} not found — was it renamed?`).toBeGreaterThan(-1);
        const rest = source.slice(start);
        // Search from 1, not 0 — position 0 IS this method's own declaration.
        const end = rest.indexOf('public async ', 1);
        return end === -1 ? rest : rest.slice(0, end);
    }

    it.each(MEDIA_METHODS)('%s calls the revalidation helper', (name) => {
        expect(methodBody(name)).toContain('_scheduleAccommodationRevalidation');
    });

    it('slices a method body without swallowing the next one', () => {
        // Non-vacuity for the slicer: if `methodBody` returned the whole file,
        // every method above would pass on someone else's call.
        const body = methodBody('updateMedia');

        expect(body).toContain('public async updateMedia(');
        expect(body.match(/public async /g) ?? []).toHaveLength(1);
    });
});
