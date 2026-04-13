/**
 * @fileoverview
 * Unit tests for EventService._executeAdminSearch override.
 *
 * The override extracts four date filters from entityFilters and converts each into
 * a raw SQL condition that casts the JSONB `date` column:
 *   - startDateAfter  → (date->>'start')::timestamptz >= value
 *   - startDateBefore → (date->>'start')::timestamptz <= value
 *   - endDateAfter    → (date->>'end')::timestamptz >= value
 *   - endDateBefore   → (date->>'end')::timestamptz <= value
 *
 * All remaining filters pass through unchanged to super._executeAdminSearch().
 * EventService defines default relations (organizer + location), so the base class
 * calls model.findAllWithRelations(relations, where, options, extraConditions).
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
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

/** Minimal mock for EventModel. */
class MockEventModel {
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
    getTableName = vi.fn().mockReturnValue('events');
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
    service: EventService,
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

describe('EventService: _executeAdminSearch override', () => {
    let mockModel: MockEventModel;
    let service: EventService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockEventModel();
        mockModel.findAll.mockResolvedValue(defaultPaginatedResult);
        mockModel.findAllWithRelations.mockResolvedValue(defaultPaginatedResult);
        service = new EventService({ model: mockModel } as unknown as ServiceConfig & {
            model?: never;
        });
    });

    // --- startDateAfter ---

    describe('startDateAfter filter', () => {
        it('should add one SQL condition for startDateAfter', async () => {
            // Arrange
            const date = new Date('2025-03-01T00:00:00Z');
            const params = buildDefaultParams({ entityFilters: { startDateAfter: date } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: 4th arg to findAllWithRelations is extraConditions
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[] | undefined
            ];
            expect(conditions).toBeDefined();
            expect(conditions).toHaveLength(1);
        });

        it('should remove startDateAfter from entityFilters', async () => {
            // Arrange
            const date = new Date('2025-03-01T00:00:00Z');
            const params = buildDefaultParams({ entityFilters: { startDateAfter: date } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('startDateAfter');
        });
    });

    // --- startDateBefore ---

    describe('startDateBefore filter', () => {
        it('should add one SQL condition for startDateBefore', async () => {
            // Arrange
            const date = new Date('2025-12-31T23:59:59Z');
            const params = buildDefaultParams({ entityFilters: { startDateBefore: date } });

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

        it('should remove startDateBefore from entityFilters', async () => {
            // Arrange
            const date = new Date('2025-12-31T23:59:59Z');
            const params = buildDefaultParams({ entityFilters: { startDateBefore: date } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('startDateBefore');
        });
    });

    // --- endDateAfter ---

    describe('endDateAfter filter', () => {
        it('should add one SQL condition for endDateAfter', async () => {
            // Arrange
            const date = new Date('2025-04-01T00:00:00Z');
            const params = buildDefaultParams({ entityFilters: { endDateAfter: date } });

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

        it('should remove endDateAfter from entityFilters', async () => {
            // Arrange
            const date = new Date('2025-04-01T00:00:00Z');
            const params = buildDefaultParams({ entityFilters: { endDateAfter: date } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('endDateAfter');
        });
    });

    // --- endDateBefore ---

    describe('endDateBefore filter', () => {
        it('should add one SQL condition for endDateBefore', async () => {
            // Arrange
            const date = new Date('2025-06-30T23:59:59Z');
            const params = buildDefaultParams({ entityFilters: { endDateBefore: date } });

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

        it('should remove endDateBefore from entityFilters', async () => {
            // Arrange
            const date = new Date('2025-06-30T23:59:59Z');
            const params = buildDefaultParams({ entityFilters: { endDateBefore: date } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).not.toHaveProperty('endDateBefore');
        });
    });

    // --- all four combined ---

    describe('all four date filters combined', () => {
        it('should add exactly four SQL conditions when all date filters are provided', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: {
                    startDateAfter: new Date('2025-01-01'),
                    startDateBefore: new Date('2025-06-30'),
                    endDateAfter: new Date('2025-01-15'),
                    endDateBefore: new Date('2025-07-15')
                }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[]
            ];
            expect(conditions).toHaveLength(4);
        });

        it('should strip all four date filters from the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: {
                    startDateAfter: new Date('2025-01-01'),
                    startDateBefore: new Date('2025-06-30'),
                    endDateAfter: new Date('2025-01-15'),
                    endDateBefore: new Date('2025-07-15')
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
            expect(whereArg).not.toHaveProperty('startDateAfter');
            expect(whereArg).not.toHaveProperty('startDateBefore');
            expect(whereArg).not.toHaveProperty('endDateAfter');
            expect(whereArg).not.toHaveProperty('endDateBefore');
        });
    });

    // --- no date filters ---

    describe('no date filters', () => {
        it('should not add any SQL conditions when no date filters are present', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: {} });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: no extra conditions
            const [, , , conditions] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                unknown,
                unknown,
                unknown[] | undefined
            ];
            expect(conditions).toBeUndefined();
        });

        it('should pass other entityFilters through to the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { category: 'MUSIC' } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const [, whereArg] = asMock(mockModel.findAllWithRelations).mock.calls[0] as [
                unknown,
                Record<string, unknown>,
                unknown,
                unknown
            ];
            expect(whereArg).toHaveProperty('category', 'MUSIC');
        });
    });

    // --- return value ---

    describe('return value', () => {
        it('should return the paginated result from the model', async () => {
            // Arrange
            const expected = { items: [{ id: 'evt-1' }], total: 1 };
            mockModel.findAllWithRelations.mockResolvedValue(expected);

            // Act
            const result = await callExecuteAdminSearch(service, buildDefaultParams());

            // Assert
            expect(result).toEqual(expected);
        });
    });
});
