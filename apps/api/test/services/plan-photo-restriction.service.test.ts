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

    // Minimal sql tagged-template stub — the service uses sql`...` to build the
    // FOR UPDATE query. The FakeTx.execute() receives the result and ignores it
    // (it returns rows from its own closure), so the stub only needs to return a
    // non-null sentinel value.
    const sql = Object.assign(
        (strings: TemplateStringsArray, ...values: unknown[]) => ({
            __sql: strings.raw.join('?'),
            values
        }),
        { raw: (s: string) => s }
    );

    return {
        accommodations,
        sql,
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
    /** M-1: execute() implements SELECT ... FOR UPDATE lock. */
    execute: (_sql: unknown) => Promise<{ rows: Array<{ id: string; media: Media | null }> }>;
    executeCalled: boolean;
}

function makeFakeTx(opts: FakeTxOptions): FakeTx {
    const tx: FakeTx = {
        setPayload: null,
        updateCalled: false,
        executeCalled: false,

        // M-1: After the FOR UPDATE fix the primitives use execute() for the
        // initial read. execute() returns the same rows as selectRows so existing
        // tests covering archive/restore logic still work correctly.
        async execute(_sql: unknown) {
            tx.executeCalled = true;
            const rows = opts.selectRows.map((r, i) => ({ id: `acc-fake-${i}`, media: r.media }));
            return { rows };
        },

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
            // Otherwise behave as the select terminator (legacy path — no longer
            // used after M-1 fix but kept so tests that assert on setPayload work).
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

// ---------------------------------------------------------------------------
// M-1 — FOR UPDATE row lock regression tests
//
// After the M-1 fix, both primitives acquire a pessimistic row lock via
// `tx.execute(sql\`SELECT id, media ... FOR UPDATE\`)` BEFORE computing the
// new media state and issuing the UPDATE. This prevents lost-update races
// between concurrent media writers operating under READ COMMITTED.
//
// `makeFakeTx` now includes `execute()` support and records `executeCalled`,
// so these tests simply assert on that flag.
// ---------------------------------------------------------------------------

describe('plan-photo-restriction.service — FOR UPDATE row lock (M-1 regression)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.clearAllMocks());

    it('archiveAccommodationPhotos acquires FOR UPDATE lock before computing new state', async () => {
        const img1 = makeImg('https://cdn.example.com/lock-a1.jpg');
        const img2 = makeImg('https://cdn.example.com/lock-a2.jpg');
        const media: Media = { gallery: [img1, img2] };

        const tx = makeFakeTx({ selectRows: [{ media }] });

        await archiveAccommodationPhotos({
            accommodationId: 'acc-lock-01',
            keepIds: new Set([img1.url]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // Assert: execute() was called (FOR UPDATE lock acquired)
        expect(tx.executeCalled).toBe(true);
    });

    it('restoreAccommodationPhotos acquires FOR UPDATE lock before computing new state', async () => {
        const arch1 = makeImg('https://cdn.example.com/lock-r1.jpg');
        const media: Media = { gallery: [], archivedGallery: [arch1] };

        const tx = makeFakeTx({ selectRows: [{ media }] });

        await restoreAccommodationPhotos({
            accommodationId: 'acc-lock-02',
            restoreCount: 1,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // Assert: execute() was called (FOR UPDATE lock acquired)
        expect(tx.executeCalled).toBe(true);
    });

    it('archiveAccommodationPhotos throws when accommodation not found (locked row absent)', async () => {
        const tx = makeFakeTx({ selectRows: [] }); // execute() returns empty rows

        await expect(
            archiveAccommodationPhotos({
                accommodationId: 'acc-not-found-lock',
                keepIds: new Set<string>(),
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-not-found-lock');
    });

    it('restoreAccommodationPhotos throws when accommodation not found (locked row absent)', async () => {
        const tx = makeFakeTx({ selectRows: [] }); // execute() returns empty rows

        await expect(
            restoreAccommodationPhotos({
                accommodationId: 'acc-not-found-lock-restore',
                restoreCount: 1,
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-not-found-lock-restore');
    });
});

// ---------------------------------------------------------------------------
// M-3 — featuredImage occupies one cap slot in restoreAccommodationPhotos
//
// When `toCap` is provided and the accommodation has a `featuredImage`, the
// effective gallery target must be `toCap - 1` (one slot is reserved for
// featuredImage). This is symmetric with the restriction side:
//   gallerySlots = cap - (hasFeaturedImage ? 1 : 0)
//
// These tests call the real primitive via a FakeTx (no module mocking of
// plan-photo-restriction.service).
// ---------------------------------------------------------------------------

describe('plan-photo-restriction.service — toCap featuredImage seat reservation (M-3 regression)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.clearAllMocks());

    it('toCap with featuredImage: gallery target = toCap - 1 (not toCap)', async () => {
        // cap = 10, featuredImage present → galleryTarget = 9
        // gallery currently has 7 → needed = 2 → move 2 from archived
        const featured = makeImg('https://cdn.example.com/feat.jpg');
        const g1 = makeImg('https://cdn.example.com/g1.jpg');
        const g2 = makeImg('https://cdn.example.com/g2.jpg');
        const g3 = makeImg('https://cdn.example.com/g3.jpg');
        const g4 = makeImg('https://cdn.example.com/g4.jpg');
        const g5 = makeImg('https://cdn.example.com/g5.jpg');
        const g6 = makeImg('https://cdn.example.com/g6.jpg');
        const g7 = makeImg('https://cdn.example.com/g7.jpg');
        const arch1 = makeImg('https://cdn.example.com/arch1.jpg');
        const arch2 = makeImg('https://cdn.example.com/arch2.jpg');
        const arch3 = makeImg('https://cdn.example.com/arch3.jpg');

        const media: Media = {
            featuredImage: featured,
            gallery: [g1, g2, g3, g4, g5, g6, g7], // 7 items
            archivedGallery: [arch1, arch2, arch3] // 3 archived
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-m3-01',
            toCap: 10, // total cap = 10; featuredImage occupies 1 → gallery target = 9
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // 9 - 7 = 2 items should be restored
        expect(result.movedCount).toBe(2);
        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(9);
        expect(written.archivedGallery).toHaveLength(1);
        // Total (gallery + archived, excluding featuredImage) conserved: 7+3 = 10 total, now 9+1
        expect((written.gallery?.length ?? 0) + (written.archivedGallery?.length ?? 0)).toBe(10);
    });

    it('toCap without featuredImage: gallery target = toCap (no reservation)', async () => {
        // cap = 10, no featuredImage → galleryTarget = 10
        // gallery currently has 7 → needed = 3 → move 3 from archived
        const g1 = makeImg('https://cdn.example.com/nf-g1.jpg');
        const g2 = makeImg('https://cdn.example.com/nf-g2.jpg');
        const g3 = makeImg('https://cdn.example.com/nf-g3.jpg');
        const g4 = makeImg('https://cdn.example.com/nf-g4.jpg');
        const g5 = makeImg('https://cdn.example.com/nf-g5.jpg');
        const g6 = makeImg('https://cdn.example.com/nf-g6.jpg');
        const g7 = makeImg('https://cdn.example.com/nf-g7.jpg');
        const arch1 = makeImg('https://cdn.example.com/nf-arch1.jpg');
        const arch2 = makeImg('https://cdn.example.com/nf-arch2.jpg');
        const arch3 = makeImg('https://cdn.example.com/nf-arch3.jpg');

        const media: Media = {
            // No featuredImage
            gallery: [g1, g2, g3, g4, g5, g6, g7], // 7 items
            archivedGallery: [arch1, arch2, arch3] // 3 archived
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-m3-02',
            toCap: 10, // total cap = 10; no featuredImage → gallery target = 10
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // 10 - 7 = 3 items should be restored
        expect(result.movedCount).toBe(3);
        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(10);
        expect(written.archivedGallery).toHaveLength(0);
    });

    it('toCap with featuredImage already at gallery target: no-op', async () => {
        // cap = 10, featuredImage present → galleryTarget = 9
        // gallery already has 9 → needed = 0 → no-op
        const featured = makeImg('https://cdn.example.com/feat2.jpg');
        const archived = makeImg('https://cdn.example.com/archived2.jpg');
        const gallery = Array.from({ length: 9 }, (_, i) =>
            makeImg(`https://cdn.example.com/g${i}.jpg`)
        );

        const media: Media = {
            featuredImage: featured,
            gallery, // 9 items — at effective gallery cap
            archivedGallery: [archived]
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-m3-03',
            toCap: 10, // featuredImage present → galleryTarget = 9 → already met
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        // No DB write (no-op)
        expect(tx.setPayload).toBeNull();
    });

    it('toCap with featuredImage and FIFO: first-archived item restored first', async () => {
        // cap = 5, featuredImage → galleryTarget = 4, gallery has 3 → restore 1
        const featured = makeImg('https://cdn.example.com/feat-fifo.jpg');
        const g1 = makeImg('https://cdn.example.com/fifo-g1.jpg');
        const g2 = makeImg('https://cdn.example.com/fifo-g2.jpg');
        const g3 = makeImg('https://cdn.example.com/fifo-g3.jpg');
        const first = makeImg('https://cdn.example.com/fifo-arch-first.jpg');
        const second = makeImg('https://cdn.example.com/fifo-arch-second.jpg');

        const media: Media = {
            featuredImage: featured,
            gallery: [g1, g2, g3], // 3 items
            archivedGallery: [first, second] // 2 archived — only 1 needed
        };
        const tx = makeFakeTx({ selectRows: [{ media }] });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-m3-04',
            toCap: 5, // featuredImage → galleryTarget = 4; gallery = 3 → restore 1
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(1);
        const written = tx.setPayload as Media;
        expect(written.gallery).toHaveLength(4);
        // FIFO: `first` (head of archive) is the one restored
        expect(written.gallery?.[3]).toStrictEqual(first);
        // `second` stays in archive
        expect(written.archivedGallery).toHaveLength(1);
        expect(written.archivedGallery?.[0]).toStrictEqual(second);
    });
});
