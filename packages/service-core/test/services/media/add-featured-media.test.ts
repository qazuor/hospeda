/**
 * packages/service-core/test/services/media/add-featured-media.test.ts
 *
 * HOS-803 — the shared primitive, tested against a fake media table rather than
 * through any one vertical's service.
 *
 * The fake keeps real rows in an array, so the assertions are about STATE after
 * the call ("how many visible gallery rows are there now", "how many rows carry
 * is_featured") rather than about which mock was called with what. That is the
 * only way to catch the failure this primitive exists to prevent: the gallery
 * growing by one on every cover replacement, which no single-call assertion
 * would notice.
 */

import type { DrizzleClient } from '@repo/db';
import { describe, expect, it, vi } from 'vitest';
import {
    addFeaturedMediaRow,
    type FeaturedMediaPort,
    resolveEffectiveGalleryCap
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
                sortOrder: i
            });
        }
        if (withCover) {
            this.rows.push({
                id: 'cover-0',
                isFeatured: true,
                state: 'visible',
                sortOrder: initialGallery
            });
        }
    }

    /** Visible, non-featured, i.e. what the gallery cap measures (HOS-791). */
    get visibleGalleryCount(): number {
        return this.rows.filter((r) => r.state === 'visible' && !r.isFeatured).length;
    }

    get featuredCount(): number {
        return this.rows.filter((r) => r.isFeatured).length;
    }

    port(): FeaturedMediaPort<FakeRow> {
        return {
            countVisibleGallery: async () => this.visibleGalleryCount,
            findMaxVisibleSortOrder: async () =>
                this.rows
                    .filter((r) => r.state === 'visible')
                    .reduce((max, r) => Math.max(max, r.sortOrder), -1),
            findFeatured: async () => this.rows.find((r) => r.isFeatured) ?? null,
            demote: async (mediaId) => {
                this.writes.push('demote');
                const row = this.rows.find((r) => r.id === mediaId);
                if (row) row.isFeatured = false;
            },
            archive: async (mediaId) => {
                this.writes.push('archive');
                const row = this.rows.find((r) => r.id === mediaId);
                if (row) {
                    // One write, both columns — the CHECK constraint forbids a
                    // row that is featured and archived at once.
                    row.isFeatured = false;
                    row.state = 'archived';
                }
            },
            createFeatured: async ({ sortOrder }) => {
                this.writes.push('create');
                this.nextId += 1;
                const row: FakeRow = {
                    id: `new-${this.nextId}`,
                    isFeatured: true,
                    state: 'visible',
                    sortOrder
                };
                this.rows.push(row);
                return row;
            }
        };
    }
}

const CAP = 15;

// ---------------------------------------------------------------------------

describe('resolveEffectiveGalleryCap', () => {
    it('takes the tighter of the two caps', () => {
        expect(resolveEffectiveGalleryCap({ entityGalleryCap: 50, planGalleryCap: 15 })).toBe(15);
        expect(resolveEffectiveGalleryCap({ entityGalleryCap: 10, planGalleryCap: 30 })).toBe(10);
    });

    it('treats an absent plan cap as unlimited, leaving only the entity cap', () => {
        expect(resolveEffectiveGalleryCap({ entityGalleryCap: 50 })).toBe(50);
        expect(
            resolveEffectiveGalleryCap({ entityGalleryCap: 50, planGalleryCap: undefined })
        ).toBe(50);
    });

    it('treats -1 as unlimited — the entitlement layer spells it that way', () => {
        expect(resolveEffectiveGalleryCap({ entityGalleryCap: 50, planGalleryCap: -1 })).toBe(50);
    });
});

describe('addFeaturedMediaRow (HOS-803)', () => {
    it('creates a featured row when the gallery is at the cap — the reported bug', async () => {
        const table = new FakeMediaTable(CAP, true);

        const result = await addFeaturedMediaRow({
            port: table.port(),
            entityGalleryCap: CAP
        });

        expect(result.media.isFeatured).toBe(true);
        expect(result.media.state).toBe('visible');
        expect(table.featuredCount).toBe(1);
    });

    it('demotes the old cover while the gallery has room', async () => {
        const table = new FakeMediaTable(3, true);

        const result = await addFeaturedMediaRow({
            port: table.port(),
            entityGalleryCap: CAP
        });

        expect(result.previousFeatured).toEqual({ id: 'cover-0', disposition: 'demoted' });
        expect(table.rows.find((r) => r.id === 'cover-0')?.state).toBe('visible');
        expect(table.visibleGalleryCount).toBe(4);
    });

    it('archives the old cover once the gallery is full', async () => {
        const table = new FakeMediaTable(CAP, true);

        const result = await addFeaturedMediaRow({
            port: table.port(),
            entityGalleryCap: CAP
        });

        expect(result.previousFeatured).toEqual({ id: 'cover-0', disposition: 'archived' });
        expect(table.rows.find((r) => r.id === 'cover-0')?.state).toBe('archived');
        // Archiving keeps the count where it was — the whole point.
        expect(table.visibleGalleryCount).toBe(CAP);
    });

    it('reports no previous cover when the entity had none', async () => {
        const table = new FakeMediaTable(3, false);

        const result = await addFeaturedMediaRow({
            port: table.port(),
            entityGalleryCap: CAP
        });

        expect(result.previousFeatured).toBeNull();
        expect(table.writes).toEqual(['create']);
    });

    it('clears the old cover before inserting the new one', async () => {
        const table = new FakeMediaTable(3, true);

        await addFeaturedMediaRow({ port: table.port(), entityGalleryCap: CAP });

        // Reversing this order transiently breaks the partial unique index.
        expect(table.writes).toEqual(['demote', 'create']);
    });

    it('appends the new row rather than colliding with an existing sortOrder', async () => {
        const table = new FakeMediaTable(3, true);

        const result = await addFeaturedMediaRow({ port: table.port(), entityGalleryCap: CAP });

        expect(result.media.sortOrder).toBe(4);
    });

    it('refuses when the plan grants no photos', async () => {
        const table = new FakeMediaTable(0, false);

        await expect(
            addFeaturedMediaRow({
                port: table.port(),
                entityGalleryCap: CAP,
                planGalleryCap: 0
            })
        ).rejects.toBeInstanceOf(ServiceError);

        expect(table.writes).toEqual([]);
    });

    it('lets the plan cap bite before the entity cap', async () => {
        const table = new FakeMediaTable(15, true);

        const result = await addFeaturedMediaRow({
            port: table.port(),
            entityGalleryCap: 50,
            planGalleryCap: 15
        });

        // The entity cap alone would have demoted (15 < 50). The plan cap is
        // what makes this an archive.
        expect(result.previousFeatured?.disposition).toBe('archived');
        expect(table.visibleGalleryCount).toBe(15);
    });

    it('joins a caller-supplied transaction instead of opening one', async () => {
        const { withTransaction } = await import('@repo/db');
        const table = new FakeMediaTable(1, false);

        // Delta, not absolute: `withTransaction` is a module-level mock shared
        // with every earlier test in this file.
        const before = vi.mocked(withTransaction).mock.calls.length;

        const result = await addFeaturedMediaRow({
            port: table.port(),
            entityGalleryCap: CAP,
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
        const table = new FakeMediaTable(CAP - 1, true);

        for (let i = 0; i < 100; i++) {
            await addFeaturedMediaRow({ port: table.port(), entityGalleryCap: CAP });

            // Both halves of the post-condition, checked every single time —
            // a violation on swap 3 must not be hidden by the state on swap 100.
            expect(table.visibleGalleryCount).toBeLessThanOrEqual(CAP);
            expect(table.featuredCount).toBe(1);
        }

        // The first swap had room and demoted; every later one archived.
        expect(table.visibleGalleryCount).toBe(CAP);
        expect(table.rows.filter((r) => r.state === 'archived')).toHaveLength(99);
    });

    it('would have exceeded the cap under a plain always-demote policy', async () => {
        // Guards the guard: proves the loop above is capable of failing, so its
        // green is a real result and not an artefact of the fake table.
        const table = new FakeMediaTable(CAP - 1, true);
        const port = table.port();
        const alwaysDemote: FeaturedMediaPort<FakeRow> = {
            ...port,
            archive: port.demote
        };

        for (let i = 0; i < 5; i++) {
            await addFeaturedMediaRow({ port: alwaysDemote, entityGalleryCap: CAP });
        }

        expect(table.visibleGalleryCount).toBeGreaterThan(CAP);
    });
});
