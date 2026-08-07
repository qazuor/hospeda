/**
 * HOS-372 regression — `reorderMedia` must reject duplicate ids.
 *
 * The set-equality validation compares `existingIds` against
 * `new Set(orderedIds)`, which by construction cannot see a duplicate: with
 * `orderedIds = [A, A, B]` against visible rows `{A, B}` the input dedupes to
 * `{A, B}`, so nothing is missing and nothing is extra, and the check passes.
 *
 * The damage is then real: the update loop writes A at index 0 and again at
 * index 1, so no row is left at `sortOrder` 0 (the order stops being dense), and
 * the response maps over `orderedIds`, so the same photo is returned twice.
 *
 * The payload schema does not catch it either — `orderedIds` is only
 * `array(uuid).min(1)`, with no uniqueness rule.
 *
 * Scope: this file covers the two REJECTION paths, which return before any
 * write. The happy path is already covered by the route tests under
 * `apps/api/test/routes/accommodation-reorder-media.test.ts`; reproducing it
 * here would mean mocking the whole update/transaction chain for no extra
 * signal.
 *
 * This is a true regression test: remove the length-vs-set-size guard in
 * `reorderMedia` and the first case goes green (accepted) instead of rejected.
 */
import { resetDb, setDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';
import { makeMediaModelStub } from '../../utils/modelMockFactory';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
const MEDIA_A = '00000000-0000-4000-8000-0000000000b1';
const MEDIA_B = '00000000-0000-4000-8000-0000000000b2';

/** The two visible gallery rows the accommodation currently has. */
const visibleRows = [
    { id: MEDIA_A, accommodationId: ACCOMMODATION_ID, sortOrder: 0, state: 'visible' },
    { id: MEDIA_B, accommodationId: ACCOMMODATION_ID, sortOrder: 1, state: 'visible' }
];

/**
 * Minimal Drizzle stub for `AccommodationMediaModel.findByAccommodation`, which
 * issues two queries in parallel: the paginated row select and a count select.
 * `reorderMedia` builds its own AccommodationMediaModel internally, so the real
 * class runs against this client rather than an injected stub.
 */
function makeMediaDbMock(rows: readonly unknown[]) {
    const rowQuery = {
        from: () => ({
            where: () => ({
                orderBy: () => ({
                    limit: () => ({ offset: () => Promise.resolve([...rows]) })
                })
            })
        })
    };
    const countQuery = {
        from: () => ({ where: () => Promise.resolve([{ count: rows.length }]) })
    };
    return {
        // `select()` with no projection is the row read; `select({ count })` is the count.
        select: vi.fn((projection?: unknown) => (projection ? countQuery : rowQuery)),
        update: vi.fn(() => ({
            set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) })
        }))
    };
}

const actor = {
    id: '00000000-0000-4000-8000-0000000000ff',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum)
};

function buildService() {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({ id: ACCOMMODATION_ID, ownerId: actor.id })
    };
    return new AccommodationService(
        {} as ServiceConfig,
        accommodationModel as never,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        makeMediaModelStub() as never
    );
}

describe('AccommodationService.reorderMedia — duplicate id rejection (HOS-372)', () => {
    let dbMock: ReturnType<typeof makeMediaDbMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        dbMock = makeMediaDbMock(visibleRows);
        setDb(dbMock as never);
    });

    afterEach(() => {
        resetDb();
    });

    it('rejects orderedIds containing a duplicate that set comparison cannot see', async () => {
        const service = buildService();

        const result = await service.reorderMedia(
            actor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                // Dedupes to exactly {A, B}: no missing id, no extra id.
                orderedIds: [MEDIA_A, MEDIA_A, MEDIA_B]
            } as never
        );

        expect(result.error).toBeDefined();
        expect(result.error?.message).toMatch(/duplicate/i);
        // And it must reject BEFORE writing anything.
        expect(dbMock.update).not.toHaveBeenCalled();
    });

    it('still rejects a genuine set mismatch', async () => {
        const service = buildService();

        const result = await service.reorderMedia(
            actor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                orderedIds: [MEDIA_A]
            } as never
        );

        expect(result.error).toBeDefined();
        expect(result.error?.message).toMatch(/does not match/i);
        expect(dbMock.update).not.toHaveBeenCalled();
    });
});
