/**
 * @fileoverview
 * Unit tests for AccommodationService._executeAdminSearch override.
 *
 * The override extracts `minPrice` and `maxPrice` from entityFilters and converts
 * them into raw SQL conditions against the JSONB `(price->>'price')::numeric` column.
 * All other filters pass through unchanged to super._executeAdminSearch().
 *
 * Base class calls model.findAllWithRelations(relations, where, options, extraConditions)
 * because AccommodationService defines default relations.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { AdminSearchExecuteParams, ServiceConfig } from '../../../src/types';
import { makeMediaModelStub } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn(),
        DestinationModel: vi.fn().mockImplementation(() => ({ findById: vi.fn() }))
    };
});

/** Minimal mock for AccommodationModel. */
class MockAccommodationModel {
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
    getTableName = vi.fn().mockReturnValue('accommodations');
}

const defaultPaginatedResult = { items: [], total: 0 };

const mockAdminActor = {
    id: 'admin-1',
    role: RoleEnum.SUPER_ADMIN,
    permissions: Object.values(PermissionEnum)
};

/**
 * Calls the protected _executeAdminSearch via a type cast.
 * Acceptable in tests to access protected/internal methods.
 */
function callExecuteAdminSearch(
    service: AccommodationService,
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

describe('AccommodationService: _executeAdminSearch override', () => {
    let mockModel: MockAccommodationModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockAccommodationModel();
        mockModel.findAll.mockResolvedValue(defaultPaginatedResult);
        mockModel.findAllWithRelations.mockResolvedValue(defaultPaginatedResult);
        service = new AccommodationService(
            {} as ServiceConfig,
            mockModel as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
    });

    // --- minPrice ---

    describe('minPrice filter', () => {
        it('should add one SQL condition when minPrice is provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minPrice: 100 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: findAllWithRelations(relations, where, opts, conditions)
            // 4th arg is extraConditions
            expect(asMock(mockModel.findAllWithRelations)).toHaveBeenCalledOnce();
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[] | undefined
            ];
            expect(conditions).toBeDefined();
            expect(conditions).toHaveLength(1);
        });

        it('should not expose minPrice in the merged where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minPrice: 100 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('minPrice');
        });
    });

    // --- maxPrice ---

    describe('maxPrice filter', () => {
        it('should add one SQL condition when maxPrice is provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { maxPrice: 500 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[] | undefined
            ];
            expect(conditions).toHaveLength(1);
        });

        it('should not expose maxPrice in the merged where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { maxPrice: 500 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('maxPrice');
        });
    });

    // --- minPrice + maxPrice combined ---

    describe('minPrice and maxPrice combined', () => {
        it('should add exactly two SQL conditions when both are provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minPrice: 100, maxPrice: 500 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[]
            ];
            expect(conditions).toHaveLength(2);
        });

        it('should strip both minPrice and maxPrice from the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { minPrice: 100, maxPrice: 500 } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('minPrice');
            expect(whereArg).not.toHaveProperty('maxPrice');
        });
    });

    // --- no price filters ---

    describe('no price filters', () => {
        it('should not add any SQL conditions when no price filters are present', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: {} });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: conditions arg is undefined (no extra conditions)
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[] | undefined
            ];
            expect(conditions).toBeUndefined();
        });

        it('should pass remaining entityFilters through into the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { type: 'HOTEL' } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: `type` ends up merged into where
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).toHaveProperty('type', 'HOTEL');
        });
    });

    // --- pre-existing extraConditions preserved ---

    describe('pre-existing extraConditions', () => {
        it('should preserve existing extraConditions alongside new price conditions', async () => {
            // Arrange
            const preExisting = { sql: 'existing condition' } as never;
            const params = buildDefaultParams({
                entityFilters: { minPrice: 200 },
                extraConditions: [preExisting]
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: 1 pre-existing + 1 minPrice = 2 total
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[]
            ];
            expect(conditions).toHaveLength(2);
            expect(conditions).toContain(preExisting);
        });
    });

    // --- return value ---

    describe('return value', () => {
        it('should return the paginated result from the model', async () => {
            // Arrange
            const expected = { items: [{ id: 'acc-1', name: 'Test Hotel' }], total: 1 };
            mockModel.findAllWithRelations.mockResolvedValue(expected);

            // Act
            const result = await callExecuteAdminSearch(service, buildDefaultParams());

            // Assert
            expect(result).toEqual(expected);
        });
    });

    // --- SPEC-169 §5.2: forced owner-scoping ---

    describe('forced owner-scoping (SPEC-169 §5.2)', () => {
        const viewOwnActor = {
            id: 'host-1',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
        };
        const viewAllActor = {
            id: 'admin-9',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
        };

        const getWhereArg = (): Record<string, unknown> => {
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            return whereArg;
        };

        it('AC-1: VIEW_OWN actor without ownerId gets ownerId forced to actor.id', async () => {
            await callExecuteAdminSearch(
                service,
                buildDefaultParams({ actor: viewOwnActor, entityFilters: {} })
            );
            expect(getWhereArg().ownerId).toBe('host-1');
        });

        it('AC-2: VIEW_OWN actor cannot widen scope — a forged ownerId is overwritten', async () => {
            await callExecuteAdminSearch(
                service,
                buildDefaultParams({
                    actor: viewOwnActor,
                    entityFilters: { ownerId: 'someone-else' }
                })
            );
            expect(getWhereArg().ownerId).toBe('host-1');
        });

        it('AC-4: VIEW_ALL actor lists unscoped — no ownerId is forced', async () => {
            await callExecuteAdminSearch(
                service,
                buildDefaultParams({ actor: viewAllActor, entityFilters: {} })
            );
            expect(getWhereArg().ownerId).toBeUndefined();
        });

        it('AC-4: VIEW_ALL actor keeps an explicit client ownerId filter (staff may filter)', async () => {
            await callExecuteAdminSearch(
                service,
                buildDefaultParams({
                    actor: viewAllActor,
                    entityFilters: { ownerId: 'target-owner' }
                })
            );
            expect(getWhereArg().ownerId).toBe('target-owner');
        });

        // AC-5 / REQ-4 regression guard: /me/accommodations reuses the admin list with
        // ownerId=self. A VIEW_OWN host requesting its own id keeps seeing its own rows (the
        // forced scope agrees with the requested self id) — it must NOT 403 after VIEW_ALL removal.
        it('AC-5: VIEW_OWN host with ownerId=self still sees its own rows (/me/accommodations)', async () => {
            await callExecuteAdminSearch(
                service,
                buildDefaultParams({
                    actor: viewOwnActor,
                    entityFilters: { ownerId: 'host-1' }
                })
            );
            expect(getWhereArg().ownerId).toBe('host-1');
        });
    });
});
