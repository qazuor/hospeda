/**
 * @file accommodationReviewReply.model.test.ts
 * @description Unit tests for `AccommodationReviewReplyModel.findAdminList`
 * (HOS-2675).
 *
 * The query is mocked, so these tests do not prove the SQL selects the right
 * rows. What they pin is the wiring with no other guard: the page and the
 * count are filtered by the very same condition object (two separately built
 * WHEREs make `total` count a different set than the rows it paginates), the
 * ordering carries its tiebreak, and pagination arithmetic is right.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { AccommodationReviewReplyModel } from '../../src/models/accommodation/accommodationReviewReply.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

interface ReplyRow {
    readonly id: string;
    readonly reviewId: string;
    readonly content: string;
    readonly moderationState: 'PENDING' | 'APPROVED' | 'REJECTED';
    readonly moderationReason: string | null;
    readonly moderatedAt: Date | null;
    readonly createdAt: Date;
    readonly editedAt: Date | null;
    readonly accommodationId: string;
    readonly reviewTitle: string | null;
    readonly reviewContent: string | null;
    readonly reviewAverageRating: number;
    readonly reviewerDisplayName: string | null;
    readonly reviewerFirstName: string | null;
    readonly reviewerLastName: string | null;
}

interface RecordedCalls {
    pageWhere: unknown[];
    countWhere: unknown[];
    orderBy: unknown[][];
    limit: unknown[];
    offset: unknown[];
    selectProjections: unknown[];
}

/**
 * Builds a db double whose first `select()` serves the page query and whose
 * second serves the count query, recording what each was given.
 */
function createDbDouble(rows: ReplyRow[], total: number) {
    const recorded: RecordedCalls = {
        pageWhere: [],
        countWhere: [],
        orderBy: [],
        limit: [],
        offset: [],
        selectProjections: []
    };
    let selectCall = 0;

    const pageWhere = (clause: unknown) => {
        recorded.pageWhere.push(clause);
        return {
            orderBy: vi.fn((...args: unknown[]) => {
                recorded.orderBy.push(args);
                return {
                    limit: vi.fn((value: unknown) => {
                        recorded.limit.push(value);
                        return {
                            offset: vi.fn((value2: unknown) => {
                                recorded.offset.push(value2);
                                return Promise.resolve(rows);
                            })
                        };
                    })
                };
            })
        };
    };
    const countWhere = (clause: unknown) => {
        recorded.countWhere.push(clause);
        return Promise.resolve([{ value: total }]);
    };

    const db = {
        select: vi.fn((projection?: unknown) => {
            selectCall += 1;
            recorded.selectProjections.push(projection);
            const isPageQuery = selectCall === 1;

            const levelD = { where: vi.fn(pageWhere) };
            const levelC = { leftJoin: vi.fn(() => levelD) };
            const levelB = {
                where: vi.fn(isPageQuery ? pageWhere : countWhere),
                innerJoin: vi.fn(() => levelC)
            };
            const levelA = {
                where: vi.fn(isPageQuery ? pageWhere : countWhere),
                innerJoin: vi.fn(() => levelB)
            };

            return { from: vi.fn(() => levelA) };
        })
    };

    return { db, recorded };
}

const row: ReplyRow = {
    id: 'reply-1',
    reviewId: 'review-1',
    content: 'Gracias por tu visita.',
    moderationState: 'PENDING',
    moderationReason: null,
    moderatedAt: null,
    createdAt: new Date('2026-11-27T10:00:00.000Z'),
    editedAt: null,
    accommodationId: 'accommodation-1',
    reviewTitle: 'Muy buen lugar',
    reviewContent: 'Todo excelente.',
    reviewAverageRating: 4.5,
    reviewerDisplayName: null,
    reviewerFirstName: 'Ana',
    reviewerLastName: 'Pérez'
};

describe('AccommodationReviewReplyModel.findAdminList', () => {
    let model: AccommodationReviewReplyModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new AccommodationReviewReplyModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the rows with the reviewer name composed from first and last name', async () => {
        const { db } = createDbDouble([row], 1);
        getDb.mockReturnValue(db);

        const result = await model.findAdminList({ page: 1, pageSize: 20 });

        expect(result.total).toBe(1);
        expect(result.items[0]?.reviewerName).toBe('Ana Pérez');
        expect(result.items[0]?.reviewTitle).toBe('Muy buen lugar');
    });

    it('prefers the display name when it exists', async () => {
        const { db } = createDbDouble([{ ...row, reviewerDisplayName: 'anita' }], 1);
        getDb.mockReturnValue(db);

        const result = await model.findAdminList({ page: 1, pageSize: 20 });

        expect(result.items[0]?.reviewerName).toBe('anita');
    });

    it('filters the page query and the count query with the SAME condition', async () => {
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        await model.findAdminList({ page: 1, pageSize: 20 });

        expect(recorded.pageWhere).toHaveLength(1);
        expect(recorded.countWhere).toHaveLength(1);
        expect(recorded.countWhere[0]).toBe(recorded.pageWhere[0]);
    });

    it('orders by creation time with an id tiebreak, so pages cannot overlap', async () => {
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        await model.findAdminList({ page: 1, pageSize: 20 });

        expect(recorded.orderBy[0]).toHaveLength(2);
    });

    it('translates page and pageSize into limit and offset', async () => {
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        await model.findAdminList({ page: 3, pageSize: 10 });

        expect(recorded.limit[0]).toBe(10);
        expect(recorded.offset[0]).toBe(20);
    });

    it('asks for page 1 with no offset', async () => {
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        await model.findAdminList({ page: 1, pageSize: 20 });

        expect(recorded.offset[0]).toBe(0);
    });

    it('projects the reply plus its review context and reviewer parts', async () => {
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        await model.findAdminList({ page: 1, pageSize: 20 });

        const keys = Object.keys(recorded.selectProjections[0] as object).sort();
        expect(keys).toEqual(
            [
                'accommodationId',
                'content',
                'createdAt',
                'editedAt',
                'id',
                'moderatedAt',
                'moderationReason',
                'moderationState',
                'reviewAverageRating',
                'reviewContent',
                'reviewId',
                'reviewTitle',
                'reviewerDisplayName',
                'reviewerFirstName',
                'reviewerLastName'
            ].sort()
        );
    });
});
