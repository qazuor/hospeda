/**
 * @fileoverview
 * Test suite for the `adminList` method of BaseCrudRead.
 * Covers:
 * - Configuration validation (adminSearchSchema required)
 * - Param validation against adminSearchSchema
 * - Sort field validation against table columns
 * - Pagination defaults and limits
 * - Status filter (all vs specific)
 * - includeDeleted handling
 * - Date range filters (createdAfter, createdBefore)
 * - Entity-specific filters
 * - Search condition building
 * - Permission checks (_canList)
 * - _executeAdminSearch delegation (with/without relations)
 */
import type { BaseModel as BaseModelDB } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AdminSearchExecuteParams } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import { mockAdminActor } from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

// --- Mock buildSearchCondition from @repo/db ---
const mockBuildSearchCondition = vi.fn();
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: (...args: unknown[]) => mockBuildSearchCondition(...args)
    };
});

// --- AdminSearch schema for testing ---
const TestAdminSearchSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().max(200).optional(),
    sort: z
        .string()
        .regex(/^[a-zA-Z_]+:(asc|desc)$/)
        .default('createdAt:desc'),
    status: z.enum(['all', 'ACTIVE', 'DRAFT', 'ARCHIVED']).default('all'),
    includeDeleted: z.coerce.boolean().default(false),
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    // Entity-specific filter
    category: z.string().optional()
});

// --- Fake table object to simulate Drizzle table columns ---
const fakeTable = {
    id: { name: 'id' },
    name: { name: 'name' },
    createdAt: { name: 'created_at' },
    updatedAt: { name: 'updated_at' },
    deletedAt: { name: 'deleted_at' },
    lifecycleState: { name: 'lifecycle_state' },
    category: { name: 'category' }
};

// --- Table without lifecycleState or deletedAt ---
const fakeTableNoLifecycleNoDeleted = {
    id: { name: 'id' },
    name: { name: 'name' },
    createdAt: { name: 'created_at' }
};

/**
 * TestService extended with adminSearchSchema configured
 */
class AdminListTestService extends TestService {
    constructor(ctx: { logger: unknown }, model?: BaseModelDB<TestEntity>) {
        super(ctx, model);
        // Set adminSearchSchema via protected property
        (this as unknown as { adminSearchSchema: z.ZodType }).adminSearchSchema =
            TestAdminSearchSchema;
    }

    protected override getSearchableColumns(): string[] {
        return ['name'];
    }

    protected override getDefaultListRelations() {
        return undefined;
    }
}

/**
 * TestService with relations configured
 */
class AdminListWithRelationsService extends AdminListTestService {
    protected override getDefaultListRelations() {
        return { destination: true };
    }
}

/**
 * TestService without adminSearchSchema (to test configuration error)
 */
class NoAdminSchemaService extends TestService {
    protected override getDefaultListRelations() {
        return undefined;
    }
}

const defaultPaginatedResult = { items: [], total: 0 };

describe('BaseCrudRead: adminList', () => {
    let modelMock: BaseModelDB<TestEntity>;
    let service: AdminListTestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();

        // Mock getTable to return our fake table
        vi.spyOn(modelMock, 'getTable').mockReturnValue(fakeTable as never);
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.findAllWithRelations).mockResolvedValue(defaultPaginatedResult);

        service = createServiceTestInstance(AdminListTestService, modelMock);
    });

    // --- Configuration ---

    describe('Configuration', () => {
        it('should throw CONFIGURATION_ERROR when adminSearchSchema is not configured', async () => {
            // Arrange
            const noSchemaService = createServiceTestInstance(NoAdminSchemaService, modelMock);

            // Act
            const result = await noSchemaService.adminList(mockAdminActor, {});

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.CONFIGURATION_ERROR);
            expect(result.error?.message).toContain('adminSearchSchema is not configured');
        });
    });

    // --- Validation ---

    describe('Validation', () => {
        it('should return VALIDATION_ERROR for invalid params against adminSearchSchema', async () => {
            // Arrange - sort must be "field:direction"
            const invalidParams = { sort: 'invalid-format' };

            // Act
            const result = await service.adminList(mockAdminActor, invalidParams);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('Admin search validation failed');
        });

        it('should return VALIDATION_ERROR when sort field does not exist on table', async () => {
            // Arrange - 'nonExistentField' is not on our fakeTable
            const params = { sort: 'nonExistentField:asc' };

            // Act
            const result = await service.adminList(mockAdminActor, params);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toContain('Invalid sort field');
            expect(result.error?.message).toContain('nonExistentField');
        });

        it('should accept a valid sort field that exists on the table', async () => {
            // Arrange
            const params = { sort: 'name:asc' };

            // Act
            const result = await service.adminList(mockAdminActor, params);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });
    });

    // --- Pagination ---

    describe('Pagination', () => {
        it('should apply page and pageSize correctly', async () => {
            // Arrange
            const params = { page: 3, pageSize: 50, sort: 'createdAt:desc' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    pagination: { page: 3, pageSize: 50 }
                })
            );
        });

        it('should default to page=1 and pageSize=20', async () => {
            // Arrange
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, {});

            // Assert
            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    pagination: { page: 1, pageSize: 20 }
                })
            );
        });

        it('should reject pageSize > 100', async () => {
            // Arrange
            const params = { pageSize: 200 };

            // Act
            const result = await service.adminList(mockAdminActor, params);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // --- Search ---

    describe('Search', () => {
        it('should pass search term to buildSearchCondition with correct searchable columns', async () => {
            // Arrange
            const fakeSqlCondition = { sql: 'FAKE SQL' };
            mockBuildSearchCondition.mockReturnValue(fakeSqlCondition);
            const params = { search: 'hotel' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            expect(mockBuildSearchCondition).toHaveBeenCalledWith('hotel', ['name'], fakeTable);
            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: fakeSqlCondition
                })
            );
        });

        it('should not build search condition when search is empty string', async () => {
            // Arrange
            const params = { search: '' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            expect(mockBuildSearchCondition).not.toHaveBeenCalled();
            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: undefined
                })
            );
        });

        it('should not build search condition when search is whitespace only', async () => {
            // Arrange
            const params = { search: '   ' };

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            expect(mockBuildSearchCondition).not.toHaveBeenCalled();
        });
    });

    // --- Status filter ---

    describe('Status filter', () => {
        it('should not add lifecycleState filter when status is "all"', async () => {
            // Arrange
            const params = { status: 'all' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).not.toHaveProperty('lifecycleState');
        });

        it('should add lifecycleState filter when status is "ACTIVE"', async () => {
            // Arrange
            const params = { status: 'ACTIVE' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).toHaveProperty('lifecycleState', 'ACTIVE');
        });
    });

    // --- includeDeleted ---

    describe('includeDeleted', () => {
        it('should add deletedAt=null filter when includeDeleted is false and table has deletedAt', async () => {
            // Arrange
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act - defaults: includeDeleted=false
            await service.adminList(mockAdminActor, {});

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).toHaveProperty('deletedAt', null);
        });

        it('should NOT add deletedAt filter when includeDeleted is true', async () => {
            // Arrange
            const params = { includeDeleted: true };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).not.toHaveProperty('deletedAt');
        });

        it('should skip deletedAt filter when table has no deletedAt column', async () => {
            // Arrange - use a table without deletedAt
            vi.spyOn(modelMock, 'getTable').mockReturnValue(fakeTableNoLifecycleNoDeleted as never);
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act - includeDeleted=false, but table has no deletedAt
            await service.adminList(mockAdminActor, { includeDeleted: false });

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).not.toHaveProperty('deletedAt');
        });
    });

    // --- Date range ---

    describe('Date range filters', () => {
        it('should apply createdAfter filter', async () => {
            // Arrange
            const afterDate = new Date('2025-01-01T00:00:00Z');
            const params = { createdAfter: afterDate.toISOString() };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).toHaveProperty('createdAt_gte');
            expect(callArgs.where.createdAt_gte).toEqual(afterDate);
        });

        it('should apply createdBefore filter', async () => {
            // Arrange
            const beforeDate = new Date('2025-12-31T23:59:59Z');
            const params = { createdBefore: beforeDate.toISOString() };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).toHaveProperty('createdAt_lte');
            expect(callArgs.where.createdAt_lte).toEqual(beforeDate);
        });

        it('should apply both createdAfter and createdBefore together', async () => {
            // Arrange
            const afterDate = new Date('2025-01-01T00:00:00Z');
            const beforeDate = new Date('2025-12-31T23:59:59Z');
            const params = {
                createdAfter: afterDate.toISOString(),
                createdBefore: beforeDate.toISOString()
            };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.where).toHaveProperty('createdAt_gte', afterDate);
            expect(callArgs.where).toHaveProperty('createdAt_lte', beforeDate);
        });
    });

    // --- Entity-specific filters ---

    describe('Entity-specific filters', () => {
        it('should pass remaining params as entityFilters after extracting base fields', async () => {
            // Arrange
            const params = { category: 'luxury', sort: 'name:asc' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.entityFilters).toEqual({ category: 'luxury' });
        });

        it('should pass empty entityFilters when no extra params provided', async () => {
            // Arrange
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, {});

            // Assert
            const callArgs = executeSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(callArgs.entityFilters).toEqual({});
        });
    });

    // --- Permissions ---

    describe('Permissions', () => {
        it('should call _canList for permission check', async () => {
            // Arrange
            const canListSpy = vi.spyOn(
                service as unknown as { _canList: (...args: unknown[]) => unknown },
                '_canList'
            );

            // Act
            await service.adminList(mockAdminActor, {});

            // Assert
            expect(canListSpy).toHaveBeenCalledWith(mockAdminActor);
        });

        it('should return error when _canList denies permission', async () => {
            // Arrange
            const forbiddenError = new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied'
            );
            vi.spyOn(
                service as unknown as { _canList: (...args: unknown[]) => unknown },
                '_canList'
            ).mockImplementation(() => {
                throw forbiddenError;
            });

            // Act
            const result = await service.adminList(mockAdminActor, {});

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error).toEqual(forbiddenError);
        });
    });

    // --- Sort parsing ---

    describe('Sort parsing', () => {
        it('should parse sort string into sortBy and sortOrder', async () => {
            // Arrange
            const params = { sort: 'name:asc' };
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    sort: { sortBy: 'name', sortOrder: 'asc' }
                })
            );
        });

        it('should default sort to createdAt:desc', async () => {
            // Arrange
            const executeSpy = vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            );

            // Act
            await service.adminList(mockAdminActor, {});

            // Assert
            expect(executeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    sort: { sortBy: 'createdAt', sortOrder: 'desc' }
                })
            );
        });
    });

    // --- _executeAdminSearch delegation ---

    describe('_executeAdminSearch delegation', () => {
        it('should call model.findAll when no default relations are configured', async () => {
            // Arrange - service has no relations (getDefaultListRelations returns undefined)

            // Act
            await service.adminList(mockAdminActor, {});

            // Assert
            expect(asMock(modelMock.findAll)).toHaveBeenCalled();
            expect(asMock(modelMock.findAllWithRelations)).not.toHaveBeenCalled();
        });

        it('should call model.findAllWithRelations when relations are configured', async () => {
            // Arrange
            const relationService = createServiceTestInstance(
                AdminListWithRelationsService,
                modelMock
            );

            // Act
            await relationService.adminList(mockAdminActor, {});

            // Assert
            expect(asMock(modelMock.findAllWithRelations)).toHaveBeenCalled();
        });

        it('should merge entityFilters into where clause in _executeAdminSearch', async () => {
            // Arrange
            const params = { category: 'luxury', status: 'ACTIVE' };

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const where = findAllCall?.[0] as Record<string, unknown>;
            expect(where).toHaveProperty('category', 'luxury');
            expect(where).toHaveProperty('lifecycleState', 'ACTIVE');
        });

        it('should pass search condition as additionalConditions to model', async () => {
            // Arrange
            const fakeSqlCondition = { sql: 'FAKE SEARCH SQL' };
            mockBuildSearchCondition.mockReturnValue(fakeSqlCondition);
            const params = { search: 'hotel' };

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const additionalConditions = findAllCall?.[2] as unknown[];
            expect(additionalConditions).toContain(fakeSqlCondition);
        });

        it('should pass pagination and sort to model options', async () => {
            // Arrange
            const params = { page: 2, pageSize: 30, sort: 'name:asc' };

            // Act
            await service.adminList(mockAdminActor, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const options = findAllCall?.[1] as Record<string, unknown>;
            expect(options).toEqual({
                page: 2,
                pageSize: 30,
                sortBy: 'name',
                sortOrder: 'asc'
            });
        });

        it('should pass undefined additionalConditions when no search or extraConditions', async () => {
            // Arrange - no search

            // Act
            await service.adminList(mockAdminActor, {});

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const additionalConditions = findAllCall?.[2];
            expect(additionalConditions).toBeUndefined();
        });
    });

    // --- Error handling ---

    describe('Error handling', () => {
        it('should return INTERNAL_ERROR when _executeAdminSearch throws', async () => {
            // Arrange
            vi.spyOn(
                service as unknown as {
                    _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
                },
                '_executeAdminSearch'
            ).mockRejectedValue(new Error('DB connection lost'));

            // Act
            const result = await service.adminList(mockAdminActor, {});

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });
});
