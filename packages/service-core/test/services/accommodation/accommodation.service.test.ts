import { AccommodationTypeEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

// Mock AccommodationModel
class MockAccommodationModel {
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
    // BaseModel always exposes getTable(); default to an empty table (no deletedAt
    // column) so list() does not inject the SPEC-230 soft-delete predicate here.
    getTable = vi.fn().mockReturnValue({});
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
}

// Mock DestinationService
vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

describe('AccommodationService - Relations Support', () => {
    let service: AccommodationService;
    let mockContext: ServiceConfig;
    let mockModel: MockAccommodationModel;
    let mockActor: Actor;

    const mockPaginatedResult = {
        data: [
            { id: 1, name: 'Hotel Test', destinationId: 1, ownerId: 'user1' },
            { id: 2, name: 'Apartamento Test', destinationId: 2, ownerId: 'user2' }
        ],
        pagination: {
            page: 1,
            pageSize: 10,
            total: 2,
            totalPages: 1
        }
    };

    beforeEach(() => {
        // Create mocks
        mockContext = {} as ServiceConfig;

        mockActor = {
            id: 'test-user',
            type: 'user',
            roles: [RoleEnum.USER],
            permissions: []
        } as Actor;

        mockModel = new MockAccommodationModel();
        service = new AccommodationService(mockContext, mockModel as any);
    });

    describe('getDefaultListRelations method', () => {
        it('should return configured default relations for accommodations', () => {
            // Execute
            const relations = (service as any).getDefaultListRelations();

            // Verify
            expect(relations).toEqual({
                destination: true,
                owner: true
            });
        });
    });

    describe('list method with default relations', () => {
        it('should use accommodation-specific default relations when listing', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, {});

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { destination: true, owner: true },
                {},
                { page: undefined, pageSize: undefined },
                undefined,
                undefined
            );
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });

        it('should override default relations when custom relations provided', async () => {
            // Setup
            const customRelations = {
                images: true,
                reviews: true
            };
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { relations: customRelations });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                customRelations,
                {},
                { page: undefined, pageSize: undefined },
                undefined,
                undefined
            );
        });

        it('should handle pagination with relations correctly', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { page: 2, pageSize: 20 });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { destination: true, owner: true },
                {},
                { page: 2, pageSize: 20 },
                undefined,
                undefined
            );
        });
    });

    /**
     * The actual `richDescription` round-trip test (create → re-fetch → assert)
     * lives in `test/integration/services/accommodation.richDescription.integration.test.ts`
     * because `service.create` traverses `_beforeCreate` → `_assertDestinationIsCity`
     * which requires a real destination row. Mock-based unit tests cannot satisfy
     * that without an unwieldy stub tree.
     */
});

describe('AccommodationService business-line validation hooks', () => {
    class TestAccommodationService extends AccommodationService {
        public runBeforeCreate(
            data: Parameters<AccommodationService['_beforeCreate']>[0],
            actor: Actor
        ) {
            return this._beforeCreate(data, actor, { hookState: {} });
        }

        public runBeforeUpdate(
            data: Parameters<AccommodationService['_beforeUpdate']>[0],
            actor: Actor
        ) {
            return this._beforeUpdate(data, actor, { hookState: { updateId: 'accommodation-id' } });
        }
    }

    it('rejects empty business lines on create with field and reason details', async () => {
        const service = new TestAccommodationService(
            {} as ServiceConfig,
            new MockAccommodationModel() as never
        );
        await expect(
            service.runBeforeCreate(
                {
                    type: AccommodationTypeEnum.HOTEL,
                    name: 'Hotel Test',
                    slug: 'hotel-test',
                    description: 'Descripción del hotel de prueba.',
                    summary: 'Hotel de prueba.',
                    ownerId: 'owner',
                    destinationId: undefined as never,
                    averageRating: 0,
                    businessLines: []
                },
                createActor({ id: 'owner' })
            )
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            details: { field: 'businessLines', reason: 'EMPTY' }
        });
    });

    it('validates changed type against stored lines and ignores untouched legacy lines', async () => {
        const model = new MockAccommodationModel();
        model.findById.mockResolvedValue({
            id: 'accommodation-id',
            type: AccommodationTypeEnum.HOTEL,
            businessLines: ['standard']
        });
        const service = new TestAccommodationService({} as ServiceConfig, model as never);
        await expect(
            service.runBeforeUpdate(
                { type: AccommodationTypeEnum.APARTMENT },
                createActor({ id: 'owner' })
            )
        ).resolves.toBeDefined();

        model.findById.mockResolvedValue({
            id: 'accommodation-id',
            type: AccommodationTypeEnum.HOTEL
        });
        await expect(
            service.runBeforeUpdate({ name: 'Updated hotel' }, createActor({ id: 'owner' }))
        ).resolves.toMatchObject({ name: 'Updated hotel' });
    });
});
