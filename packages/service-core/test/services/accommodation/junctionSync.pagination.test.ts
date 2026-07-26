/**
 * HOS-321 — regression tests for the junction-sync "read the CURRENT set in
 * full" invariant.
 *
 * `BaseModelImpl.findAll` ALWAYS paginates and defaults to `pageSize: 20`, so
 * `syncAmenityJunction` / `syncFeatureJunction` used to diff the incoming
 * target set against only the first 20 existing rows. On the seeded
 * accommodations (92 amenities, 80 features) that produced two corruptions:
 *
 *  1. every already-linked row past the first page looked "missing" and was
 *     re-INSERTED — a composite-PK violation that 500s the PATCH and rolls the
 *     entire save back (this is what the host saw as "nothing is saved");
 *  2. every row past the first page that the host DEselected was never deleted,
 *     because it never entered the diff at all.
 *
 * These tests drive the sync helpers directly with a junction model whose
 * `findAll` honours `page` / `pageSize`, so a truncated read is observable.
 */

import type {
    AmenityModel,
    DrizzleClient,
    FeatureModel,
    RAccommodationAmenityModel,
    RAccommodationFeatureModel
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    syncAmenityJunction,
    syncFeatureJunction
} from '../../../src/services/accommodation/accommodation.junction-sync';

const ACCOMMODATION_ID = '11111111-1111-4111-8111-111111111111';

/** 45 ids — comfortably past the model's 20-row default page. */
const LINKED_IDS = Array.from(
    { length: 45 },
    (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`
);

/**
 * 250 ids — past the helper's own 200-row page size, so the multi-page
 * accumulation path actually executes. Without a fixture this large the loop
 * body is dead code under test: a regression that never incremented `page`
 * would keep every other case green.
 */
const MANY_LINKED_IDS = Array.from(
    { length: 250 },
    (_, i) => `cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`
);

/**
 * Builds a junction-model stub whose `findAll` paginates exactly like
 * `BaseModelImpl` does: `page` defaults to 1 and `pageSize` to 20, and `total`
 * always reports the full row count.
 */
function createPaginatingJunctionModel(idKey: 'amenityId' | 'featureId', ids: readonly string[]) {
    const rows = ids.map((id) => ({ accommodationId: ACCOMMODATION_ID, [idKey]: id }));

    return {
        findAll: vi.fn(
            async (
                _where: Record<string, unknown>,
                options?: { page?: number; pageSize?: number }
            ) => {
                const page = options?.page ?? 1;
                const pageSize = Math.min(options?.pageSize ?? 20, 200);
                const offset = (page - 1) * pageSize;
                return { items: rows.slice(offset, offset + pageSize), total: rows.length };
            }
        ),
        create: vi.fn().mockResolvedValue({}),
        hardDelete: vi.fn().mockResolvedValue(1)
    };
}

/**
 * Catalog stub where every looked-up ID exists. Built per test so call history
 * never leaks between cases.
 */
function createCatalogModel() {
    return {
        findByIds: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id })))
    };
}

const tx = {} as DrizzleClient;

describe('syncAmenityJunction — full current-set read (HOS-321)', () => {
    it('re-syncing the identical set writes nothing', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        // Before the fix: rows 21..45 looked missing and were re-inserted,
        // violating the (accommodation_id, amenity_id) primary key.
        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('deletes a de-selected row that lives past the first page', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);
        const removed = LINKED_IDS[40];
        const target = LINKED_IDS.filter((id) => id !== removed);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: target,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        // Before the fix this row was invisible to the diff, so the host's
        // de-selection was silently dropped.
        expect(junctionModel.hardDelete).toHaveBeenCalledTimes(1);
        expect(junctionModel.hardDelete).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, amenityId: [removed] },
            tx
        );
        expect(junctionModel.create).not.toHaveBeenCalled();
    });

    it('inserts only the genuinely new id when the set is large', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);
        const added = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: [...LINKED_IDS, added],
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        expect(junctionModel.create).toHaveBeenCalledTimes(1);
        expect(junctionModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ accommodationId: ACCOMMODATION_ID, amenityId: added }),
            tx
        );
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('empty target deletes every row, including those past the first page', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: [],
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        // ONE batched statement, not one round trip per row — clearing a fully
        // populated accommodation used to mean ~92 sequential DELETEs inside
        // the open write transaction.
        expect(junctionModel.hardDelete).toHaveBeenCalledTimes(1);
        const [where] = junctionModel.hardDelete.mock.calls[0] as [
            { accommodationId: string; amenityId: string[] }
        ];
        expect(where.accommodationId).toBe(ACCOMMODATION_ID);
        expect([...where.amenityId].sort()).toEqual([...LINKED_IDS].sort());
    });

    it('reads with a stable sort so LIMIT/OFFSET paging cannot drop or duplicate a row', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        expect(junctionModel.findAll).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID },
            expect.objectContaining({ sortBy: 'amenityId', sortOrder: 'asc' }),
            undefined,
            tx
        );
    });

    it('accumulates ACROSS pages when the set exceeds one page of the read', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', MANY_LINKED_IDS);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: MANY_LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        // 250 rows over a 200-row page: page 1 is full, page 2 is short and
        // ends the loop. Asserting the sequence is what keeps the loop from
        // silently degrading back into a single truncated read.
        const pages = junctionModel.findAll.mock.calls.map(
            (call) => (call[1] as { page: number }).page
        );
        expect(pages).toEqual([1, 2]);

        // All 250 already exist, so a complete read means nothing is written.
        // With only page 1 read, rows 201..250 would be re-inserted.
        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('validates the whole catalog set in ONE query, not one per id', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);
        const amenityModel = createCatalogModel();

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: amenityModel as unknown as AmenityModel,
            tx
        });

        // Repairing the baseline means the PATCH now carries the FULL set, so a
        // per-id lookup would be ~92 sequential round trips inside the write
        // transaction on the seeded properties.
        expect(amenityModel.findByIds).toHaveBeenCalledTimes(1);
        expect(amenityModel.findByIds).toHaveBeenCalledWith(LINKED_IDS, tx);
    });

    it('rejects an unknown catalog id without writing anything', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);
        const unknownId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
        const amenityModel = {
            // Mirrors a real batch lookup: the unknown id simply does not come back.
            findByIds: vi.fn(async (ids: readonly string[]) =>
                ids.filter((id) => id !== unknownId).map((id) => ({ id }))
            )
        };

        await expect(
            syncAmenityJunction({
                accommodationId: ACCOMMODATION_ID,
                amenityIds: [...LINKED_IDS, unknownId],
                junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
                amenityModel: amenityModel as unknown as AmenityModel,
                tx
            })
        ).rejects.toThrow(unknownId);

        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('stops on the short page and ignores a `total` that over-reports', async () => {
        // `findAll` issues its count and its rows as SEPARATE statements, so
        // under READ COMMITTED `total` can disagree with what was actually
        // read. Termination keys off the short page instead, which is
        // snapshot-independent — a lying `total` must change nothing.
        const junctionModel = {
            findAll: vi.fn(async () => ({
                items: LINKED_IDS.map((id) => ({
                    accommodationId: ACCOMMODATION_ID,
                    amenityId: id
                })),
                total: 9999 // lies — far more than will ever be returned
            })),
            create: vi.fn().mockResolvedValue({}),
            hardDelete: vi.fn().mockResolvedValue(1)
        };

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        // 45 < the 200-row page size, so one read — a `total` of 9999 must not
        // make the loop chase a second page.
        expect(junctionModel.findAll).toHaveBeenCalledTimes(1);
        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('throws instead of hanging when the model ignores `page`', async () => {
        // Termination otherwise rests on a contract the structural reader type
        // cannot enforce. A model that returns the same FULL page forever must
        // fail loudly, not spin the request.
        const fullPage = Array.from({ length: 200 }, (_, i) => ({
            accommodationId: ACCOMMODATION_ID,
            amenityId: `eeeeeeee-eeee-4eee-8eee-${String(i).padStart(12, '0')}`
        }));
        const junctionModel = {
            findAll: vi.fn(async () => ({ items: fullPage, total: 9999 })),
            create: vi.fn().mockResolvedValue({}),
            hardDelete: vi.fn().mockResolvedValue(1)
        };

        await expect(
            syncAmenityJunction({
                accommodationId: ACCOMMODATION_ID,
                amenityIds: LINKED_IDS,
                junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
                amenityModel: createCatalogModel() as unknown as AmenityModel,
                tx
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.INTERNAL_ERROR });

        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('undefined target still leaves the junction table untouched', async () => {
        const junctionModel = createPaginatingJunctionModel('amenityId', LINKED_IDS);

        await syncAmenityJunction({
            accommodationId: ACCOMMODATION_ID,
            amenityIds: undefined,
            junctionModel: junctionModel as unknown as RAccommodationAmenityModel,
            amenityModel: createCatalogModel() as unknown as AmenityModel,
            tx
        });

        expect(junctionModel.findAll).not.toHaveBeenCalled();
        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });
});

describe('syncFeatureJunction — full current-set read (HOS-321)', () => {
    it('re-syncing the identical set writes nothing', async () => {
        const junctionModel = createPaginatingJunctionModel('featureId', LINKED_IDS);

        await syncFeatureJunction({
            accommodationId: ACCOMMODATION_ID,
            featureIds: LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationFeatureModel,
            featureModel: createCatalogModel() as unknown as FeatureModel,
            tx
        });

        expect(junctionModel.create).not.toHaveBeenCalled();
        expect(junctionModel.hardDelete).not.toHaveBeenCalled();
    });

    it('deletes a de-selected row that lives past the first page', async () => {
        const junctionModel = createPaginatingJunctionModel('featureId', LINKED_IDS);
        const removed = LINKED_IDS[33];

        await syncFeatureJunction({
            accommodationId: ACCOMMODATION_ID,
            featureIds: LINKED_IDS.filter((id) => id !== removed),
            junctionModel: junctionModel as unknown as RAccommodationFeatureModel,
            featureModel: createCatalogModel() as unknown as FeatureModel,
            tx
        });

        expect(junctionModel.hardDelete).toHaveBeenCalledTimes(1);
        expect(junctionModel.hardDelete).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID, featureId: [removed] },
            tx
        );
    });

    it('reads with a stable sort so LIMIT/OFFSET paging cannot drop or duplicate a row', async () => {
        const junctionModel = createPaginatingJunctionModel('featureId', LINKED_IDS);

        await syncFeatureJunction({
            accommodationId: ACCOMMODATION_ID,
            featureIds: LINKED_IDS,
            junctionModel: junctionModel as unknown as RAccommodationFeatureModel,
            featureModel: createCatalogModel() as unknown as FeatureModel,
            tx
        });

        expect(junctionModel.findAll).toHaveBeenCalledWith(
            { accommodationId: ACCOMMODATION_ID },
            expect.objectContaining({ sortBy: 'featureId', sortOrder: 'asc' }),
            undefined,
            tx
        );
    });
});
