import type { ListRelationsConfig } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseCrudService } from '../../src/base/base.crud.service';
import type { Actor, ServiceContext } from '../../src/types';

// Mock base model for testing
class MockModel {
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
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

// Test service implementation
class TestCrudService extends BaseCrudService<any, MockModel, any, any, any> {
    protected readonly model: MockModel;
    protected readonly createSchema = z.object({ name: z.string() });
    protected readonly updateSchema = z.object({ name: z.string().optional() });
    protected readonly searchSchema = z.object({ q: z.string().optional() });

    constructor(ctx: ServiceContext, model?: MockModel) {
        super(ctx, 'test_entity');
        this.model = model || new MockModel();
    }

    // Implement abstract method with default relations
    protected getDefaultListRelations(): ListRelationsConfig {
        return {
            category: true,
            tags: true
        };
    }

    // Implement all required permission methods
    protected _canCreate(): void {}
    protected _canUpdate(): void {}
    protected _canSoftDelete(): void {}
    protected _canHardDelete(): void {}
    protected _canRestore(): void {}
    protected _canView(): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}
    protected async _executeSearch(): Promise<any> {
        return { data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } };
    }
    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

describe('BaseCrudService - Relations Support', () => {
    let service: TestCrudService;
    let mockContext: ServiceContext;
    let mockModel: MockModel;
    let mockActor: Actor;

    const mockPaginatedResult = {
        data: [
            { id: 1, name: 'Test 1', categoryId: 1 },
            { id: 2, name: 'Test 2', categoryId: 2 }
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
        mockContext = {} as ServiceContext;

        mockActor = {
            id: 'test-user',
            type: 'user',
            role: RoleEnum.USER,
            permissions: []
        } as Actor;

        mockModel = new MockModel();
        service = new TestCrudService(mockContext, mockModel);
    });

    describe('list method with relations', () => {
        it('should call findAllWithRelations when custom relations provided', async () => {
            // Setup
            const customRelations: ListRelationsConfig = {
                author: true
            };

            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { relations: customRelations });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                customRelations,
                {},
                { page: undefined, pageSize: undefined }
            );
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });

        it('should use default relations when no relations parameter provided', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, {});

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { category: true, tags: true },
                {},
                { page: undefined, pageSize: undefined }
            );
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });

        it('should override default relations when specific relations provided', async () => {
            // Setup
            const customRelations: ListRelationsConfig = {
                user: true
            };

            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { relations: customRelations });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                customRelations,
                {},
                { page: undefined, pageSize: undefined }
            );
        });

        it('should handle pagination correctly with relations', async () => {
            // Setup
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await service.list(mockActor, { page: 2, pageSize: 5 });

            // Verify
            expect(result.data).toBeDefined();
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith(
                { category: true, tags: true },
                {},
                { page: 2, pageSize: 5 }
            );
        });

        it('should propagate errors from findAllWithRelations', async () => {
            // Setup
            const error = new Error('Database error');
            mockModel.findAllWithRelations.mockRejectedValue(error);

            // Execute
            const result = await service.list(mockActor, {});

            // Verify
            expect(result.error).toBeDefined();
            expect(result.error?.details).toEqual(error);
            expect(mockModel.findAllWithRelations).toHaveBeenCalled();
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });
    });

    describe('getDefaultListRelations method', () => {
        it('should return configured default relations', () => {
            // Execute
            const relations = (service as any).getDefaultListRelations();

            // Verify
            expect(relations).toEqual({
                category: true,
                tags: true
            });
        });
    });

    describe('backwards compatibility', () => {
        it('should work with service that has no default relations', async () => {
            // Setup - Service without default relations
            class LegacyService extends BaseCrudService<any, MockModel, any, any, any> {
                protected readonly model: MockModel;
                protected readonly createSchema = z.object({ name: z.string() });
                protected readonly updateSchema = z.object({ name: z.string().optional() });
                protected readonly searchSchema = z.object({ q: z.string().optional() });

                constructor(ctx: ServiceContext, model?: MockModel) {
                    super(ctx, 'legacy_entity');
                    this.model = model || new MockModel();
                }

                protected getDefaultListRelations(): ListRelationsConfig {
                    return {};
                }

                // Implement all required permission methods
                protected _canCreate(): void {}
                protected _canUpdate(): void {}
                protected _canSoftDelete(): void {}
                protected _canHardDelete(): void {}
                protected _canRestore(): void {}
                protected _canView(): void {}
                protected _canList(): void {}
                protected _canSearch(): void {}
                protected _canCount(): void {}
                protected _canUpdateVisibility(): void {}
                protected async _executeSearch(): Promise<any> {
                    return {
                        data: [],
                        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
                    };
                }
                protected async _executeCount(): Promise<{ count: number }> {
                    return { count: 0 };
                }
            }

            const legacyService = new LegacyService(mockContext, mockModel);

            // El servicio aún usa findAllWithRelations pero con un objeto vacío
            mockModel.findAllWithRelations.mockResolvedValue(mockPaginatedResult);

            // Execute
            const result = await legacyService.list(mockActor, {});

            // Verify
            expect(result.data).toBeDefined();
            // Cuando getDefaultListRelations() retorna {}, aún llama findAllWithRelations
            expect(mockModel.findAllWithRelations).toHaveBeenCalledWith({}, {}, {});
            expect(mockModel.findAll).not.toHaveBeenCalled();
        });
    });
});
