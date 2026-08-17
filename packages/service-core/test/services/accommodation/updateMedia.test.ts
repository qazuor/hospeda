/**
 * packages/service-core/test/services/accommodation/updateMedia.test.ts
 *
 * HOS-388 — `AccommodationService.updateMedia` (PATCH /:id/media/:mediaId).
 *
 * `updateMedia` — like `reorderMedia`/`setFeaturedMedia`/`archiveMedia` — locally
 * instantiates `new AccommodationMediaModel()` rather than using the injected
 * `_accommodationMediaModel`, so the real model class runs against a globally
 * mocked Drizzle client via `setDb` (mirrors
 * `reorderMedia.duplicates.test.ts`'s mocking style).
 *
 * Coverage:
 * - Happy path: updates `alt` and asserts the actual `.set()` write + returned
 *   row, not just a truthy result.
 * - `null` clears a field (distinct from omitting it).
 * - Empty payload → VALIDATION_ERROR, no DB write.
 * - Media row belonging to another accommodation → NOT_FOUND.
 * - Soft-deleted media row → NOT_FOUND.
 * - Non-owner actor → FORBIDDEN (same error as reorderMedia/setFeaturedMedia).
 * - A forbidden field (e.g. `isFeatured`) smuggled in the payload never reaches
 *   the DB `.set()` call — Zod strips unknown keys before the service sees them.
 */
import { resetDb, setDb } from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
const OTHER_ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a2';
const MEDIA_ID = '00000000-0000-4000-8000-0000000000b1';

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

/**
 * Minimal Drizzle stub covering `AccommodationMediaModel.findById` (loads the
 * target row) and `.update()` (the write under test). Captures the `.set()`
 * call args so assertions can inspect exactly which columns were written,
 * not just the mocked return value.
 */
function makeMediaDbMock({
    findResult,
    updateResult
}: {
    findResult: unknown[];
    updateResult: unknown[];
}) {
    const setSpy = vi.fn((_patch: Record<string, unknown>) => ({
        where: () => ({ returning: () => Promise.resolve(updateResult) })
    }));
    return {
        select: vi.fn(() => ({
            from: () => ({ where: () => ({ limit: () => Promise.resolve(findResult) }) })
        })),
        update: vi.fn(() => ({ set: setSpy })),
        _setSpy: setSpy
    };
}

const ownerActor = {
    id: '00000000-0000-4000-8000-0000000000ff',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

const strangerActor = {
    id: '00000000-0000-4000-8000-0000000000ee',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

function buildService(ownerId: string = ownerActor.id) {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({ id: ACCOMMODATION_ID, ownerId })
    };
    return new AccommodationService({} as ServiceConfig, accommodationModel as never);
}

describe('AccommodationService.updateMedia (HOS-388)', () => {
    afterEach(() => {
        resetDb();
    });

    it('updates alt and persists — asserts the actual DB write, not just the 200', async () => {
        const dbMock = makeMediaDbMock({
            findResult: [baseMediaRow],
            updateResult: [{ ...baseMediaRow, alt: 'Vista renovada del balcon' }]
        });
        setDb(dbMock as never);
        const service = buildService();

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'Vista renovada del balcon'
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.media.alt).toBe('Vista renovada del balcon');
        // The row actually written: only `alt`, nothing else.
        expect(dbMock._setSpy).toHaveBeenCalledTimes(1);
        expect(dbMock._setSpy).toHaveBeenCalledWith({ alt: 'Vista renovada del balcon' });
    });

    it('clears a field when the caller sends null (distinct from omitting it)', async () => {
        const dbMock = makeMediaDbMock({
            findResult: [baseMediaRow],
            updateResult: [{ ...baseMediaRow, caption: null }]
        });
        setDb(dbMock as never);
        const service = buildService();

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                caption: null
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.media.caption).toBeNull();
        expect(dbMock._setSpy).toHaveBeenCalledWith({ caption: null });
    });

    it('rejects an empty payload as VALIDATION_ERROR without writing anything', async () => {
        const dbMock = makeMediaDbMock({ findResult: [baseMediaRow], updateResult: [] });
        setDb(dbMock as never);
        const service = buildService();

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID
            } as never
        );

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(dbMock.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND (never FORBIDDEN) for media belonging to another accommodation', async () => {
        const foreignRow = { ...baseMediaRow, accommodationId: OTHER_ACCOMMODATION_ID };
        const dbMock = makeMediaDbMock({ findResult: [foreignRow], updateResult: [] });
        setDb(dbMock as never);
        const service = buildService();

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'x'
            } as never
        );

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(dbMock.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for a soft-deleted media row', async () => {
        const deletedRow = { ...baseMediaRow, deletedAt: NOW };
        const dbMock = makeMediaDbMock({ findResult: [deletedRow], updateResult: [] });
        setDb(dbMock as never);
        const service = buildService();

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'x'
            } as never
        );

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(dbMock.update).not.toHaveBeenCalled();
    });

    it('returns FORBIDDEN for a non-owner actor — same error as reorderMedia/setFeaturedMedia', async () => {
        const dbMock = makeMediaDbMock({ findResult: [baseMediaRow], updateResult: [] });
        setDb(dbMock as never);
        // The accommodation's owner is neither `strangerActor` nor anyone with UPDATE_ANY.
        const service = buildService('00000000-0000-4000-8000-000000009999');

        const result = await service.updateMedia(
            strangerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'x'
            } as never
        );

        expect(result.error?.code).toBe('FORBIDDEN');
        expect(dbMock.update).not.toHaveBeenCalled();
    });

    it('never writes a forbidden field (e.g. isFeatured) even if the caller sends it', async () => {
        const dbMock = makeMediaDbMock({
            findResult: [baseMediaRow],
            updateResult: [{ ...baseMediaRow, alt: 'x' }]
        });
        setDb(dbMock as never);
        const service = buildService();

        const result = await service.updateMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                mediaId: MEDIA_ID,
                alt: 'x',
                // Not a field on AccommodationMediaUpdateInputSchema — Zod strips it
                // before the service ever sees it.
                isFeatured: true
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.media.alt).toBe('x');
        // The `.set()` call must contain ONLY `alt` — no `isFeatured` key.
        expect(dbMock._setSpy).toHaveBeenCalledWith({ alt: 'x' });
        const writtenPatch = dbMock._setSpy.mock.calls[0]?.[0];
        expect(writtenPatch).not.toHaveProperty('isFeatured');
        // The returned row's isFeatured reflects the DB value, not the smuggled `true`.
        expect(result.data?.media.isFeatured).toBe(false);
    });
});
