/**
 * @fileoverview
 * Unit tests for SponsorshipService._executeAdminSearch override.
 *
 * The override remaps the `sponsorshipStatus` filter from entityFilters to the
 * database `status` column. This is needed because the `sponsorships` table has no
 * `lifecycleState` column and uses `status` directly for its state.
 *
 * Logic:
 *   - If `sponsorshipStatus` is present → map to `status` in the merged where
 *   - If absent → no `status` added from the override
 *
 * SponsorshipService defines default relations (sponsorUser, level, package), so the
 * base class calls model.findAllWithRelations(relations, where, options, extraConditions).
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import type { AdminSearchExecuteParams, ServiceConfig } from '../../../src/types';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

/** Minimal mock for SponsorshipModel. */
class MockSponsorshipModel {
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    getTable = vi.fn();
    getTableName = vi.fn().mockReturnValue('sponsorships');
}

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
    service: SponsorshipService,
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

describe('SponsorshipService: _executeAdminSearch override', () => {
    let mockModel: MockSponsorshipModel;
    let service: SponsorshipService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockSponsorshipModel();
        mockModel.findAll.mockResolvedValue(defaultPaginatedResult);
        mockModel.findAllWithRelations.mockResolvedValue(defaultPaginatedResult);
        service = new SponsorshipService({ model: mockModel } as unknown as ServiceConfig & {
            model?: never;
        });
    });

    // --- sponsorshipStatus present ---

    describe('sponsorshipStatus filter present', () => {
        it('should remap sponsorshipStatus to status in the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { sponsorshipStatus: 'active' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: SponsorshipService HAS default relations → findAllWithRelations is called
            // findAllWithRelations(relations, where, options, extraConditions)
            expect(asMock(mockModel.findAllWithRelations)).toHaveBeenCalledOnce();
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).toHaveProperty('status', 'active');
        });

        it('should not expose sponsorshipStatus in the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { sponsorshipStatus: 'active' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('sponsorshipStatus');
        });

        it('should remap different sponsorshipStatus values correctly', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { sponsorshipStatus: 'expired' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).toHaveProperty('status', 'expired');
            expect(whereArg).not.toHaveProperty('sponsorshipStatus');
        });
    });

    // --- sponsorshipStatus absent ---

    describe('sponsorshipStatus filter absent', () => {
        it('should not add status to where clause when sponsorshipStatus is absent', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: {} });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('status');
            expect(whereArg).not.toHaveProperty('sponsorshipStatus');
        });
    });

    // --- other entityFilters pass through ---

    describe('other entityFilters pass through', () => {
        it('should pass other entityFilters into the where clause unchanged', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { sponsorId: 'sponsor-123', type: 'banner' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).toHaveProperty('sponsorId', 'sponsor-123');
            expect(whereArg).toHaveProperty('type', 'banner');
        });

        it('should combine sponsorshipStatus remap with other filters', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: {
                    sponsorshipStatus: 'active',
                    sponsorId: 'sponsor-456'
                }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).toHaveProperty('status', 'active');
            expect(whereArg).toHaveProperty('sponsorId', 'sponsor-456');
            expect(whereArg).not.toHaveProperty('sponsorshipStatus');
        });
    });

    // --- no extraConditions added ---

    describe('no extra SQL conditions', () => {
        it('should not add any extra SQL conditions (no SQL overrides in sponsorship)', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { sponsorshipStatus: 'active' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: 4th arg to findAllWithRelations is extraConditions (none expected)
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[] | undefined
            ];
            expect(conditions).toBeUndefined();
        });
    });

    // --- return value ---

    describe('return value', () => {
        it('should return the paginated result from the model', async () => {
            // Arrange
            const expected = { items: [{ id: 'spon-1' }], total: 1 };
            mockModel.findAllWithRelations.mockResolvedValue(expected);

            // Act
            const result = await callExecuteAdminSearch(service, buildDefaultParams());

            // Assert
            expect(result).toEqual(expected);
        });
    });
});
