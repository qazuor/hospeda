/**
 * packages/service-core/test/services/media/add-featured-media.test.ts
 *
 * HOS-803 — the shared primitive, tested against a fake media table rather than
 * through any one vertical's service.
 *
 * ## The rule
 *
 * Uploading a NEW photo into the cover slot creates the row already featured
 * and SOFT-DELETES the cover it replaces, in the same transaction. Always —
 * the quota is not consulted, because there is nothing left for it to decide.
 *
 * That is what makes the operation quota-neutral by construction: one row
 * enters the featured slot, one leaves the table, and the visible gallery is
 * never touched. A cover upload cannot move any cap, which is why it is safe
 * for it to skip the gallery gate that used to refuse it.
 *
 * ## What the earlier design got wrong, and why these tests exist
 *
 * Promotion demotes the previous cover into the gallery. Carrying that
 * behaviour onto the UPLOAD path made every replacement a permanent +1 to the
 * gallery, so repeating it walked past the cap one swap at a time. The atomic
 * create alone did not stop that: the partial unique index constrains the
 * featured row, not the residue it leaves behind.
 *
 * Deletion removes the residue, so the +1 cannot happen. The hundred-swap test
 * below holds that, and its mutation twin proves the hundred swaps are capable
 * of failing.
 *
 * NOTE: this is the UPLOAD path only. Promoting a photo ALREADY in the gallery
 * (`setFeaturedMedia`) still demotes the old cover into the gallery and is
 * deliberately untouched — that exchange is quota-neutral on its own.
 *
 * The fake table holds real rows, so the assertions are about STATE after the
 * call rather than about which mock was called. A gallery that grows by one per
 * swap is invisible to any single-call assertion.
 */

import type { DrizzleClient } from '@repo/db';
import { describe, expect, it, vi } from 'vitest';
import {
    addFeaturedMediaRow,
    type FeaturedMediaPort
} from '../../../src/services/media/add-featured-media';
import { ServiceError } from '../../../src/types';

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ __tx: true }))
    };
});

// ---------------------------------------------------------------------------
// A fake media table, holding real rows.
// ---------------------------------------------------------------------------

type FakeRow = {
    id: string;
    isFeatured: boolean;
    state: 'visible' | 'archived';
    sortOrder: number;
    deletedAt: Date | null;
};

class FakeMediaTable {
    public readonly rows: FakeRow[] = [];
    public readonly writes: string[] = [];
    private nextId = 0;

    constructor(initialGallery: number, withCover: boolean) {
        for (let i = 0; i < initialGallery; i++) {
            this.rows.push({
                id: `gallery-${i}`,
                isFeatured: false,
                state: 'visible',
                sortOrder: i,
                deletedAt: null
            });
        }
        if (withCover) {
            this.rows.push({
                id: 'cover-0',
                isFeatured: true,
                state: 'visible',
                sortOrder: initialGallery,
                deletedAt: null
            });
        }
    }

    /**
     * Visible, non-featured, NOT soft-deleted — what every gallery cap in the
     * codebase measures (`state: 'visible'`, `isFeatured: false`,
     * `deletedAt: null`). The last of those three is what makes the replaced
     * cover free: a count that forgot it would report a cap reached that is not.
     */
    get visibleGalleryCount(): number {
        return this.rows.filter(
            (r) => r.state === 'visible' && !r.isFeatured && r.deletedAt === null
        ).length;
    }

    /** Live covers. A soft-deleted row is not one, whatever its flag says. */
    get featuredCount(): number {
        return this.rows.filter((r) => r.isFeatured && r.deletedAt === null).length;
    }

    get deletedCount(): number {
        return this.rows.filter((r) => r.deletedAt !== null).length;
    }

    port(): FeaturedMediaPort<FakeRow> {
        return {
            findMaxVisibleSortOrder: async () =>
                this.rows
                    .filter((r) => r.state === 'visible' && r.deletedAt === null)
                    .reduce((max, r) => Math.max(max, r.sortOrder), -1),
            findFeatured: async () =>
                this.rows.find((r) => r.isFeatured && r.deletedAt === null) ?? null,
            deletePrevious: async (mediaId) => {
                this.writes.push('delete');
                const row = this.rows.find((r) => r.id === mediaId);
                if (row) {
                    row.isFeatured = false;
                    row.deletedAt = new Date();
                }
            },
            createFeatured: async ({ sortOrder }) => {
                this.writes.push('create');
                this.nextId += 1;
                const row: FakeRow = {
                    id: `new-${this.nextId}`,
                    isFeatured: true,
                    state: 'visible',
                    sortOrder,
                    deletedAt: null
                };
                this.rows.push(row);
                return row;
            }
        };
    }
}

const CAP = 15;

// ---------------------------------------------------------------------------

describe('addFeaturedMediaRow (HOS-803)', () => {
    it('creates a featured row when the gallery is at the cap — the reported bug', async () => {
        const table = new FakeMediaTable(CAP, true);

        const result = await addFeaturedMediaRow({ port: table.port() });

        expect(result.media.isFeatured).toBe(true);
        expect(result.media.state).toBe('visible');
        expect(table.featuredCount).toBe(1);
    });

    it('soft-deletes the cover it replaces', async () => {
        const table = new FakeMediaTable(3, true);

        const result = await addFeaturedMediaRow({ port: table.port() });

        const old = table.rows.find((r) => r.id === 'cover-0');
        expect(old?.deletedAt).toBeInstanceOf(Date);
        expect(result.previousFeatured).toEqual({ id: 'cover-0' });
    });

    it('does NOT move the old cover into the gallery', async () => {
        const table = new FakeMediaTable(3, true);

        await addFeaturedMediaRow({ port: table.port() });

        // Demoting it here is what made every replacement a permanent +1.
        // Uploading a new cover leaves the gallery exactly as it found it.
        expect(table.visibleGalleryCount).toBe(3);
    });

    it('deletes the old cover even when the gallery has plenty of room', async () => {
        const table = new FakeMediaTable(0, true);

        await addFeaturedMediaRow({ port: table.port() });

        // The rule is unconditional: an empty gallery does not earn the old
        // cover a reprieve, because the disposition no longer depends on space.
        expect(table.rows.find((r) => r.id === 'cover-0')?.deletedAt).toBeInstanceOf(Date);
        expect(table.visibleGalleryCount).toBe(0);
    });

    it('reports no previous cover when the entity had none', async () => {
        const table = new FakeMediaTable(3, false);

        const result = await addFeaturedMediaRow({ port: table.port() });

        expect(result.previousFeatured).toBeNull();
        expect(table.writes).toEqual(['create']);
        expect(table.deletedCount).toBe(0);
    });

    it('releases the old cover before inserting the new one', async () => {
        const table = new FakeMediaTable(3, true);

        await addFeaturedMediaRow({ port: table.port() });

        // Reversing this order leaves two live featured rows for an instant,
        // which the partial unique index rejects.
        expect(table.writes).toEqual(['delete', 'create']);
    });

    it('appends the new row rather than colliding with an existing sortOrder', async () => {
        // Gallery holds 0,1,2 and the outgoing cover holds 3. The cover is
        // released BEFORE the position is read, so the highest LIVE sortOrder
        // is 2 and the new cover takes 3 — reusing the slot the deleted row
        // vacated, and colliding with none of the gallery rows.
        const table = new FakeMediaTable(3, true);

        const result = await addFeaturedMediaRow({ port: table.port() });

        expect(result.media.sortOrder).toBe(3);
        const live = table.rows.filter((r) => r.deletedAt === null).map((r) => r.sortOrder);
        expect(new Set(live).size).toBe(live.length);
    });

    it('refuses when the plan grants no photos', async () => {
        const table = new FakeMediaTable(0, false);

        await expect(
            addFeaturedMediaRow({ port: table.port(), planGalleryCap: 0 })
        ).rejects.toBeInstanceOf(ServiceError);

        expect(table.writes).toEqual([]);
    });

    it('does not refuse a plan allowance that merely happens to be full', async () => {
        const table = new FakeMediaTable(CAP, true);

        // A full allowance is not a reason to refuse: the swap moves the
        // gallery by zero, so there is nothing for the allowance to protect.
        const result = await addFeaturedMediaRow({
            port: table.port(),
            planGalleryCap: CAP
        });

        expect(result.media.isFeatured).toBe(true);
        expect(table.visibleGalleryCount).toBe(CAP);
    });

    it('joins a caller-supplied transaction instead of opening one', async () => {
        const { withTransaction } = await import('@repo/db');
        const table = new FakeMediaTable(1, false);

        // Delta, not absolute: `withTransaction` is a module-level mock shared
        // with every earlier test in this file.
        const before = vi.mocked(withTransaction).mock.calls.length;

        const result = await addFeaturedMediaRow({
            port: table.port(),
            tx: { __outer: true } as unknown as DrizzleClient
        });

        expect(vi.mocked(withTransaction).mock.calls.length).toBe(before);
        expect(result.media.isFeatured).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// The evasion this design exists to prevent.
// ---------------------------------------------------------------------------

describe('HOS-803 — the gallery cap survives repeated cover replacement', () => {
    it('holds visible gallery <= cap and exactly one cover across 100 swaps', async () => {
        const table = new FakeMediaTable(CAP, true);

        for (let i = 0; i < 100; i++) {
            await addFeaturedMediaRow({ port: table.port() });

            // Both halves, checked every single time — a violation on swap 3
            // must not be hidden by the state on swap 100.
            expect(table.visibleGalleryCount).toBeLessThanOrEqual(CAP);
            expect(table.featuredCount).toBe(1);
        }

        // Started full and stayed full: 100 covers in, 100 covers out.
        expect(table.visibleGalleryCount).toBe(CAP);
        expect(table.deletedCount).toBe(100);
    });

    it('would exceed the cap if the old cover were demoted instead of deleted', async () => {
        // Guards the guard: proves the loop above is capable of failing, so its
        // green is a result and not an artefact of the fake table.
        //
        // The mutation is the exact mistake the rule forbids — reusing
        // `setFeaturedMedia`'s demote on the UPLOAD path, where nothing leaves
        // the table to balance the row that arrives.
        const table = new FakeMediaTable(CAP, true);
        const port = table.port();
        const demoteInsteadOfDelete: FeaturedMediaPort<FakeRow> = {
            ...port,
            deletePrevious: async (mediaId) => {
                const row = table.rows.find((r) => r.id === mediaId);
                if (row) row.isFeatured = false;
            }
        };

        for (let i = 0; i < 5; i++) {
            await addFeaturedMediaRow({ port: demoteInsteadOfDelete });
        }

        expect(table.visibleGalleryCount).toBeGreaterThan(CAP);
    });
});
