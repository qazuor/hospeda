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
 *
 * ## The fake models the MODEL, not the port (HOS-803 I-5)
 *
 * It exposes `findAll` / `create` / `update` / `softDelete` with
 * `BaseModelImpl`'s exact semantics — in particular `softDelete` stamps
 * `deletedAt`/`updatedAt`/`deletedById` and touches NOTHING else — and the port
 * under test is the real `buildOwnedMediaFeaturedPort` built over it.
 *
 * The earlier version hand-wrote a fake port whose delete helper cleared
 * `isFeatured` as well as stamping `deletedAt`. Production did not do that, and
 * the divergence was invisible to every cap assertion because the counts came
 * out the same. It also made C-1 unthinkable from inside this file: the fake
 * described a world where a deleted row could not still be flagged as the
 * cover, which is precisely the row the attack re-featured. A fake kinder than
 * production hides the bugs production has.
 */

import type { DrizzleClient } from '@repo/db';
import { describe, expect, it, vi } from 'vitest';
import {
    addFeaturedMediaRow,
    type FeaturedMediaPort
} from '../../../src/services/media/add-featured-media';
import { buildOwnedMediaFeaturedPort } from '../../../src/services/media/owned-media-featured-port';
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

const OWNER_ID = 'owner-1';

type FakeRow = {
    id: string;
    /** The owning FK — the real port filters every read on it. */
    accommodationId: string;
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
                accommodationId: OWNER_ID,
                isFeatured: false,
                state: 'visible',
                sortOrder: i,
                deletedAt: null
            });
        }
        if (withCover) {
            this.rows.push({
                id: 'cover-0',
                accommodationId: OWNER_ID,
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

    /**
     * A model with `BaseModelImpl` semantics. Nothing here is more helpful than
     * the real thing — see the note at the top of the file.
     */
    model() {
        return {
            findAll: async (where: Record<string, unknown>) => {
                const items = this.rows
                    .filter((r) =>
                        Object.entries(where).every(([k, v]) =>
                            v === null
                                ? (r as Record<string, unknown>)[k] === null
                                : (r as Record<string, unknown>)[k] === v
                        )
                    )
                    .sort((a, b) => b.sortOrder - a.sortOrder);
                return { items, total: items.length };
            },
            create: async (data: Record<string, unknown>) => {
                this.writes.push('create');
                this.nextId += 1;
                const row: FakeRow = {
                    id: `new-${this.nextId}`,
                    accommodationId: data.accommodationId as string,
                    isFeatured: data.isFeatured === true,
                    state: (data.state as 'visible' | 'archived') ?? 'visible',
                    sortOrder: data.sortOrder as number,
                    deletedAt: null
                };
                this.rows.push(row);
                return row;
            },
            update: async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
                this.writes.push('update');
                const row = this.rows.find((r) => r.id === where.id);
                if (row) Object.assign(row, patch);
                return row ?? null;
            },
            /**
             * EXACTLY BaseModelImpl.softDelete: timestamps and actor only. It
             * does NOT clear `isFeatured` and does NOT move `state`.
             */
            softDelete: async (where: Record<string, unknown>) => {
                this.writes.push('softDelete');
                const row = this.rows.find((r) => r.id === where.id);
                if (!row) return 0;
                row.deletedAt = new Date();
                return 1;
            }
        };
    }

    /** The REAL port, over the faithful model. */
    port(): FeaturedMediaPort<FakeRow> {
        return buildOwnedMediaFeaturedPort<FakeRow>({
            mediaModel: this.model() as never,
            ownerKey: 'accommodationId',
            ownerId: OWNER_ID,
            media: { url: 'https://cdn.example.com/new.jpg' },
            findFeatured: async () =>
                this.rows.find((r) => r.isFeatured && r.deletedAt === null) ?? null,
            deletedById: 'actor-1'
        });
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

    it('soft-deletes the cover it replaces, and clears its featured flag', async () => {
        const table = new FakeMediaTable(3, true);

        const result = await addFeaturedMediaRow({ port: table.port() });

        const old = table.rows.find((r) => r.id === 'cover-0');
        expect(old?.deletedAt).toBeInstanceOf(Date);
        // C-1: `softDelete` does not clear this, and a deleted row that still
        // claims to be the cover can be re-featured through setFeaturedMedia.
        expect(old?.isFeatured).toBe(false);
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

        // Two writes release the old cover before the insert: the flag is
        // cleared, then the row is soft-deleted. `softDelete` alone would leave
        // it flagged (HOS-803 C-1), and inserting first would leave two live
        // featured rows for an instant, which the partial unique index rejects.
        expect(table.writes).toEqual(['update', 'softDelete', 'create']);
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
                // Demote only: flag cleared, row left alive in the gallery.
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
