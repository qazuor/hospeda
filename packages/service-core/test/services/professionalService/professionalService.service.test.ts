import type { ProfessionalServiceTypeModel } from '@repo/db';
import {
    PermissionEnum,
    ProfessionalServiceCategoryEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { ProfessionalService } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalServiceService } from '../../../src/services/professionalService/professionalService.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';
import { createMockLogger } from '../../utils/mockLogger.js';

describe('ProfessionalServiceService', () => {
    let service: ProfessionalServiceService;
    let mockModel: ProfessionalServiceTypeModel;
    let adminActor: Actor;
    let userActor: Actor;

    const mockProfessionalService: ProfessionalService = {
        id: 'ps-123',
        name: 'Test Service',
        description: 'Test professional service',
        category: ProfessionalServiceCategoryEnum.DESIGN,
        defaultPricing: {
            basePrice: 75000,
            currency: 'ARS',
            billingUnit: 'project' as const,
            minOrderValue: 50000,
            maxOrderValue: 200000
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'user-123',
        updatedById: 'user-123',
        deletedAt: null,
        deletedById: null,
        adminInfo: undefined
    };

    beforeEach(() => {
        const ctx: ServiceContext = {
            logger: createMockLogger()
        };

        mockModel = {
            create: vi.fn().mockResolvedValue(mockProfessionalService),
            findById: vi.fn().mockResolvedValue(mockProfessionalService),
            findOne: vi.fn().mockResolvedValue(mockProfessionalService),
            findAll: vi.fn().mockResolvedValue({
                items: [mockProfessionalService],
                total: 1
            }),
            findAllWithRelations: vi.fn().mockResolvedValue({
                items: [mockProfessionalService],
                total: 1
            }),
            update: vi.fn().mockResolvedValue(mockProfessionalService),
            softDelete: vi.fn().mockResolvedValue(1),
            hardDelete: vi.fn().mockResolvedValue(1),
            restore: vi.fn().mockResolvedValue(1),
            count: vi.fn().mockResolvedValue(1)
        } as unknown as ProfessionalServiceTypeModel;

        service = new ProfessionalServiceService(ctx, mockModel);

        adminActor = {
            id: 'admin-123',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.PROFESSIONAL_SERVICE_CREATE,
                PermissionEnum.PROFESSIONAL_SERVICE_UPDATE,
                PermissionEnum.PROFESSIONAL_SERVICE_DELETE,
                PermissionEnum.PROFESSIONAL_SERVICE_VIEW,
                PermissionEnum.PROFESSIONAL_SERVICE_HARD_DELETE,
                PermissionEnum.PROFESSIONAL_SERVICE_RESTORE
            ]
        };

        userActor = {
            id: 'user-123',
            role: RoleEnum.USER,
            permissions: [PermissionEnum.PROFESSIONAL_SERVICE_VIEW]
        };
    });

    describe('Constructor', () => {
        it('should create service instance', () => {
            expect(service).toBeDefined();
            expect(service).toBeInstanceOf(ProfessionalServiceService);
        });

        it('should have correct entity name', () => {
            expect((service as any).entityName).toBe('professional-service');
        });
    });

    describe('create', () => {
        it('should create a new professional service with valid data', async () => {
            const createData = {
                name: 'Interior Design Service',
                description: 'Professional interior design services for accommodation spaces',
                isActive: true,
                category: ProfessionalServiceCategoryEnum.DESIGN,
                defaultPricing: {
                    basePrice: 75000,
                    currency: 'ARS',
                    billingUnit: 'project' as const,
                    minOrderValue: 50000,
                    maxOrderValue: 200000
                }
            };

            (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(
                mockProfessionalService
            );
            const result = await service.create(adminActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.create).toHaveBeenCalled();
        });

        it('should throw ServiceError if actor lacks permission', async () => {
            const createData = {
                name: 'Consulting Service',
                description: 'Professional consulting services for accommodations',
                isActive: true,
                category: ProfessionalServiceCategoryEnum.CONSULTING,
                defaultPricing: {
                    basePrice: 100000,
                    currency: 'ARS',
                    billingUnit: 'hour' as const,
                    minOrderValue: 0,
                    maxOrderValue: 500000
                }
            };

            const result = await service.create(userActor, createData);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('update', () => {
        it('should update professional service with valid data', async () => {
            const updateData = {
                name: 'Updated Service Name',
                description: 'Updated service description with more details about offerings'
            };

            const result = await service.update(adminActor, mockProfessionalService.id, updateData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.update).toHaveBeenCalled();
        });

        it('should update pricing information', async () => {
            const updateData = {
                defaultPricing: {
                    basePrice: 60000,
                    currency: 'ARS',
                    billingUnit: 'day' as const,
                    minOrderValue: 40000,
                    maxOrderValue: 150000
                }
            };

            const result = await service.update(adminActor, mockProfessionalService.id, updateData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.update).toHaveBeenCalled();
        });

        it('should forbid non-admin without permission to update', async () => {
            const otherUserActor = {
                id: 'user-other',
                role: RoleEnum.USER,
                permissions: []
            };

            const updateData = {
                name: 'Unauthorized Update'
            };

            const result = await service.update(
                otherUserActor,
                mockProfessionalService.id,
                updateData
            );

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('getById', () => {
        it('should retrieve professional service by id', async () => {
            const result = await service.getById(adminActor, mockProfessionalService.id);

            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(mockProfessionalService.id);
            expect(mockModel.findOne).toHaveBeenCalledWith({ id: mockProfessionalService.id });
        });

        it('should throw NOT_FOUND if professional service does not exist', async () => {
            (mockModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const result = await service.getById(adminActor, 'non-existent-id');

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should list all professional services with pagination', async () => {
            const result = await service.list(adminActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.total).toBe(1);
        });

        it('should allow any user with VIEW permission to list professional services', async () => {
            const result = await service.list(userActor, {});

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should filter by active status', async () => {
            const result = await service.list(adminActor, {
                page: 1,
                pageSize: 10
            });

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });

    describe('softDelete', () => {
        it('should soft delete professional service as admin', async () => {
            const result = await service.softDelete(adminActor, mockProfessionalService.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.softDelete).toHaveBeenCalled();
        });

        it('should forbid non-admin to soft delete', async () => {
            const result = await service.softDelete(userActor, mockProfessionalService.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('hardDelete', () => {
        it('should hard delete professional service as admin with HARD_DELETE permission', async () => {
            const result = await service.hardDelete(adminActor, mockProfessionalService.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockModel.hardDelete).toHaveBeenCalled();
        });

        it('should forbid user without HARD_DELETE permission', async () => {
            const result = await service.hardDelete(userActor, mockProfessionalService.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('restore', () => {
        it('should restore soft-deleted professional service', async () => {
            // Mock a soft-deleted service (with deletedAt set)
            const deletedService = {
                ...mockProfessionalService,
                deletedAt: new Date()
            };
            (mockModel.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(deletedService);

            const result = await service.restore(adminActor, mockProfessionalService.id);

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
            expect(result.error).toBeUndefined();
        });

        it('should forbid user without RESTORE permission', async () => {
            const result = await service.restore(userActor, mockProfessionalService.id);

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    describe('search', () => {
        it('should search professional services with filters', async () => {
            const searchParams = {
                isActive: true,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            };

            const result = await service.search(adminActor, searchParams);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should search by category', async () => {
            const searchParams = {
                category: ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            };

            const result = await service.search(adminActor, searchParams);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should handle empty search results', async () => {
            (mockModel.findAll as ReturnType<typeof vi.fn>).mockResolvedValue({
                items: [],
                total: 0
            });

            const result = await service.search(adminActor, {
                category: ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(0);
        });
    });

    describe('count', () => {
        it('should count professional services matching criteria', async () => {
            const result = await service.count(adminActor, {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            });

            expect(result.data).toBeDefined();
            expect(result.data?.count).toBe(1);
        });

        it('should count with active filter', async () => {
            const result = await service.count(adminActor, {
                isActive: true,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            });

            expect(result.data).toBeDefined();
            expect(mockModel.count).toHaveBeenCalled();
        });
    });

    describe('Service Status and Availability', () => {
        it('should list only active services when filtered', async () => {
            const activeService = {
                ...mockProfessionalService,
                isActive: true
            };
            (mockModel.findAll as ReturnType<typeof vi.fn>).mockResolvedValue({
                items: [activeService],
                total: 1
            });

            const result = await service.search(adminActor, {
                isActive: true,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.items[0]?.isActive).toBe(true);
        });

        it('should deactivate a service by updating isActive', async () => {
            const updatedService = {
                ...mockProfessionalService,
                isActive: false,
                updatedAt: new Date()
            };
            (mockModel.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedService);

            const result = await service.update(adminActor, mockProfessionalService.id, {
                isActive: false
            });

            expect(result.data).toBeDefined();
            expect(mockModel.update).toHaveBeenCalled();
        });
    });

    describe('Pricing Variations', () => {
        it('should handle hourly billing services', async () => {
            const hourlyService = {
                ...mockProfessionalService,
                id: 'ps-hourly',
                name: 'Hourly Consulting',
                description: 'Professional consulting billed hourly',
                category: ProfessionalServiceCategoryEnum.CONSULTING,
                defaultPricing: {
                    basePrice: 15000,
                    currency: 'ARS',
                    billingUnit: 'hour' as const,
                    minOrderValue: 15000,
                    maxOrderValue: 150000
                }
            };
            (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(hourlyService);

            const createData = {
                name: 'Hourly Consulting',
                description: 'Professional consulting billed hourly',
                isActive: true,
                category: ProfessionalServiceCategoryEnum.CONSULTING,
                defaultPricing: {
                    basePrice: 15000,
                    currency: 'ARS',
                    billingUnit: 'hour' as const,
                    minOrderValue: 15000,
                    maxOrderValue: 150000
                }
            };

            const result = await service.create(adminActor, createData);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should handle project-based billing services', async () => {
            const projectService = {
                ...mockProfessionalService,
                id: 'ps-project',
                name: 'Project Service',
                description: 'Professional service billed per project',
                category: ProfessionalServiceCategoryEnum.DESIGN,
                defaultPricing: {
                    basePrice: 100000,
                    currency: 'ARS',
                    billingUnit: 'project' as const,
                    minOrderValue: 50000,
                    maxOrderValue: 300000
                }
            };
            (mockModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(projectService);

            const result = await service.create(adminActor, {
                name: 'Project Service',
                description: 'Professional service billed per project',
                isActive: true,
                category: ProfessionalServiceCategoryEnum.DESIGN,
                defaultPricing: {
                    basePrice: 100000,
                    currency: 'ARS',
                    billingUnit: 'project' as const,
                    minOrderValue: 50000,
                    maxOrderValue: 300000
                }
            });

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });
    });
});
