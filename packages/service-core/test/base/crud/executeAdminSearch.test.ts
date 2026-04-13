/**
 * @fileoverview
 * Test suite for the `_executeAdminSearch` default implementation in BaseCrudRead.
 * Covers:
 * - Where clause and entityFilters merging
 * - Search condition forwarding as additionalConditions
 * - ExtraConditions forwarding
 * - Routing to findAll vs findAllWithRelations based on default relations
 * - Pagination and sort parameter passing
 */
import type { BaseModel as BaseModelDB } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSearchExecuteParams } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import { mockAdminActor } from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

// --- Mock buildSearchCondition from @repo/db ---
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

const defaultPaginatedResult = { items: [], total: 0 };

/**
 * TestService without default relations
 */
class NoRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return undefined;
    }
}

/**
 * TestService with default relations
 */
class WithRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return { destination: true, tags: true };
    }
}

/**
 * Helper to call the protected _executeAdminSearch method
 */
function callExecuteAdminSearch(
    service: TestService,
    params: AdminSearchExecuteParams
): Promise<{ items: TestEntity[]; total: number }> {
    return (
        service as unknown as {
            _executeAdminSearch: (p: AdminSearchExecuteParams) => Promise<{
                items: TestEntity[];
                total: number;
            }>;
        }
    )._executeAdminSearch(params);
}

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

describe('BaseCrudRead: _executeAdminSearch', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.findAllWithRelations).mockResolvedValue(defaultPaginatedResult);
    });

    // --- Where + entityFilters merging ---

    describe('Where and entityFilters merging', () => {
        it('should merge entityFilters into the where clause', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams({
                where: { lifecycleState: 'ACTIVE', deletedAt: null },
                entityFilters: { category: 'luxury', destinationId: 'dest-1' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const mergedWhere = findAllCall?.[0] as Record<string, unknown>;
            expect(mergedWhere).toEqual({
                lifecycleState: 'ACTIVE',
                deletedAt: null,
                category: 'luxury',
                destinationId: 'dest-1'
            });
        });

        it('should use where only when entityFilters is empty', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams({
                where: { lifecycleState: 'DRAFT' },
                entityFilters: {}
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const mergedWhere = findAllCall?.[0] as Record<string, unknown>;
            expect(mergedWhere).toEqual({ lifecycleState: 'DRAFT' });
        });

        it('should allow entityFilters to override where clause keys', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams({
                where: { status: 'old-value' },
                entityFilters: { status: 'new-value' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const mergedWhere = findAllCall?.[0] as Record<string, unknown>;
            expect(mergedWhere.status).toBe('new-value');
        });
    });

    // --- Search condition ---

    describe('Search condition handling', () => {
        it('should include search SQL in additionalConditions', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const fakeSearchSql = { sql: 'ILIKE search' };
            const params = buildDefaultParams({
                search: fakeSearchSql as never
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const additionalConditions = findAllCall?.[2] as unknown[];
            expect(additionalConditions).toContain(fakeSearchSql);
        });

        it('should not pass additionalConditions when no search and no extraConditions', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams({
                search: undefined,
                extraConditions: undefined
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const additionalConditions = findAllCall?.[2];
            expect(additionalConditions).toBeUndefined();
        });
    });

    // --- Extra conditions ---

    describe('Extra conditions handling', () => {
        it('should include extraConditions in additionalConditions', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const extraSql1 = { sql: 'extra condition 1' };
            const extraSql2 = { sql: 'extra condition 2' };
            const params = buildDefaultParams({
                extraConditions: [extraSql1, extraSql2] as never[]
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const additionalConditions = findAllCall?.[2] as unknown[];
            expect(additionalConditions).toContain(extraSql1);
            expect(additionalConditions).toContain(extraSql2);
        });

        it('should combine search and extraConditions', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const fakeSearchSql = { sql: 'search' };
            const extraSql = { sql: 'extra' };
            const params = buildDefaultParams({
                search: fakeSearchSql as never,
                extraConditions: [extraSql] as never[]
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const additionalConditions = findAllCall?.[2] as unknown[];
            expect(additionalConditions).toHaveLength(2);
            expect(additionalConditions).toContain(fakeSearchSql);
            expect(additionalConditions).toContain(extraSql);
        });
    });

    // --- Routing: findAll vs findAllWithRelations ---

    describe('Model method routing', () => {
        it('should call findAll when no default relations are configured', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams();

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
            expect(asMock(modelMock.findAllWithRelations)).not.toHaveBeenCalled();
        });

        it('should call findAllWithRelations when default relations are configured', async () => {
            // Arrange
            const service = createServiceTestInstance(WithRelationsService, modelMock);
            const params = buildDefaultParams();

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            expect(asMock(modelMock.findAllWithRelations)).toHaveBeenCalledTimes(1);
            expect(asMock(modelMock.findAll)).not.toHaveBeenCalled();
        });

        it('should pass relations config to findAllWithRelations', async () => {
            // Arrange
            const service = createServiceTestInstance(WithRelationsService, modelMock);
            const params = buildDefaultParams();

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const call = asMock(modelMock.findAllWithRelations).mock.calls[0];
            const relations = call?.[0] as Record<string, unknown>;
            expect(relations).toEqual({ destination: true, tags: true });
        });
    });

    // --- Pagination and sort ---

    describe('Pagination and sort', () => {
        it('should pass pagination to model options', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams({
                pagination: { page: 3, pageSize: 50 }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const options = findAllCall?.[1] as Record<string, unknown>;
            expect(options.page).toBe(3);
            expect(options.pageSize).toBe(50);
        });

        it('should pass sort to model options', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const params = buildDefaultParams({
                sort: { sortBy: 'name', sortOrder: 'asc' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const findAllCall = asMock(modelMock.findAll).mock.calls[0];
            const options = findAllCall?.[1] as Record<string, unknown>;
            expect(options.sortBy).toBe('name');
            expect(options.sortOrder).toBe('asc');
        });

        it('should pass combined pagination and sort options to findAllWithRelations', async () => {
            // Arrange
            const service = createServiceTestInstance(WithRelationsService, modelMock);
            const params = buildDefaultParams({
                pagination: { page: 2, pageSize: 25 },
                sort: { sortBy: 'updatedAt', sortOrder: 'desc' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const call = asMock(modelMock.findAllWithRelations).mock.calls[0];
            const options = call?.[2] as Record<string, unknown>;
            expect(options).toEqual({
                page: 2,
                pageSize: 25,
                sortBy: 'updatedAt',
                sortOrder: 'desc'
            });
        });
    });

    // --- Return value ---

    describe('Return value', () => {
        it('should return the model result directly', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            const expectedResult = {
                items: [
                    {
                        id: 'entity-1',
                        name: 'Test',
                        deletedAt: null
                    }
                ],
                total: 1
            };
            asMock(modelMock.findAll).mockResolvedValue(expectedResult);
            const params = buildDefaultParams();

            // Act
            const result = await callExecuteAdminSearch(service, params);

            // Assert
            expect(result).toEqual(expectedResult);
        });

        it('should propagate model errors', async () => {
            // Arrange
            const service = createServiceTestInstance(NoRelationsService, modelMock);
            asMock(modelMock.findAll).mockRejectedValue(new Error('DB failure'));
            const params = buildDefaultParams();

            // Act & Assert
            await expect(callExecuteAdminSearch(service, params)).rejects.toThrow('DB failure');
        });
    });
});
