import type { BaseModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for the `getById` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of getById logic, including:
 * - Successful entity retrieval by ID
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Normalizer usage
 * - SPEC-066: getByField relation loading via getDefaultGetByIdRelations()
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { ServiceErrorCode } from '@repo/schemas';
import type { ListRelationsConfig } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { MOCK_ENTITY_ID, mockActor, mockEntity } from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

const asMock = <T>(fn: T) => fn as unknown as Mock;

/**
 * Test suite for the `getById` method of BaseService.
 *
 * This suite verifies:
 * - Correct entity retrieval on valid input and permissions
 * - Validation and error codes for forbidden and internal errors
 * - Robustness against errors in hooks and database operations
 * - Use of custom normalizers for view logic
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: getById', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
    });

    it('should return an entity when found', async () => {
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);
        expect(asMock(modelMock.findOne)).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
        expect(result.data).toEqual(mockEntity);
        expect(result.error).toBeUndefined();
    });

    it('should return null data when entity is not found', async () => {
        asMock(modelMock.findOne).mockResolvedValue(null);
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return a forbidden error if actor lacks view permission', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const service = createServiceTestInstance(TestService, modelMock);
        const canViewSpy = vi.spyOn(service as unknown as { _canView: () => void }, '_canView');
        canViewSpy.mockImplementationOnce(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'You shall not pass!');
        });

        // Act
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toBe('You shall not pass!');
    });

    it('should return an internal error if the database lookup fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        asMock(modelMock.findOne).mockRejectedValue(dbError);
        const service = createServiceTestInstance(TestService, modelMock);

        // Act
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toBe(
            'An unexpected error occurred: Database connection lost'
        );
    });

    it('should return FORBIDDEN if _canView hook throws an error', async () => {
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        vi.spyOn(service as unknown as { _canView: () => void }, '_canView').mockImplementation(
            () => {
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden by hook');
            }
        );

        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should handle errors from the _afterGetByField hook', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const hookError = new Error('Error in afterGetByField hook');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);

        // Act
        const result = await service.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the view normalizer if provided', async () => {
        // Arrange
        const normalizer = vi.fn((field, value) => ({ field: `${field}-normalized`, value }));
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findOne).mockResolvedValue(mockEntity);
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                view: normalizer
            };

            protected getDefaultListRelations() {
                return undefined;
            }
        }
        const normalizedService = createServiceTestInstance(ServiceWithNormalizer, localModelMock);

        // Act
        await normalizedService.getById(mockActor, MOCK_ENTITY_ID);

        // Assert
        expect(normalizer).toHaveBeenCalledWith('id', MOCK_ENTITY_ID, mockActor);
        expect(asMock(localModelMock.findOne)).toHaveBeenCalledWith({
            'id-normalized': MOCK_ENTITY_ID
        });
    });
});

describe('SPEC-066: getByField relation loading', () => {
    /**
     * Test suite verifying that getByField() (and its wrappers getById, getBySlug, getByName)
     * correctly delegates to model.findOneWithRelations() or model.findOne() based on what
     * getDefaultGetByIdRelations() returns.
     *
     * SPEC-066 added:
     * - `getDefaultGetByIdRelations()` on BaseCrudPermissions (defaults to getDefaultListRelations())
     * - Modified getByField() to branch on the return value of getDefaultGetByIdRelations()
     */

    it('should call findOneWithRelations when getDefaultGetByIdRelations returns a config', async () => {
        // Arrange
        const relations: ListRelationsConfig = { destination: true };
        class ServiceWithRelations extends TestService {
            protected override getDefaultListRelations(): ListRelationsConfig {
                return relations;
            }
        }
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findOneWithRelations).mockResolvedValue(mockEntity);
        const localService = createServiceTestInstance(ServiceWithRelations, localModelMock);

        // Act
        const result = await localService.getByField(mockActor, 'id', MOCK_ENTITY_ID);

        // Assert
        expect(asMock(localModelMock.findOneWithRelations)).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            relations,
            undefined
        );
        expect(asMock(localModelMock.findOne)).not.toHaveBeenCalled();
        expect(result.data).toEqual(mockEntity);
        expect(result.error).toBeUndefined();
    });

    it('should call findOne and NOT findOneWithRelations when getDefaultGetByIdRelations returns undefined', async () => {
        // Arrange
        class ServiceWithNoRelations extends TestService {
            protected override getDefaultListRelations(): ListRelationsConfig {
                return undefined;
            }

            protected override getDefaultGetByIdRelations(): ListRelationsConfig {
                return undefined;
            }
        }
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findOne).mockResolvedValue(mockEntity);
        const localService = createServiceTestInstance(ServiceWithNoRelations, localModelMock);

        // Act
        const result = await localService.getByField(mockActor, 'id', MOCK_ENTITY_ID);

        // Assert
        expect(asMock(localModelMock.findOne)).toHaveBeenCalledWith({ id: MOCK_ENTITY_ID });
        expect(asMock(localModelMock.findOneWithRelations)).not.toHaveBeenCalled();
        expect(result.data).toEqual(mockEntity);
        expect(result.error).toBeUndefined();
    });

    it('should return the same config from getDefaultGetByIdRelations as getDefaultListRelations by default', () => {
        // Arrange
        const relations: ListRelationsConfig = { destination: true };
        class ServiceWithListRelations extends TestService {
            protected override getDefaultListRelations(): ListRelationsConfig {
                return relations;
            }
        }
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        const localService = createServiceTestInstance(ServiceWithListRelations, localModelMock);

        // Act — access protected method via cast
        const byId = (
            localService as unknown as {
                getDefaultGetByIdRelations: () => ListRelationsConfig;
                getDefaultListRelations: () => ListRelationsConfig;
            }
        ).getDefaultGetByIdRelations();
        const list = (
            localService as unknown as {
                getDefaultGetByIdRelations: () => ListRelationsConfig;
                getDefaultListRelations: () => ListRelationsConfig;
            }
        ).getDefaultListRelations();

        // Assert
        expect(byId).toBe(list);
        expect(byId).toEqual(relations);
    });

    it('should use the custom getDefaultGetByIdRelations override when provided', async () => {
        // Arrange
        const listRelations: ListRelationsConfig = { destination: true };
        const byIdRelations: ListRelationsConfig = { author: true };
        class ServiceWithCustomByIdRelations extends TestService {
            protected override getDefaultListRelations(): ListRelationsConfig {
                return listRelations;
            }

            protected override getDefaultGetByIdRelations(): ListRelationsConfig {
                return byIdRelations;
            }
        }
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findOneWithRelations).mockResolvedValue(mockEntity);
        const localService = createServiceTestInstance(
            ServiceWithCustomByIdRelations,
            localModelMock
        );

        // Act
        await localService.getByField(mockActor, 'id', MOCK_ENTITY_ID);

        // Assert — byIdRelations, NOT listRelations, must be forwarded
        expect(asMock(localModelMock.findOneWithRelations)).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            byIdRelations,
            undefined
        );
    });

    it('should forward nested relation configs to findOneWithRelations', async () => {
        // Arrange
        const nestedRelations: ListRelationsConfig = { sponsorship: { sponsor: true } };
        class ServiceWithNestedRelations extends TestService {
            protected override getDefaultListRelations(): ListRelationsConfig {
                return nestedRelations;
            }
        }
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findOneWithRelations).mockResolvedValue(mockEntity);
        const localService = createServiceTestInstance(ServiceWithNestedRelations, localModelMock);

        // Act
        await localService.getByField(mockActor, 'id', MOCK_ENTITY_ID);

        // Assert
        expect(asMock(localModelMock.findOneWithRelations)).toHaveBeenCalledWith(
            { id: MOCK_ENTITY_ID },
            nestedRelations,
            undefined
        );
    });

    it('should trigger findOneWithRelations when called via getBySlug', async () => {
        // Arrange
        const relations: ListRelationsConfig = { destination: true };
        class ServiceWithRelations extends TestService {
            protected override getDefaultListRelations(): ListRelationsConfig {
                return relations;
            }
        }
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findOneWithRelations).mockResolvedValue(mockEntity);
        const localService = createServiceTestInstance(ServiceWithRelations, localModelMock);

        // Act
        const result = await localService.getBySlug(mockActor, 'test-slug');

        // Assert
        expect(asMock(localModelMock.findOneWithRelations)).toHaveBeenCalledWith(
            { slug: 'test-slug' },
            relations,
            undefined
        );
        expect(asMock(localModelMock.findOne)).not.toHaveBeenCalled();
        expect(result.data).toEqual(mockEntity);
    });
});
