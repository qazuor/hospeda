/**
 * HOS-2330 (spec §6.5, D-7, AC-C26, AC-C26b) — `readOwnerListingReviews`, the
 * OWNER view of the reviews, next to `readLatestListingReviews`, the PUBLIC one.
 *
 * The review models are replaced at the `@repo/db` boundary by an in-memory
 * table that applies the `where` the way `buildWhereClause` does (equality,
 * `null` as IS NULL, an array as IN, `_gte` / `_lte`), so these tests check
 * what each reader RETURNS over the same seeded rows, not only what it asked.
 *
 * @module test/mcp/tools/review/owner-review-reader
 */

import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const { tables, findAllSpy } = vi.hoisted(() => {
    const tables: Record<'accommodation' | 'venue' | 'experience', Record<string, unknown>[]> = {
        accommodation: [],
        venue: [],
        experience: []
    };
    return { tables, findAllSpy: vi.fn() };
});

/** The columns of a review row a `where` may name. */
const KNOWN_COLUMNS: Record<string, true> = Object.fromEntries(
    [
        'id',
        'accommodationId',
        'venueId',
        'experienceId',
        'userId',
        'averageRating',
        'lifecycleState',
        'moderationState',
        'deletedAt',
        'createdAt'
    ].map((column) => [column, true])
);

/** `buildWhereClause`'s semantics over one row. */
function matches(row: Row, where: Row): boolean {
    return Object.entries(where).every(([key, expected]) => {
        if (expected === undefined) {
            return true;
        }
        const column = key.replace(/_(gte|lte)$/, '');
        if (!(column in KNOWN_COLUMNS)) {
            throw new Error(`the fake model got an unknown where key: ${key}`);
        }
        if (key.endsWith('_gte')) {
            return (row[key.slice(0, -4)] as number | Date) >= (expected as number | Date);
        }
        if (key.endsWith('_lte')) {
            return (row[key.slice(0, -4)] as number | Date) <= (expected as number | Date);
        }
        const actual = row[key];
        if (expected === null) {
            return actual === null || actual === undefined;
        }
        if (Array.isArray(expected)) {
            return expected.includes(actual);
        }
        return actual === expected;
    });
}

function fakeModel(table: keyof typeof tables) {
    return class {
        async findAll(
            where: Row,
            options: { page: number; pageSize: number; sortBy?: string; sortOrder?: string }
        ) {
            findAllSpy(table, where, options);
            const all = tables[table].filter((row) => matches(row, where));
            const sorted = [...all].sort(
                (a, b) =>
                    (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime() ||
                    String(a.id).localeCompare(String(b.id))
            );
            const offset = (options.page - 1) * options.pageSize;
            return { items: sorted.slice(offset, offset + options.pageSize), total: all.length };
        }
        async count(where: Row) {
            return tables[table].filter((row) => matches(row, where)).length;
        }
    };
}

vi.mock('@repo/db', () => ({
    AccommodationReviewModel: fakeModel('accommodation'),
    VenueReviewModel: fakeModel('venue'),
    ExperienceReviewModel: fakeModel('experience')
}));

import { readLatestListingReviews } from '../../../../src/mcp/tools/listing/listing-stats-readers';
import { readOwnerListingReviews } from '../../../../src/mcp/tools/review/owner-review-reader';
import { OWNER_REVIEWS_MAX_WINDOW } from '../../../../src/mcp/tools/review/owner-review-window';

const ACC = 'a0000000-0000-4000-8000-000000000001';
const VEN = 'b0000000-0000-4000-8000-000000000001';
const EXP = 'c0000000-0000-4000-8000-000000000001';

const day = (d: number) => new Date(`2026-11-${String(d).padStart(2, '0')}T12:00:00.000Z`);

let nextId = 0;
const review = (listingColumn: string, listingId: string, overrides: Row = {}): Row => ({
    id: `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
    [listingColumn]: listingId,
    userId: 'user-1',
    title: 'Título',
    content: 'Texto',
    averageRating: 4,
    moderationState: 'APPROVED',
    lifecycleState: 'ACTIVE',
    deletedAt: null,
    createdAt: day(10),
    ...overrides
});

const scopes = [
    { vertical: VerticalEnum.ACCOMMODATION, listingIds: [ACC] },
    { vertical: VerticalEnum.VENUE, listingIds: [VEN] },
    { vertical: VerticalEnum.EXPERIENCE, listingIds: [EXP] }
] as const;

const ownerRead = (overrides: Partial<Parameters<typeof readOwnerListingReviews>[0]> = {}) =>
    readOwnerListingReviews({
        scopes,
        filters: {},
        page: 1,
        pageSize: 20,
        ...overrides
    });

describe('readOwnerListingReviews', () => {
    beforeEach(() => {
        nextId = 0;
        tables.accommodation = [];
        tables.venue = [];
        tables.experience = [];
    });

    afterEach(() => {
        findAllSpy.mockReset();
    });

    it('returns reviews of the three verticals merged, newest first, with the total (AC-C24)', async () => {
        // Arrange
        tables.accommodation = [review('accommodationId', ACC, { createdAt: day(3) })];
        tables.venue = [review('venueId', VEN, { createdAt: day(9) })];
        tables.experience = [review('experienceId', EXP, { createdAt: day(6) })];

        // Act
        const page = await ownerRead();

        // Assert
        expect(page.rows.map((r) => r.vertical)).toEqual([
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE,
            VerticalEnum.ACCOMMODATION
        ]);
        expect(page.total).toBe(3);
        expect(page.rows[0]?.listingId).toBe(VEN);
    });

    it('pages the merged list: page 2 continues where page 1 stopped', async () => {
        // Arrange: 5 reviews with distinct dates across the verticals
        tables.accommodation = [
            review('accommodationId', ACC, { createdAt: day(9) }),
            review('accommodationId', ACC, { createdAt: day(5) }),
            review('accommodationId', ACC, { createdAt: day(1) })
        ];
        tables.venue = [review('venueId', VEN, { createdAt: day(7) })];
        tables.experience = [review('experienceId', EXP, { createdAt: day(3) })];

        // Act
        const first = await ownerRead({ pageSize: 2 });
        const second = await ownerRead({ page: 2, pageSize: 2 });
        const third = await ownerRead({ page: 3, pageSize: 2 });

        // Assert
        const days = (rows: typeof first.rows) => rows.map((r) => r.createdAt.getUTCDate());
        expect(days(first.rows)).toEqual([9, 7]);
        expect(days(second.rows)).toEqual([5, 3]);
        expect(days(third.rows)).toEqual([1]);
        expect(first.total).toBe(5);
    });

    it('returns every moderation state with its state and text, and counts them (AC-C26)', async () => {
        // Arrange
        tables.accommodation = [
            review('accommodationId', ACC, { moderationState: 'APPROVED', content: 'Pública' }),
            review('accommodationId', ACC, { moderationState: 'PENDING', content: 'Pendiente' }),
            review('accommodationId', ACC, { moderationState: 'REJECTED', content: 'Rechazada' })
        ];

        // Act
        const page = await ownerRead();

        // Assert
        expect(page.rows.map((r) => [r.moderationState, r.content]).sort()).toEqual([
            ['APPROVED', 'Pública'],
            ['PENDING', 'Pendiente'],
            ['REJECTED', 'Rechazada']
        ]);
        expect(page.countsByState).toEqual({ APPROVED: 1, PENDING: 1, REJECTED: 1 });
    });

    it('filters by moderation state, and the counts keep showing every state', async () => {
        // Arrange
        tables.accommodation = [
            review('accommodationId', ACC, { moderationState: 'APPROVED' }),
            review('accommodationId', ACC, { moderationState: 'PENDING' }),
            review('accommodationId', ACC, { moderationState: 'REJECTED' })
        ];

        // Act
        const page = await ownerRead({ filters: { moderationState: 'PENDING' } });

        // Assert
        expect(page.rows.map((r) => r.moderationState)).toEqual(['PENDING']);
        expect(page.total).toBe(1);
        expect(page.countsByState).toEqual({ APPROVED: 1, PENDING: 1, REJECTED: 1 });
    });

    it('never returns, nor counts, soft-deleted or non-ACTIVE reviews', async () => {
        // Arrange
        tables.accommodation = [
            review('accommodationId', ACC, { moderationState: 'PENDING' }),
            review('accommodationId', ACC, { deletedAt: day(11), moderationState: 'PENDING' }),
            review('accommodationId', ACC, { deletedAt: day(11), moderationState: 'REJECTED' }),
            review('accommodationId', ACC, {
                lifecycleState: 'ARCHIVED',
                moderationState: 'APPROVED'
            })
        ];

        // Act
        const page = await ownerRead();

        // Assert
        expect(page.rows).toHaveLength(1);
        expect(page.total).toBe(1);
        expect(page.countsByState).toEqual({ APPROVED: 0, PENDING: 1, REJECTED: 0 });
    });

    it('reads only the listings it is given', async () => {
        // Arrange
        tables.accommodation = [
            review('accommodationId', ACC),
            review('accommodationId', 'a9999999-9999-4999-8999-999999999999')
        ];

        // Act
        const page = await ownerRead();

        // Assert
        expect(page.rows.map((r) => r.listingId)).toEqual([ACC]);
        expect(page.total).toBe(1);
    });

    it('skips a vertical with no listings without querying its model', async () => {
        // Arrange
        tables.venue = [review('venueId', VEN)];

        // Act
        const page = await ownerRead({
            scopes: [
                { vertical: VerticalEnum.ACCOMMODATION, listingIds: [] },
                { vertical: VerticalEnum.VENUE, listingIds: [VEN] }
            ]
        });

        // Assert
        expect(page.rows).toHaveLength(1);
        expect(findAllSpy.mock.calls.map((call) => call[0])).toEqual(['venue']);
    });

    it('answers an owner with no listings with an empty page', async () => {
        // Act
        const page = await ownerRead({ scopes: [] });

        // Assert
        expect(page).toEqual({
            rows: [],
            total: 0,
            countsByState: { APPROVED: 0, PENDING: 0, REJECTED: 0 }
        });
    });

    it('combines the rating range and the since filter (AC-C25)', async () => {
        // Arrange
        tables.accommodation = [
            review('accommodationId', ACC, { averageRating: 2, createdAt: day(12) }),
            review('accommodationId', ACC, { averageRating: 4, createdAt: day(12) }),
            review('accommodationId', ACC, { averageRating: 5, createdAt: day(12) }),
            review('accommodationId', ACC, { averageRating: 4, createdAt: day(1) })
        ];

        // Act
        const page = await ownerRead({
            filters: { minRating: 3, maxRating: 4.5, since: day(5) }
        });

        // Assert
        expect(page.rows.map((r) => [r.averageRating, r.createdAt.getUTCDate()])).toEqual([
            [4, 12]
        ]);
        expect(page.total).toBe(1);
        expect(page.countsByState.APPROVED).toBe(1);
    });

    it('rejects a page window beyond what one model read can hold', async () => {
        // Act / Assert
        await expect(
            ownerRead({ page: OWNER_REVIEWS_MAX_WINDOW, pageSize: 2 })
        ).rejects.toBeInstanceOf(RangeError);
        expect(findAllSpy).not.toHaveBeenCalled();
    });

    it('projects the reviewer id for name resolution but no other author data', async () => {
        // Arrange
        tables.venue = [
            review('venueId', VEN, { userId: 'user-9', email: 'x@example.com', image: 'i.png' })
        ];

        // Act
        const [row] = (await ownerRead()).rows;

        // Assert
        expect(Object.keys(row ?? {}).sort()).toEqual([
            'averageRating',
            'content',
            'createdAt',
            'id',
            'listingId',
            'moderationState',
            'reviewerId',
            'title',
            'vertical'
        ]);
        expect(row?.reviewerId).toBe('user-9');
    });
});

describe('the owner and the public readers are separate (AC-C26b)', () => {
    beforeEach(() => {
        nextId = 0;
        tables.accommodation = [
            review('accommodationId', ACC, { moderationState: 'APPROVED', content: 'Pública' }),
            review('accommodationId', ACC, { moderationState: 'PENDING', content: 'Pendiente' }),
            review('accommodationId', ACC, { moderationState: 'REJECTED', content: 'Rechazada' })
        ];
        tables.venue = [];
        tables.experience = [];
    });

    it('shows the owner all three while the public reader still shows only the APPROVED one', async () => {
        // Act
        const owner = await ownerRead();
        const publicRows = await readLatestListingReviews({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: ACC,
            limit: 10
        });

        // Assert
        expect(owner.rows).toHaveLength(3);
        expect(publicRows.map((r) => r.content)).toEqual(['Pública']);
    });
});
