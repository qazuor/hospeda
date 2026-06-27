/**
 * Unit tests for photo archive/restore primitives (SPEC-167 T-009 /
 * SPEC-204 direct cutover).
 *
 * After the SPEC-204 cutover both primitives operate SOLELY on the
 * `accommodation_media` relational table. The JSONB `media` blob is no
 * longer read or written. All test assertions have been updated accordingly.
 *
 * Coverage:
 * - archiveAccommodationPhotos
 *   - keepIds honored: visible non-featured items outside keepIds get archived
 *   - featuredImage never in candidate set
 *   - idempotency: nothing to archive → movedCount=0, no update
 *   - empty keepIds: all visible non-featured items archived
 *   - full keepIds: no-op
 *   - INV-5: visible + archived count conserved
 *   - missing accommodation: throws Error
 *   - empty gallery: no-op
 *
 * - restoreAccommodationPhotos
 *   - restoreCount: exact count restored
 *   - restoreCount >= archived: full restore
 *   - empty archived set: no-op
 *   - toCap: restores to fill gallery cap
 *   - toCap already met: no-op
 *   - toCap with featuredImage: gallery target = toCap - 1
 *   - FIFO by archivedAt: oldest restored first
 *   - INV-5: total count conserved
 *   - missing accommodation: throws Error
 *   - neither restoreCount nor toCap: throws Error
 *
 * - FOR UPDATE row lock (M-1 regression)
 *
 * Testing strategy:
 * The SUT uses `withTransaction` from @repo/db. We mock the whole `@repo/db`
 * module so `withTransaction` becomes a pass-through. Each test builds a
 * `FakeTx` that receives a pre-configured sequence of SELECT results (one per
 * `.where()` / `.orderBy()` call) and records every `.update().set().where()`
 * call for assertions.
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

vi.mock('@repo/db', () => {
    const accommodations = { id: 'id', deletedAt: 'deleted_at' };

    const accommodationMedia = {
        accommodationId: 'accommodation_id',
        url: 'url',
        state: 'state',
        isFeatured: 'is_featured',
        sortOrder: 'sort_order',
        archivedAt: 'archived_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    };

    const sql = Object.assign(
        (strings: TemplateStringsArray, ...values: unknown[]) => ({
            __sql: strings.raw.join('?'),
            values
        }),
        { raw: (s: string) => s }
    );

    const max = (_col: unknown) => ({ __max: true });

    return {
        accommodations,
        accommodationMedia,
        sql,
        max,
        eq: vi.fn((_col: unknown, _val: unknown) => ({ __eq: true })),
        isNull: vi.fn((_col: unknown) => ({ __isNull: true })),
        inArray: vi.fn((_col: unknown, _vals: unknown) => ({ __inArray: true })),
        and: vi.fn((...args: unknown[]) => ({ __and: args })),
        asc: vi.fn((_col: unknown) => ({ __asc: true })),
        withTransaction: vi.fn(
            async (cb: (tx: unknown) => Promise<unknown>, existingTx?: unknown) => cb(existingTx)
        )
    };
});

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import {
    archiveAccommodationPhotos,
    restoreAccommodationPhotos
} from '../../src/services/plan-photo-restriction.service';

// ---------------------------------------------------------------------------
// FakeTx
//
// Design: callers pre-configure a queue of SELECT result arrays (one slot per
// expected `.where()` call in the SUT). Each `.where()` on a SELECT chain
// pops the next slot and returns a `SelectResult` — an ordinary array extended
// with an `.orderBy()` method. Because a plain array is NOT thenable, biome's
// `noThenProperty` rule is satisfied and `await selectResult` resolves to the
// array itself (JS awaiting a non-promise yields the value directly). When the
// SUT chains `.orderBy()` it receives the same rows (the fixture is
// pre-sorted since the fake cannot apply real archivedAt ordering).
//
// UPDATE calls are captured via `.set()` → `.where()` chain, flagged by
// `_inUpdate`.
// ---------------------------------------------------------------------------

interface UpdateCapture {
    /** The payload passed to .set(). */
    readonly payload: Record<string, unknown>;
}

interface FakeTxConfig {
    /** Whether execute() returns a found row (lock acquired). Default true. */
    readonly accommodationExists?: boolean;
    /**
     * Ordered list of SELECT results. Each slot maps to one `.where()` call
     * on a SELECT chain (not UPDATE chains). The same slot's rows are reused
     * by a subsequent `.orderBy()` call if the SUT chains them.
     */
    readonly selectResults: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>;
}

/** Array of rows returned by a SELECT `.where()` with an `.orderBy()` method attached. */
type SelectResult = Array<Record<string, unknown>> & {
    orderBy: (_expr: unknown) => Promise<Array<Record<string, unknown>>>;
};

interface FakeTx {
    executeCalled: boolean;
    updateCaptures: UpdateCapture[];
    readonly execute: (_sql: unknown) => Promise<{ rows: Array<{ id: string }> }>;
    readonly select: (_cols: unknown) => FakeTx;
    readonly from: (_table: unknown) => FakeTx;
    readonly where: (_cond: unknown) => SelectResult | Promise<undefined[]>;
    readonly update: (_table: unknown) => FakeTx;
    readonly set: (_payload: unknown) => FakeTx;
    readonly groupBy: (_col: unknown) => FakeTx;
    readonly having: (_expr: unknown) => Promise<Array<Record<string, unknown>>>;
}

function makeFakeTx(config: FakeTxConfig): FakeTx {
    const { accommodationExists = true, selectResults } = config;
    let selectIdx = 0;
    let inUpdate = false;
    let currentPayload: Record<string, unknown> = {};

    /** Builds a SelectResult: an array that also carries an `.orderBy()` method. */
    function makeSelectResult(rows: ReadonlyArray<Record<string, unknown>>): SelectResult {
        const arr: SelectResult = [...rows] as SelectResult;
        arr.orderBy = (_expr: unknown) => Promise.resolve([...rows]);
        return arr;
    }

    const tx: FakeTx = {
        executeCalled: false,
        updateCaptures: [],

        async execute(_sql: unknown) {
            tx.executeCalled = true;
            if (!accommodationExists) return { rows: [] };
            return { rows: [{ id: 'acc-fake-id' }] };
        },

        select(_cols: unknown) {
            inUpdate = false;
            return tx;
        },

        from(_table: unknown) {
            return tx;
        },

        where(_cond: unknown) {
            if (inUpdate) {
                (tx as { updateCaptures: UpdateCapture[] }).updateCaptures.push({
                    payload: { ...currentPayload }
                });
                currentPayload = {};
                inUpdate = false;
                // Update-terminating where() returns a Promise<undefined[]>
                return Promise.resolve([]) as Promise<undefined[]>;
            }
            // SELECT chain: pop the next result slot and return a SelectResult.
            // The SUT can either `await` the SelectResult directly (resolves to the
            // array) or chain `.orderBy()` on it (resolves to the same rows).
            const rows = selectResults[selectIdx] ?? [];
            selectIdx++;
            return makeSelectResult(rows);
        },

        update(_table: unknown) {
            inUpdate = true;
            return tx;
        },

        set(payload: unknown) {
            currentPayload = payload as Record<string, unknown>;
            return tx;
        },

        groupBy(_col: unknown) {
            return tx;
        },

        having(_expr: unknown) {
            const result = [...(selectResults[selectIdx] ?? [])];
            selectIdx++;
            return Promise.resolve(result);
        }
    };

    return tx;
}

// ---------------------------------------------------------------------------
// MediaRow fixture helpers
// ---------------------------------------------------------------------------

interface MediaRow extends Record<string, unknown> {
    url: string;
    state: 'visible' | 'archived';
    isFeatured: boolean;
    sortOrder: number;
    archivedAt: Date | null;
    deletedAt: null;
}

function makeVisible(url: string, sortOrder: number, isFeatured = false): MediaRow {
    return { url, state: 'visible', isFeatured, sortOrder, archivedAt: null, deletedAt: null };
}

function makeArchived(url: string, archivedAt: Date): MediaRow {
    return { url, state: 'archived', isFeatured: false, sortOrder: 0, archivedAt, deletedAt: null };
}

function makeMaxSortOrder(maxOrder: number | null): Record<string, unknown> {
    return { maxOrder };
}

// ---------------------------------------------------------------------------
// archiveAccommodationPhotos
//
// SUT SELECT call order:
//   call 0: visible non-featured rows  → selectResults[0]
//   call 1: archived rows (count)      → selectResults[1]
// If movedCount > 0: one update call follows.
// ---------------------------------------------------------------------------

describe('plan-photo-restriction.service — archiveAccommodationPhotos (SPEC-204 cutover)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.clearAllMocks());

    it('keepIds honored: items outside keepIds get archived', async () => {
        const url1 = 'https://cdn.example.com/1.jpg';
        const url2 = 'https://cdn.example.com/2.jpg';
        const url3 = 'https://cdn.example.com/3.jpg';

        const tx = makeFakeTx({
            selectResults: [
                // call 0: visible non-featured
                [makeVisible(url1, 0), makeVisible(url2, 1), makeVisible(url3, 2)],
                // call 1: existing archived count
                []
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-01',
            keepIds: new Set([url1, url3]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // url2 archived
        expect(result.movedCount).toBe(1);
        expect(result.totalCount).toBe(3); // 2 visible + 1 archived
        // One update call (the archive flip)
        const archiveUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'archived');
        expect(archiveUpdates.length).toBe(1);
        expect(tx.executeCalled).toBe(true);
    });

    it('empty keepIds: all visible non-featured items archived', async () => {
        const url1 = 'https://cdn.example.com/a.jpg';
        const url2 = 'https://cdn.example.com/b.jpg';

        const tx = makeFakeTx({
            selectResults: [
                [makeVisible(url1, 0), makeVisible(url2, 1)],
                [] // no prior archived
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-02',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(2);
        const archiveUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'archived');
        expect(archiveUpdates.length).toBe(1);
    });

    it('full keepIds: no-op, movedCount=0, no update call', async () => {
        const url1 = 'https://cdn.example.com/1.jpg';
        const url2 = 'https://cdn.example.com/2.jpg';

        const tx = makeFakeTx({
            selectResults: [
                [makeVisible(url1, 0), makeVisible(url2, 1)],
                [] // no archived
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-03',
            keepIds: new Set([url1, url2]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(result.totalCount).toBe(2);
        const archiveUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'archived');
        expect(archiveUpdates.length).toBe(0);
    });

    it('featuredImage row NOT counted — is_featured=true excluded from candidate set', async () => {
        // The SUT filters `is_featured=false` in the WHERE clause; our fake
        // models this by only including non-featured rows in selectResults[0].
        const galleryUrl = 'https://cdn.example.com/g1.jpg';

        const tx = makeFakeTx({
            selectResults: [
                // Only gallery row is visible non-featured; featured is excluded
                [makeVisible(galleryUrl, 1, false)],
                []
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-04',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(1);
    });

    it('INV-5: visible + archived count conserved after archive', async () => {
        const url1 = 'https://cdn.example.com/inv5-a.jpg';
        const url2 = 'https://cdn.example.com/inv5-b.jpg';
        const url3 = 'https://cdn.example.com/inv5-c.jpg';
        const existingArchivedUrl = 'https://cdn.example.com/inv5-old.jpg';
        const oldArchivedAt = new Date('2026-01-01T10:00:00Z');

        const tx = makeFakeTx({
            selectResults: [
                // call 0: visible non-featured — 3 items
                [makeVisible(url1, 0), makeVisible(url2, 1), makeVisible(url3, 2)],
                // call 1: existing archived — 1 item
                [makeArchived(existingArchivedUrl, oldArchivedAt)]
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-05',
            keepIds: new Set([url1]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // Pre-op: 3 visible + 1 archived = 4 total
        // After: 1 visible + 3 archived = 4 total
        expect(result.totalCount).toBe(4);
        expect(result.movedCount).toBe(2);
    });

    it('missing accommodation: throws Error with descriptive message', async () => {
        const tx = makeFakeTx({ accommodationExists: false, selectResults: [] });

        await expect(
            archiveAccommodationPhotos({
                accommodationId: 'acc-missing',
                keepIds: new Set<string>(),
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-missing');
    });

    it('empty gallery: no-op (movedCount=0)', async () => {
        const tx = makeFakeTx({
            selectResults: [
                [], // no visible non-featured
                [] // no archived
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-empty',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(result.totalCount).toBe(0);
    });

    it('acquires FOR UPDATE lock before reading media rows (M-1 regression)', async () => {
        const tx = makeFakeTx({
            selectResults: [[makeVisible('https://cdn.example.com/x.jpg', 0)], []]
        });

        await archiveAccommodationPhotos({
            accommodationId: 'acc-lock-01',
            keepIds: new Set<string>(),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(tx.executeCalled).toBe(true);
    });

    it('existing archived items preserved — total count includes them', async () => {
        const keepUrl = 'https://cdn.example.com/keep.jpg';
        const moveUrl = 'https://cdn.example.com/move.jpg';
        const oldArchivedUrl = 'https://cdn.example.com/old-archived.jpg';
        const oldArchivedAt = new Date('2026-01-01T09:00:00Z');

        const tx = makeFakeTx({
            selectResults: [
                // call 0: visible non-featured
                [makeVisible(keepUrl, 0), makeVisible(moveUrl, 1)],
                // call 1: existing archived
                [makeArchived(oldArchivedUrl, oldArchivedAt)]
            ]
        });

        const result = await archiveAccommodationPhotos({
            accommodationId: 'acc-08',
            keepIds: new Set([keepUrl]),
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // After: 1 kept visible + 2 archived (1 existing + 1 new) = 3 total
        expect(result.totalCount).toBe(3);
        expect(result.movedCount).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// restoreAccommodationPhotos
//
// SUT SELECT call order:
//   call 0: featured visible rows (hasFeaturedImage check)  → selectResults[0]
//   call 1: visible non-featured rows (gallery count)       → selectResults[1]
//   orderBy 2: archived rows FIFO                           → selectResults[2]
//   call 3: max(sortOrder) among visible rows               → selectResults[3]
// If count > 0: N update calls (one per restored row).
// ---------------------------------------------------------------------------

describe('plan-photo-restriction.service — restoreAccommodationPhotos (SPEC-204 cutover)', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.clearAllMocks());

    it('restoreCount: exact count restored, movedCount correct', async () => {
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );
        const arch3 = makeArchived(
            'https://cdn.example.com/a3.jpg',
            new Date('2026-01-03T10:00:00Z')
        );
        const vis = makeVisible('https://cdn.example.com/g.jpg', 0);

        const tx = makeFakeTx({
            selectResults: [
                [], // call 0: no featured
                [vis], // call 1: 1 visible gallery item
                [arch1, arch2, arch3], // orderBy 2: archived FIFO
                [makeMaxSortOrder(0)] // call 3: max sortOrder = 0
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-11',
            restoreCount: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        // totalCount = 1 gallery + 2 restored + 1 remaining archived = 4
        expect(result.totalCount).toBe(4);
        expect(tx.executeCalled).toBe(true);
        // Two update calls (one per restored row)
        const restoreUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'visible');
        expect(restoreUpdates.length).toBe(2);
    });

    it('restoreCount >= archived count: full restore', async () => {
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );

        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [], // no visible gallery
                [arch1, arch2], // archived FIFO
                [makeMaxSortOrder(null)] // no visible rows → maxOrder=null
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-14',
            restoreCount: 100,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(2);
        const restoreUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'visible');
        expect(restoreUpdates.length).toBe(2);
    });

    it('empty archived set: no-op, movedCount=0, no update calls', async () => {
        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [makeVisible('https://cdn.example.com/g.jpg', 0)], // 1 visible
                [] // no archived → orderBy returns empty
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-15',
            restoreCount: 5,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(tx.updateCaptures.length).toBe(0);
    });

    it('toCap: restores enough items to reach cap (no featured image)', async () => {
        const vis1 = makeVisible('https://cdn.example.com/g1.jpg', 0);
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );
        const arch3 = makeArchived(
            'https://cdn.example.com/a3.jpg',
            new Date('2026-01-03T10:00:00Z')
        );

        // gallery=1, cap=3, no featured → galleryTarget=3, needed=2
        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [vis1], // 1 visible gallery item
                [arch1, arch2, arch3], // archived FIFO
                [makeMaxSortOrder(0)] // maxOrder=0
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-12',
            toCap: 3,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(4);
    });

    it('toCap already met: no-op, movedCount=0', async () => {
        const vis1 = makeVisible('https://cdn.example.com/g1.jpg', 0);
        const vis2 = makeVisible('https://cdn.example.com/g2.jpg', 1);
        const arch = makeArchived(
            'https://cdn.example.com/a.jpg',
            new Date('2026-01-01T10:00:00Z')
        );

        // gallery=2, cap=2, no featured → needed=0
        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [vis1, vis2], // 2 visible gallery items
                [arch] // archived (not reached if count=0)
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-13',
            toCap: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(0);
        expect(tx.updateCaptures.length).toBe(0);
    });

    it('toCap with featuredImage: gallery target = toCap - 1 (M-3)', async () => {
        const featured = makeVisible('https://cdn.example.com/feat.jpg', 0, true);
        const vis1 = makeVisible('https://cdn.example.com/g1.jpg', 1);
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );
        const arch3 = makeArchived(
            'https://cdn.example.com/a3.jpg',
            new Date('2026-01-03T10:00:00Z')
        );

        // cap=4, featured present → galleryTarget=3, gallery=1 → need 2
        const tx = makeFakeTx({
            selectResults: [
                [featured], // call 0: has featured → hasFeaturedImage=true
                [vis1], // call 1: 1 visible gallery item
                [arch1, arch2, arch3], // orderBy 2: archived FIFO
                [makeMaxSortOrder(1)] // max sortOrder among visible
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-m3-01',
            toCap: 4,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // galleryTarget = 4 - 1 = 3; gallery has 1 → need 2
        expect(result.movedCount).toBe(2);
        expect(result.totalCount).toBe(4); // 1 + 2 + 1 remaining archived
    });

    it('toCap without featuredImage: gallery target = toCap', async () => {
        const vis1 = makeVisible('https://cdn.example.com/g1.jpg', 0);
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );
        const arch3 = makeArchived(
            'https://cdn.example.com/a3.jpg',
            new Date('2026-01-03T10:00:00Z')
        );

        // cap=4, no featured → galleryTarget=4, gallery=1 → need 3
        const tx = makeFakeTx({
            selectResults: [
                [], // call 0: no featured
                [vis1], // call 1: 1 visible gallery item
                [arch1, arch2, arch3], // orderBy 2: archived FIFO
                [makeMaxSortOrder(0)] // max sortOrder
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-m3-02',
            toCap: 4,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(3);
    });

    it('FIFO order: sortOrder assigned in ascending archivedAt sequence', async () => {
        // We verify that sortOrder in updateCaptures increments correctly
        const arch1 = makeArchived(
            'https://cdn.example.com/oldest.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/middle.jpg',
            new Date('2026-01-02T10:00:00Z')
        );
        const arch3 = makeArchived(
            'https://cdn.example.com/newest.jpg',
            new Date('2026-01-03T10:00:00Z')
        );

        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [], // no visible gallery
                [arch1, arch2, arch3], // archived FIFO (oldest first)
                [makeMaxSortOrder(null)] // no visible items yet
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-fifo',
            restoreCount: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(result.movedCount).toBe(2);
        const restoreUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'visible');
        // sortOrder for the two restored rows: 0 and 1 (currentMaxSortOrder=-1, +1+i)
        const sortOrders = restoreUpdates.map((c) => c.payload.sortOrder as number);
        expect(sortOrders).toEqual([0, 1]);
        // archivedAt must be cleared
        expect(restoreUpdates[0]?.payload.archivedAt).toBeNull();
        expect(restoreUpdates[1]?.payload.archivedAt).toBeNull();
    });

    it('sortOrder appended after current max visible sortOrder', async () => {
        const vis1 = makeVisible('https://cdn.example.com/g1.jpg', 5);
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );

        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [vis1], // 1 visible gallery (sortOrder=5)
                [arch1, arch2], // archived FIFO
                [makeMaxSortOrder(5)] // current max visible sortOrder = 5
            ]
        });

        await restoreAccommodationPhotos({
            accommodationId: 'acc-sort',
            restoreCount: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        const restoreUpdates = tx.updateCaptures.filter((c) => c.payload.state === 'visible');
        const sortOrders = restoreUpdates.map((c) => c.payload.sortOrder as number);
        // Restored items get sortOrder = 5+1+0=6 and 5+1+1=7
        expect(sortOrders).toEqual([6, 7]);
    });

    it('INV-5: visible + archived count conserved after restore', async () => {
        const vis = makeVisible('https://cdn.example.com/g.jpg', 0);
        const arch1 = makeArchived(
            'https://cdn.example.com/a1.jpg',
            new Date('2026-01-01T10:00:00Z')
        );
        const arch2 = makeArchived(
            'https://cdn.example.com/a2.jpg',
            new Date('2026-01-02T10:00:00Z')
        );
        const arch3 = makeArchived(
            'https://cdn.example.com/a3.jpg',
            new Date('2026-01-03T10:00:00Z')
        );

        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [vis], // 1 visible gallery item
                [arch1, arch2, arch3], // 3 archived
                [makeMaxSortOrder(0)] // max sortOrder
            ]
        });

        const result = await restoreAccommodationPhotos({
            accommodationId: 'acc-inv5',
            restoreCount: 2,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        // Pre-op: 1 visible + 3 archived = 4
        // After:  3 visible + 1 archived = 4
        expect(result.totalCount).toBe(4);
    });

    it('missing accommodation: throws Error with descriptive message', async () => {
        const tx = makeFakeTx({ accommodationExists: false, selectResults: [] });

        await expect(
            restoreAccommodationPhotos({
                accommodationId: 'acc-missing-restore',
                restoreCount: 1,
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-missing-restore');
    });

    it('neither restoreCount nor toCap: throws Error', async () => {
        const tx = makeFakeTx({
            selectResults: [[], [makeVisible('https://cdn.example.com/g.jpg', 0)], [], []]
        });

        await expect(
            restoreAccommodationPhotos({
                accommodationId: 'acc-17',
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('restoreAccommodationPhotos');
    });

    it('acquires FOR UPDATE lock before reading media rows (M-1 regression)', async () => {
        const arch1 = makeArchived(
            'https://cdn.example.com/a.jpg',
            new Date('2026-01-01T10:00:00Z')
        );

        const tx = makeFakeTx({
            selectResults: [
                [], // no featured
                [], // no visible gallery
                [arch1], // 1 archived
                [makeMaxSortOrder(null)]
            ]
        });

        await restoreAccommodationPhotos({
            accommodationId: 'acc-lock-restore',
            restoreCount: 1,
            db: tx as unknown as import('@repo/db').DrizzleClient
        });

        expect(tx.executeCalled).toBe(true);
    });

    it('throws when accommodation not found — locked row absent (M-1 regression)', async () => {
        const tx = makeFakeTx({ accommodationExists: false, selectResults: [] });

        await expect(
            restoreAccommodationPhotos({
                accommodationId: 'acc-not-found-lock-restore',
                restoreCount: 1,
                db: tx as unknown as import('@repo/db').DrizzleClient
            })
        ).rejects.toThrow('acc-not-found-lock-restore');
    });
});
