/**
 * HOS-1175 — `removeMedia`, `archiveMedia` and `restoreMedia` must treat a
 * soft-deleted media row as absent.
 *
 * `BaseModelImpl.findById` does NOT filter soft-deletes and `softDelete` stamps
 * only the deletion columns, so without an explicit `deletedAt` check a dead row
 * is resolved as if it were live: removed again (re-stamping `deletedAt` and
 * resequencing), archived, or restored. Each method must answer NOT_FOUND and
 * write nothing. The row state is chosen so the state guard would PASS
 * (visible for archive/remove, archived for restore): `deletedAt` is the only
 * reason for the refusal.
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
const MEDIA_ID = '00000000-0000-4000-8000-0000000000b1';
const NOW = new Date('2026-01-15T12:00:00.000Z');

const ownerActor = {
    id: '00000000-0000-4000-8000-0000000000ff',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

function makeDeletedRow(state: 'visible' | 'archived') {
    return {
        id: MEDIA_ID,
        accommodationId: ACCOMMODATION_ID,
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        publicId: 'hospeda/dev/sample',
        caption: null,
        description: null,
        alt: null,
        attribution: null,
        moderationState: ModerationStatusEnum.APPROVED,
        state,
        isFeatured: false,
        sortOrder: 0,
        archivedAt: state === 'archived' ? NOW : null,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: NOW
    };
}

/** Drizzle stub: `findById` resolves the given row; any write is observable. */
function makeDbMock(row: unknown) {
    return {
        select: vi.fn(() => ({
            from: () => ({ where: () => ({ limit: () => Promise.resolve([row]) }) })
        })),
        update: vi.fn(() => ({
            set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) })
        })),
        transaction: vi.fn()
    };
}

function buildService() {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({ id: ACCOMMODATION_ID, ownerId: ownerActor.id })
    };
    return new AccommodationService({} as ServiceConfig, accommodationModel as never);
}

const input = { accommodationId: ACCOMMODATION_ID, mediaId: MEDIA_ID } as never;

describe('AccommodationService media methods vs soft-deleted rows (HOS-1175)', () => {
    afterEach(() => {
        resetDb();
    });

    it('removeMedia returns NOT_FOUND and writes nothing', async () => {
        const db = makeDbMock(makeDeletedRow('visible'));
        setDb(db as never);

        const result = await buildService().removeMedia(ownerActor as never, input);

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(db.update).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it('archiveMedia returns NOT_FOUND and writes nothing', async () => {
        const db = makeDbMock(makeDeletedRow('visible'));
        setDb(db as never);

        const result = await buildService().archiveMedia(ownerActor as never, input);

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(db.update).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it('restoreMedia returns NOT_FOUND and writes nothing', async () => {
        const db = makeDbMock(makeDeletedRow('archived'));
        setDb(db as never);

        const result = await buildService().restoreMedia(ownerActor as never, input);

        expect(result.error?.code).toBe('NOT_FOUND');
        expect(db.update).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });
});
