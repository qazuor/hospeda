/**
 * @fileoverview
 * Unit tests for AccommodationReviewService._executeAdminSearch override.
 *
 * The override extracts `minRating` and `maxRating` from entityFilters and converts
 * them into Drizzle `gte`/`lte` conditions on the `accommodationReviews.averageRating` column.
 * All other filters pass through unchanged to super._executeAdminSearch().
 *
 * AccommodationReviewService defines default relations (user + accommodation), so the
 * base class calls model.findAllWithRelations(relations, where, options, extraConditions).
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { AdminSearchExecuteParams, ServiceConfig } from '../../../src/types';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/services/accommodation/accommodation.service', () => ({
    AccommodationService: vi.fn().mockImplementation(() => ({
        updateStatsFromReview: vi.fn()
    }))
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn(),
        AccommodationModel: vi.fn().mockImplementation(() => ({ findById: vi.fn() })),
        AccommodationReviewModel: vi.fn().mockImplementation(() => mockReviewModelInstance)
    };
});

/** Shared mock instance so tests can spy on it. */
const mockReviewModelInstance = {
    findAll: vi.fn(),
    findAllWithRelations: vi.fn(),
    findAllWithUser: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateById: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    hardDelete: vi.fn(),
    getTable: vi.fn(),
    getTableName: vi.fn().mockReturnValue('accommodation_reviews')
};

const defaultPaginatedResult = { items: [], total: 0 };

const mockAdminActor = {
    id: 'admin-1',
    role: RoleEnum.SUPER_ADMIN,
    permissions: Object.values(PermissionEnum)
};

/**
 * Calls the protected _executeAdminSearch via a type cast.
 * Acceptable in tests to access protected methods.
 */
function callExecuteAdminSearch(
    service: AccommodationReviewService,
    params: AdminSearchExecuteParams
): Promise<{ items: unknown[]; total: number }> {
    type WithAdminSearch = {
        _executeAdminSearch: (
            p: AdminSearchExecuteParams
        ) => Promise<{ items: unknown[]; total: number }>;
    };
    return (service as unknown as WithAdminSearch)._executeAdminSearch(params);
}

/** Builds a default AdminSearchExecuteParams with optional overrides. */
function buildDefaultParams(
    overrides: Partial<AdminSearchExecuteParams> = {}
): AdminSearchExecuteParams {
    return {
        where: {},
        entityFilters: {},
        pagination: { page: 1, pageSize: 20 },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
        actor: mockAdminActor,
        ...overrides
    };
}

describe('AccommodationReviewService: _executeAdminSearch override', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReviewModelInstance.findAll.mockResolvedValue(defaultPaginatedResult);
        mockReviewModelInstance.findAllWithRelations.mockResolvedValue(defaultPaginatedResult);
        service = new AccommodationReviewService({} as ServiceConfig);
    });

    // --- minRating ---

    describe('minRating filter', () => {
        it('should add one gte condition when minRating is provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minRating: 3 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: 4th arg to findAllWithRelations is extraConditions
            const [, , , conditions] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, unknown, unknown, unknown[] | undefined];
            expect(conditions).toBeDefined();
            expect(conditions).toHaveLength(1);
        });

        it('should not expose minRating in the merged where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minRating: 3 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, Record<string, unknown>, unknown, unknown];
            expect(whereArg).not.toHaveProperty('minRating');
        });
    });

    // --- maxRating ---

    describe('maxRating filter', () => {
        it('should add one lte condition when maxRating is provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { maxRating: 5 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, , , conditions] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, unknown, unknown, unknown[] | undefined];
            expect(conditions).toHaveLength(1);
        });

        it('should not expose maxRating in the merged where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { maxRating: 5 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, Record<string, unknown>, unknown, unknown];
            expect(whereArg).not.toHaveProperty('maxRating');
        });
    });

    // --- minRating + maxRating combined ---

    describe('minRating and maxRating combined', () => {
        it('should add exactly two conditions when both minRating and maxRating are provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minRating: 3, maxRating: 5 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, , , conditions] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, unknown, unknown, unknown[]];
            expect(conditions).toHaveLength(2);
        });

        it('should strip both minRating and maxRating from the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minRating: 3, maxRating: 5 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, Record<string, unknown>, unknown, unknown];
            expect(whereArg).not.toHaveProperty('minRating');
            expect(whereArg).not.toHaveProperty('maxRating');
        });
    });

    // --- no rating filters ---

    describe('no rating filters', () => {
        it('should not add any conditions when no rating filters are present', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: {} });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, , , conditions] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, unknown, unknown, unknown[] | undefined];
            expect(conditions).toBeUndefined();
        });

        it('should pass remaining entityFilters through to the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { accommodationId: 'acc-xyz' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockReviewModelInstance.findAllWithRelations).mock
                .calls[0] as [unknown, Record<string, unknown>, unknown, unknown];
            expect(whereArg).toHaveProperty('accommodationId', 'acc-xyz');
        });
    });

    // --- return value ---

    describe('return value', () => {
        it('should return the paginated result from the model', async () => {
            // Arrange
            const expected = { items: [{ id: 'rev-1' }], total: 1 };
            mockReviewModelInstance.findAllWithRelations.mockResolvedValue(expected);

            // Act
            const result = await callExecuteAdminSearch(service, buildDefaultParams());

            // Assert
            expect(result).toEqual(expected);
        });
    });
});
