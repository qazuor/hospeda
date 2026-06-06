/**
 * Unit tests for photo archive/restore primitives (SPEC-167 T-009).
 *
 * Coverage:
 * - archiveAccommodationPhotos
 *   - round-trip: archive then full restore returns every item byte-for-byte
 *   - keepIds honored exactly: kept items stay in gallery, others move to archive
 *   - featuredImage untouched: never moves, not counted in gallery/archive totals
 *   - idempotency: archiving with same keepIds twice = same end state
 *   - empty keepIds: all gallery items move to archive
 *   - full keepIds: no items move (no-op movedCount=0)
 *   - INV-5: gallery.length + archivedGallery.length conserved on every call
 *   - missing/deleted accommodation: throws Error
 *   - existing archivedGallery preserved: new items appended, old ones kept
 *
 * - restoreAccommodationPhotos
 *   - restoreCount: exact count restored (FIFO order)
 *   - toCap: restores enough to reach cap
 *   - toCap already met: no-op
 *   - restoreCount >= archivedGallery.length: full restore
 *   - empty archivedGallery: no-op, movedCount=0
 *   - INV-5: total count conserved
 *   - missing accommodation: throws Error
 *   - neither restoreCount nor toCap: throws Error
 *
 * Testing strategy:
 * The SUT uses `withTransaction` from @repo/db. We mock the whole `@repo/db`
 * module so `withTransaction` becomes a pass-through that executes the callback
 * with a fake transaction client (`makeMockTx`). The fake tx supports:
 *   tx.select().from().where()  → resolves with caller-supplied row(s)
 *   tx.update().set().where()   → records the written payload
 *
 * This avoids any live DB connection and keeps tests purely in-memory.
 *
 * @module test/services/plan-photo-restriction.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// We mock the entire @repo/db so withTransaction is under our control.
// The table column stubs (accommodations.media, .id, .deletedAt) must match
// what the SUT references in select/where clauses.
vi.mock('@repo/db', () => {
    // Minimal column stubs — only what plan-photo-restriction.service.ts uses
    const accommodations = {
        id: 'id',
        media: 'media',
        deletedAt: 'deleted_at'
    };

    return {
        accommodations,
        eq: vi.fn((_col: unknown, _val: unknown) => ({ __eq: true })),
        isNull: vi.fn((_col: unknown) => ({ __isNull: true })),
        and: vi.fn((...args: unknown[]) => ({ __and: args })),
        // withTransaction: execute callback with the provided existingTx (or a new
        // fake tx) — this matches the real withTransaction(existingTx passthrough).
        withTransaction: vi.fn(
            async (cb: (tx: unknown) => Promise<unknown>, existingTx?: unknown) => cb(existingTx)
        )
    };
});

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { ModerationStatusEnum } from '@repo/schemas';
import type { Image, Media } from '@repo/schemas';
import {
    archiveAccommodationPhotos,
    restoreAccommodationPhotos
} from '../../src/services/plan-photo-restriction.service';

// ---------------------------------------------------------------------------
// Fake tx builder
//
// Produces a minimal Drizzle-like client that supports the two chain shapes
// the SUT uses:
//
//   tx.select({ media: accommodations.media })
//     .from(accommodations)
//     .where(...)             → resolves with `selectRows`
//
//   tx.update(accommodations)
//     .set(payload)
//     .where(...)             → resolves with [] (no return value needed)
//
// We capture the `.set()` payload for assertions.
// ---------------------------------------------------------------------------

interface FakeTxOptions {
    /** Rows returned by the SELECT (usually one accommodation row). */
    selectRows: Array<{ media: Media | null }>;
}

interface FakeTx {
    select: (..._args: unknown[]) => FakeTx;
    from: (..._args: unknown[]) => FakeTx;
    where: (..._args: unknown[]) => Promise<Array<{ media: Media | null }>>;
    update: (..._args: unknown[]) => FakeTx;
    setPayload: Media | null;
    set: (_payload: unknown) => FakeTx;
    updateCalled: boolean;
}

function makeFakeTx(opts: FakeTxOptions): FakeTx {
    const tx: FakeTx = {
        setPayload: null,
        updateCalled: false,

        select(..._args: unknown[]) {
            return tx;
        },
        from(..._args: unknown[]) {
            return tx;
        },
        where(..._args: unknown[]) {
            // When called after update().set(), behave as the update terminator
            if (tx.updateCalled) {
                return Promise.resolve([]) as unknown as Promise<Array<{ media: Media | null }>>;
            }
            // Otherwise behave as the select terminator
            return Promise.resolve(opts.selectRows);
        },
        update(..._args: unknown[]) {
            tx.updateCalled = true;
            return tx;
        },
        set(payload: unknown) {
            tx.setPayload = (payload as { media: Media }).media;
            tx.updateCalled = true;
            return tx;
        }
    };
    return tx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImg(url: string): Image {
    return { url, moderationState: ModerationStatusEnum.APPROVED };
}

// ---------------------------------------------------------------------------
// archiveAccommodationPhotos
// ---------------------------------------------------------------------------

describe('plan-photo-restriction.service — archiveAccommodationPhotos (T-009)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.clearAllMocks());

    it('round-trip: archive then full restore returns every item byte-for-byte', async () => {
        // Arrange — 3 gallery items, keep only img-1
        const imgA = makeImg('https://cdn.example.com/a.jpg');
        const imgB = makeImg('https://cdn.example.com/b.jpg');
        const imgC = makeImg('https://cdn.example.com/c.jpg');

        const media: Media = { gallery: [imgA, imgB, imgC] };
        const txArchive = makeFakeTx({ selectRows: [{ media }] });

        // Act — archive (keep only imgA)
        const archiveResult = await archiveAccommodationPhotos({
            accommodationId: 'acc-01',
            keepIds: new Set([imgA.url]),
            db: txArchive as unknown as import('@repo/db').DrizzleClient
        });

        // Assert archive step
        expect(archiveResult.movedCount).toBe(2);
        expect(archiveResult.totalCount).toBe(3);

        const afterArchive = txArchive.setPayload as Media;
        expect(afterArchive.gallery).toHaveLength(1);
        expect(afterArchive.gallery?.[0]).toStrictEqual(imgA);
        expect(afterArchive.archivedGallery).toHaveLength(2);
        // Items in archive must be byte-identical to originals
        expect(afterArchive.archivedGallery?.[0]).toStrictEqual(imgB);
        expect(afterArchive.archivedGallery?.[1]).toStrictEqual(imgC);

        // Restore: gallery=[imgA], archivedGallery=[imgB, imgC]
        const txRestore = makeFakeTx({ selectRows: [{ media: afterArchive }] });

        const restoreResult = await restoreAccommodationPhotos({
            accommodationId: 'acc-01',
            restoreCount: 2,
            db: txRestore as unknown as import('@repo/db').DrizzleClient
        });

        expect(restoreResult.movedCount).toBe(2);
        expect(restoreResult.totalCount).toBe(3);

        const afterRestore = txRestore.setPayload as Media;
        expect(afterRestore.gallery).toHaveLength(3);
        // Byte-for-byte check: all original items present
        expect(afterRestore.gallery).toContainEqual(imgA);
        expect(afterRestore.gallery).toContainEqual(imgB);
        expect(afterRestore.gallery).toContainEqual(imgC);
        expect(afterRestore.archivedGallery).toHaveLength(0);
    });

    it('keepIds honored exactly: kept items in gallery, others moved to archive', async () => {
        const img1 = makeImg('https://cdn.example.com/1.jpg');
        const img2 = makeImg('https://cdn.example.com/2.jpg');
        const img3 = makeImg('https://cdn.example.com/3.jpg');

        const media: Media = { gallery: [img1, img2, img3] };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        await archiveAccommodationPhotos({
            accommodationId: 'acc-02',
            keepIds: new Set([img1.url, img3.url]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(2);
        expect(written.gallery?.map((i) => i.url)).toContain(img1.url);
        expect(written.gallery?.map((i) => i.url)).toContain(img3.url);
        expect(written.gallery?.map((i) => i.url)).not.toContain(img2.url);

        expect(written.archivedGallery).toHaveLength(1);
        expect(written.archivedGallery?.[0]).toStrictEqual(img2);
    });

    it('featuredImage is untouched: never moved to archive, not counted', async () => {
        const featured = makeImg('https://cdn.example.com/featured.jpg');
        const galleryImg = makeImg('https://cdn.example.com/g1.jpg');

        const media: Media = { featuredImage: featured, gallery: [galleryImg] };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        await archiveAccommodationPhotos({
            accommodationId: 'acc-03',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        const written = tx.setPayload as Media;
        // featuredImage must survive unmodified
        expect(written.featuredImage).toStrictEqual(featured);
        // gallery item moved to archive
        expect(written.gallery).toHaveLength(0);
        expect(written.archivedGallery).toHaveLength(1);
        expect(written.archivedGallery?.[0]).toStrictEqual(galleryImg);
        // totalCount does NOT include featuredImage
        // (1 gallery item moved → total = 0 + 1 = 1)
    });

    it('idempotency: archiving with same keepIds twice yields same end state', async () => {
        const imgX = makeImg('https://cdn.example.com/x.jpg');
        const imgY = makeImg('https://cdn.example.com/y.jpg');

        const media: Media = { gallery: [imgX, imgY] };
        const tx1 = makeFakeTx({ selectRows: [{ media }] });

        // First archive: keep imgX, move imgY
        await archiveAccommodationPhotos({
            accommodationId: 'acc-04',
            keepIds: new Set([imgX.url]),
            db: tx1 as unknown as import('@repo/db').DrizzleClient
        });

        const afterFirst = tx1.setPayload as Media;

        // Second archive: same keepIds, but now gallery=[imgX], archivedGallery=[imgY]
        // imgY is already in archive, NOT in gallery — toArchive will be empty
        const tx2 = makeFakeTx({ selectRows: [{ media: afterFirst }] });

        const result2 = await archiveAccommodationPhotos({
            accommodationId: 'acc-04',
            keepIds: new Set([imgX.url]),
            db: tx2 as unknown as import('@repo/db').DrizzleClient
        });

        // Idempotent: movedCount = 0 (nothing left to move from gallery)
        expect(result2.movedCount).toBe(0);
        // No update was written in the second call (short-circuit path)
        expect(tx2.setPayload).toBeNull();
        // INV-5: total still 2
        expect(result2.totalCount).toBe(2);
    });

    it('empty keepIds: all gallery items moved to archivedGallery', async () => {
        const img1 = makeImg('https://cdn.example.com/1.jpg');
        const img2 = makeImg('https://cdn.example.com/2.jpg');

        const media: Media = { gallery: [img1, img2] };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-05',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(2);
        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(0);
        expect(written.archivedGallery).toHaveLength(2);
    });

    it('full keepIds: no items move — no-op, movedCount=0', async () => {
        const img1 = makeImg('https://cdn.example.com/1.jpg');
        const img2 = makeImg('https://cdn.example.com/2.jpg');

        const media: Media = { gallery: [img1, img2] };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-06',
            keepIds: new Set([img1.url, img2.url]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(result.totalCount).toBe(2);
        // No DB write for the no-op path
        expect(tx.setPayload).toBeNull();
    });

    it('INV-5: gallery.length + archivedGallery.length conserved after archive', async () => {
        const imgs = [
            makeImg('https://cdn.example.com/a.jpg'),
            makeImg('https://cdn.example.com/b.jpg'),
            makeImg('https://cdn.example.com/c.jpg'),
            makeImg('https://cdn.example.com/d.jpg')
        ];

        const existingArchived = [makeImg('https://cdn.example.com/old.jpg')];
        const media: Media = { gallery: imgs, archivedGallery: existingArchived };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-07',
            keepIds: new Set([imgs[0]!.url, imgs[2]!.url]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // Pre-operation total: 4 gallery + 1 archived = 5
        expect(result.totalCount).toBe(5);
        const written = tx.setPayload as Media;
        expect((written.gallery?.length ?? 0) + (written.archivedGallery?.length ?? 0)).toBe(5);
    });

    it('existing archivedGallery is preserved — new items appended, old kept', async () => {
        const old1 = makeImg('https://cdn.example.com/old1.jpg');
        const new1 = makeImg('https://cdn.example.com/new1.jpg');
        const keep1 = makeImg('https://cdn.example.com/keep1.jpg');

        const media: Media = { gallery: [new1, keep1], archivedGallery: [old1] };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        await archiveAccommodationPhotos({
            accommodationId: 'acc-08',
            keepIds: new Set([keep1.url]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        const written = tx.setPayload as Media;
        expect(written.archivedGallery).toHaveLength(2);
        // old1 is still at head (preserved), new1 appended
        expect(written.archivedGallery?.[0]).toStrictEqual(old1);
        expect(written.archivedGallery?.[1]).toStrictEqual(new1);
    });

    it('missing accommodation: throws Error with descriptive message', async () => {
        const tx = makeFakeTx({ selectRows: [] }); // no row found

        await expect(
            archiveAccommodationPhotos({
                accommodationId: 'acc-missing',
                keepIds: new Set<string>(),
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-missing');
    });

    it('null media (new accommodation): treats gallery as empty, no-op', async () => {
        const tx = makeFakeTx({ selectRows: [{ media: null }] });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-null-media',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // gallery was empty → nothing to archive
        expect(result.movedCount).toBe(0);
        expect(result.totalCount).toBe(0);
        expect(tx.setPayload).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// restoreAccommodationPhotos
// ---------------------------------------------------------------------------

describe('plan-photo-restriction.service — restoreAccommodationPhotos (T-009)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.clearAllMocks());

    it('restoreCount: exact count restored in FIFO order', async () => {
        const img1 = makeImg('https://cdn.example.com/1.jpg');
        const img2 = makeImg('https://cdn.example.com/2.jpg');
        const img3 = makeImg('https://cdn.example.com/3.jpg');
        const current = makeImg('https://cdn.example.com/current.jpg');

        const media: Media = {
            gallery: [current],
            archivedGallery: [img1, img2, img3]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-11',
            restoreCount: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(4);

        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(3);
        // FIFO: img1 and img2 (head of archive) moved to gallery
        expect(written.gallery).toContainEqual(img1);
        expect(written.gallery).toContainEqual(img2);
        expect(written.gallery).not.toContainEqual(img3);
        // img3 stays in archive
        expect(written.archivedGallery).toHaveLength(1);
        expect(written.archivedGallery?.[0]).toStrictEqual(img3);
    });

    it('toCap: restores enough to reach cap', async () => {
        const inGallery = makeImg('https://cdn.example.com/g.jpg');
        const arch1 = makeImg('https://cdn.example.com/a1.jpg');
        const arch2 = makeImg('https://cdn.example.com/a2.jpg');
        const arch3 = makeImg('https://cdn.example.com/a3.jpg');

        const media: Media = {
            gallery: [inGallery],
            archivedGallery: [arch1, arch2, arch3]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        // gallery has 1, cap = 3 → need 2 more
        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-12',
            toCap: 3,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(4);

        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(3);
        expect(written.archivedGallery).toHaveLength(1);
        expect(written.archivedGallery?.[0]).toStrictEqual(arch3);
    });

    it('toCap already met: no-op, movedCount=0, no DB write', async () => {
        const img = makeImg('https://cdn.example.com/g.jpg');
        const media: Media = {
            gallery: [img, img],
            archivedGallery: [makeImg('https://cdn.example.com/a.jpg')]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-13',
            toCap: 2, // gallery already has 2
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(tx.setPayload).toBeNull();
    });

    it('restoreCount >= archivedGallery.length: full restore', async () => {
        const arch1 = makeImg('https://cdn.example.com/a1.jpg');
        const arch2 = makeImg('https://cdn.example.com/a2.jpg');

        const media: Media = {
            gallery: [],
            archivedGallery: [arch1, arch2]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-14',
            restoreCount: 100, // way more than available
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(2);

        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(2);
        expect(written.archivedGallery).toHaveLength(0);
    });

    it('empty archivedGallery: no-op, movedCount=0, no DB write', async () => {
        const media: Media = {
            gallery: [makeImg('https://cdn.example.com/g.jpg')],
            archivedGallery: []
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-15',
            restoreCount: 5,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(tx.setPayload).toBeNull();
    });

    it('INV-5: gallery.length + archivedGallery.length conserved after restore', async () => {
        const arch1 = makeImg('https://cdn.example.com/a1.jpg');
        const arch2 = makeImg('https://cdn.example.com/a2.jpg');
        const arch3 = makeImg('https://cdn.example.com/a3.jpg');

        const media: Media = {
            gallery: [makeImg('https://cdn.example.com/g.jpg')],
            archivedGallery: [arch1, arch2, arch3]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-16',
            restoreCount: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // Pre-op total: 1 + 3 = 4
        expect(result.totalCount).toBe(4);
        const written = tx.setPayload as Media;
        expect((written.gallery?.length ?? 0) + (written.archivedGallery?.length ?? 0)).toBe(4);
    });

    it('missing accommodation: throws Error with descriptive message', async () => {
        const tx = makeFakeTx({ selectRows: [] });

        await expect(
            restoreAccommodationPhotos({
                accommodationId: 'acc-missing',
                restoreCount: 1,
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-missing');
    });

    it('neither restoreCount nor toCap: throws Error', async () => {
        const tx = makeFakeTx({
            selectRows: [{ media: { gallery: [] } }]
        });

        await expect(
            restoreAccommodationPhotos({
                accommodationId: 'acc-17',
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('restoreAccommodationPhotos');
    });

    it('null media: treats gallery and archive as empty — no-op on restoreCount=0', async () => {
        const tx = makeFakeTx({ selectRows: [{ media: null }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-null',
            restoreCount: 5,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(result.totalCount).toBe(0);
        expect(tx.setPayload).toBeNull();
    });

    it('FIFO order: first-archived item ends up first in gallery after restore', async () => {
        const first = makeImg('https://cdn.example.com/first-archived.jpg');
        const second = makeImg('https://cdn.example.com/second-archived.jpg');

        const media: Media = {
            gallery: [],
            archivedGallery: [first, second]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        await restoreAccommodationPhotos({
            accommodationId: 'acc-18',
            restoreCount: 1,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(1);
        // FIFO: `first` (head of archive) moves to gallery
        expect(written.gallery?.[0]).toStrictEqual(first);
        // `second` stays in archive
        expect(written.archivedGallery).toHaveLength(1);
        expect(written.archivedGallery?.[0]).toStrictEqual(second);
    });
});
