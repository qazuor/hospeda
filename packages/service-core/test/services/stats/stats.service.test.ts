/**
 * Unit tests for `StatsService` — both
 * `getGlobalAccommodationAverageRating` (clamping / empty-set) and
 * `getRecentReviewerAvatars` (avatar precedence, filtering, limit).
 *
 * Mocks the Drizzle client so no real database is required.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    accommodationReviews: {
        lifecycleState: 'lifecycleState',
        deletedAt: 'deletedAt',
        userId: 'userId',
        createdAt: 'createdAt'
    },
    users: {
        id: 'id',
        image: 'image',
        profile: 'profile',
        deletedAt: 'deletedAt'
    },
    getDb: vi.fn()
}));

import * as dbModule from '@repo/db';
import { StatsService } from '../../../src/services/stats/stats.service.js';

const mockGetDb = dbModule.getDb as unknown as ReturnType<typeof vi.fn>;

/**
 * Builds a chainable `db.select().from().where()` mock that resolves to the
 * supplied rows. The matcher object passed to `.where()` is ignored — we only
 * care that the chain terminates with the seeded result.
 */
function buildDbStub(rows: Array<{ avg: string | number | null }>) {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    return { select } as const;
}

describe('StatsService.getGlobalAccommodationAverageRating', () => {
    let service: StatsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new StatsService();
    });

    it('returns 0 when there are no reviews (AVG is null)', async () => {
        // Arrange
        mockGetDb.mockReturnValue(buildDbStub([{ avg: null }]));

        // Act
        const result = await service.getGlobalAccommodationAverageRating();

        // Assert
        expect(result).toBe(0);
    });

    it('coerces a string AVG result to a number rounded to 2 decimals', async () => {
        // Arrange — Drizzle `numeric()` columns may surface as strings.
        mockGetDb.mockReturnValue(buildDbStub([{ avg: '4.3567' }]));

        // Act
        const result = await service.getGlobalAccommodationAverageRating();

        // Assert
        expect(result).toBe(4.36);
    });

    it('clamps values above 5 down to 5', async () => {
        mockGetDb.mockReturnValue(buildDbStub([{ avg: 5.7 }]));

        const result = await service.getGlobalAccommodationAverageRating();

        expect(result).toBe(5);
    });

    it('clamps negative values up to 0', async () => {
        mockGetDb.mockReturnValue(buildDbStub([{ avg: -1.2 }]));

        const result = await service.getGlobalAccommodationAverageRating();

        expect(result).toBe(0);
    });

    it('returns 0 when AVG coerces to NaN (empty rows defensive guard)', async () => {
        mockGetDb.mockReturnValue(buildDbStub([{ avg: 'not-a-number' }]));

        const result = await service.getGlobalAccommodationAverageRating();

        expect(result).toBe(0);
    });

    it('returns 0 when the query yields no rows at all', async () => {
        mockGetDb.mockReturnValue(buildDbStub([]));

        const result = await service.getGlobalAccommodationAverageRating();

        expect(result).toBe(0);
    });

    it('rounds a clean numeric result to 2 decimals', async () => {
        mockGetDb.mockReturnValue(buildDbStub([{ avg: 3.999999 }]));

        const result = await service.getGlobalAccommodationAverageRating();

        expect(result).toBe(4);
    });
});

/**
 * Builds a chainable stub matching the full
 * `select().from().innerJoin().where().groupBy().orderBy().limit()` chain
 * used by `getRecentReviewerAvatars`. The stub captures the `limit` argument
 * so tests can assert the over-fetch buffer (`limit * 3`, capped at 30).
 */
function buildAvatarsDbStub(
    rows: Array<{ image: string | null; profile: { avatar?: string | null } | null }>
) {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const groupBy = vi.fn().mockReturnValue({ orderBy });
    const where = vi.fn().mockReturnValue({ groupBy });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    const select = vi.fn().mockReturnValue({ from });
    return { db: { select } as const, limit } as const;
}

describe('StatsService.getRecentReviewerAvatars', () => {
    let service: StatsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new StatsService();
    });

    it('returns an empty array when limit is 0 (no DB call)', async () => {
        const result = await service.getRecentReviewerAvatars({ limit: 0 });

        expect(result).toEqual([]);
        expect(mockGetDb).not.toHaveBeenCalled();
    });

    it('returns an empty array when limit is negative (no DB call)', async () => {
        const result = await service.getRecentReviewerAvatars({ limit: -3 });

        expect(result).toEqual([]);
        expect(mockGetDb).not.toHaveBeenCalled();
    });

    it('prefers users.image over profile.avatar when both exist', async () => {
        const stub = buildAvatarsDbStub([
            {
                image: 'https://cdn.example.com/social.jpg',
                profile: { avatar: 'https://cdn.example.com/legacy.jpg' }
            }
        ]);
        mockGetDb.mockReturnValue(stub.db);

        const result = await service.getRecentReviewerAvatars({ limit: 4 });

        expect(result).toEqual(['https://cdn.example.com/social.jpg']);
    });

    it('falls back to profile.avatar when users.image is null', async () => {
        const stub = buildAvatarsDbStub([
            { image: null, profile: { avatar: 'https://cdn.example.com/legacy.jpg' } }
        ]);
        mockGetDb.mockReturnValue(stub.db);

        const result = await service.getRecentReviewerAvatars({ limit: 4 });

        expect(result).toEqual(['https://cdn.example.com/legacy.jpg']);
    });

    it('skips rows without any avatar (both image and profile.avatar empty)', async () => {
        const stub = buildAvatarsDbStub([
            { image: null, profile: null },
            { image: '', profile: { avatar: '' } },
            { image: null, profile: { avatar: 'https://cdn.example.com/ok.jpg' } }
        ]);
        mockGetDb.mockReturnValue(stub.db);

        const result = await service.getRecentReviewerAvatars({ limit: 4 });

        expect(result).toEqual(['https://cdn.example.com/ok.jpg']);
    });

    it('truncates the result to the requested limit', async () => {
        const stub = buildAvatarsDbStub([
            { image: 'https://cdn.example.com/a.jpg', profile: null },
            { image: 'https://cdn.example.com/b.jpg', profile: null },
            { image: 'https://cdn.example.com/c.jpg', profile: null },
            { image: 'https://cdn.example.com/d.jpg', profile: null }
        ]);
        mockGetDb.mockReturnValue(stub.db);

        const result = await service.getRecentReviewerAvatars({ limit: 2 });

        expect(result).toEqual(['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']);
    });

    it('over-fetches limit * 3 rows from the DB to account for missing avatars', async () => {
        const stub = buildAvatarsDbStub([]);
        mockGetDb.mockReturnValue(stub.db);

        await service.getRecentReviewerAvatars({ limit: 6 });

        expect(stub.limit).toHaveBeenCalledWith(18);
    });

    it('caps the over-fetch at 30 rows even for very large limits', async () => {
        const stub = buildAvatarsDbStub([]);
        mockGetDb.mockReturnValue(stub.db);

        await service.getRecentReviewerAvatars({ limit: 50 });

        expect(stub.limit).toHaveBeenCalledWith(30);
    });

    it('returns an empty array when the query yields no rows', async () => {
        const stub = buildAvatarsDbStub([]);
        mockGetDb.mockReturnValue(stub.db);

        const result = await service.getRecentReviewerAvatars({ limit: 4 });

        expect(result).toEqual([]);
    });
});
