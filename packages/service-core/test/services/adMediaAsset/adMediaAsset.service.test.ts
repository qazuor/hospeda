/**
 * AdMediaAssetService Test Suite
 *
 * Comprehensive tests for AdMediaAssetService following TDD methodology (RED-GREEN-REFACTOR).
 * Tests cover CRUD operations, permission hooks, and business logic methods.
 *
 * @module AdMediaAssetServiceTest
 */

import type { AdMediaAssetModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdMediaAssetService } from '../../../src/services/adMediaAsset/adMediaAsset.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

describe('AdMediaAssetService', () => {
    let service: AdMediaAssetService;
    let mockModel: AdMediaAssetModel;
    let ctx: ServiceContext;

    // Test data
    const adminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: []
    };

    const userWithPermissions: Actor = {
        id: 'user-123',
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.AD_MEDIA_ASSET_CREATE,
            PermissionEnum.AD_MEDIA_ASSET_UPDATE,
            PermissionEnum.AD_MEDIA_ASSET_DELETE,
            PermissionEnum.AD_MEDIA_ASSET_VIEW
        ]
    };

    const userWithoutPermissions: Actor = {
        id: 'user-456',
        role: RoleEnum.USER,
        permissions: []
    };

    const validAssetData = {
        campaignId: 'campaign-123',
        type: 'IMAGE' as const,
        url: 'https://example.com/image.jpg',
        specs: {
            format: 'image/jpeg',
            file: {
                originalFileName: 'banner.jpg',
                fileSize: 102400,
                url: 'https://example.com/image.jpg'
            },
            dimensions: {
                width: 1200,
                height: 628,
                aspectRatio: '1.91:1'
            },
            status: 'active' as const
        }
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as ServiceContext;

        mockModel = {
            findById: vi.fn(),
            update: vi.fn(),
            findAll: vi.fn(),
            findByCampaign: vi.fn(),
            findByType: vi.fn(),
            getAssetsByFormat: vi.fn()
        } as unknown as AdMediaAssetModel;

        service = new AdMediaAssetService(ctx, mockModel);
    });

    // ============================================================================
    // Permission Hook Tests
    // ============================================================================

    describe('Permission Hooks', () => {
        it('should allow ADMIN to create', () => {
            expect(() => service._canCreate(adminActor, {})).not.toThrow();
        });

        it('should allow user with AD_MEDIA_ASSET_CREATE permission', () => {
            expect(() => service._canCreate(userWithPermissions, {})).not.toThrow();
        });

        it('should deny user without AD_MEDIA_ASSET_CREATE permission', () => {
            expect(() => service._canCreate(userWithoutPermissions, {})).toThrow();
        });

        it('should allow ADMIN to update', () => {
            expect(() => service._canUpdate(adminActor, validAssetData as any)).not.toThrow();
        });

        it('should allow user with AD_MEDIA_ASSET_UPDATE permission', () => {
            expect(() =>
                service._canUpdate(userWithPermissions, validAssetData as any)
            ).not.toThrow();
        });

        it('should deny user without AD_MEDIA_ASSET_UPDATE permission', () => {
            expect(() =>
                service._canUpdate(userWithoutPermissions, validAssetData as any)
            ).toThrow();
        });

        it('should allow ADMIN to soft delete', () => {
            expect(() => service._canSoftDelete(adminActor, validAssetData as any)).not.toThrow();
        });

        it('should allow user with AD_MEDIA_ASSET_DELETE permission', () => {
            expect(() =>
                service._canSoftDelete(userWithPermissions, validAssetData as any)
            ).not.toThrow();
        });

        it('should deny user without AD_MEDIA_ASSET_DELETE permission', () => {
            expect(() =>
                service._canSoftDelete(userWithoutPermissions, validAssetData as any)
            ).toThrow();
        });

        it('should allow ADMIN to view', () => {
            expect(() => service._canView(adminActor, validAssetData as any)).not.toThrow();
        });

        it('should allow user with AD_MEDIA_ASSET_VIEW permission', () => {
            expect(() =>
                service._canView(userWithPermissions, validAssetData as any)
            ).not.toThrow();
        });

        it('should deny user without AD_MEDIA_ASSET_VIEW permission', () => {
            expect(() => service._canView(userWithoutPermissions, validAssetData as any)).toThrow();
        });
    });

    // ============================================================================
    // Custom Finder Methods Tests
    // ============================================================================

    describe('Custom Finder Methods', () => {
        describe('findByCampaign', () => {
            it('should find all assets for a campaign', async () => {
                const mockAssets = [
                    validAssetData as any,
                    { ...validAssetData, id: 'asset-2' } as any
                ];
                vi.mocked(mockModel.findByCampaign).mockResolvedValue(mockAssets);

                const result = await service.findByCampaign(adminActor, 'campaign-123');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.findByCampaign).toHaveBeenCalledWith('campaign-123');
                if (result.data) {
                    expect(result.data.length).toBe(2);
                }
            });

            it('should check view permission', async () => {
                const result = await service.findByCampaign(userWithoutPermissions, 'campaign-123');

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(mockModel.findByCampaign).not.toHaveBeenCalled();
            });
        });

        describe('findByType', () => {
            it('should find all assets of specific type', async () => {
                const mockAssets = [validAssetData as any];
                vi.mocked(mockModel.findByType).mockResolvedValue(mockAssets);

                const result = await service.findByType(adminActor, 'IMAGE' as any);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.findByType).toHaveBeenCalledWith('IMAGE');
                if (result.data) {
                    expect(result.data.length).toBe(1);
                }
            });

            it('should check view permission', async () => {
                const result = await service.findByType(userWithoutPermissions, 'IMAGE' as any);

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(mockModel.findByType).not.toHaveBeenCalled();
            });
        });

        describe('getAssetsByFormat', () => {
            it('should find all assets with specific format', async () => {
                const mockAssets = [validAssetData as any];
                vi.mocked(mockModel.getAssetsByFormat).mockResolvedValue(mockAssets);

                const result = await service.getAssetsByFormat(adminActor, 'image/jpeg');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.getAssetsByFormat).toHaveBeenCalledWith('image/jpeg');
                if (result.data) {
                    expect(result.data.length).toBe(1);
                }
            });

            it('should check view permission', async () => {
                const result = await service.getAssetsByFormat(
                    userWithoutPermissions,
                    'image/jpeg'
                );

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                expect(mockModel.getAssetsByFormat).not.toHaveBeenCalled();
            });
        });
    });

    // ============================================================================
    // Business Logic Methods Tests
    // ============================================================================

    describe('Business Logic Methods', () => {
        describe('updateStatus', () => {
            it('should update asset status', async () => {
                const mockAsset = { ...validAssetData, id: 'asset-1' } as any;
                const updatedAsset = {
                    ...mockAsset,
                    specs: { ...validAssetData.specs, status: 'inactive' }
                } as any;

                vi.mocked(mockModel.findById).mockResolvedValue(mockAsset);
                vi.mocked(mockModel.update).mockResolvedValue(updatedAsset);

                const result = await service.updateStatus(adminActor, 'asset-1', 'inactive');

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.update).toHaveBeenCalled();
                if (result.data) {
                    const specs = result.data.specs as { status?: string };
                    expect(specs?.status).toBe('inactive');
                }
            });

            it('should validate status enum', async () => {
                const mockAsset = { ...validAssetData, id: 'asset-1' } as any;
                vi.mocked(mockModel.findById).mockResolvedValue(mockAsset);

                const result = await service.updateStatus(adminActor, 'asset-1', 'invalid-status');

                expect(result.error).toBeDefined();
                expect(result.data).toBeUndefined();
                if (result.error) {
                    expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                }
            });

            it('should require update permission', async () => {
                const result = await service.updateStatus(
                    userWithoutPermissions,
                    'asset-1',
                    'inactive'
                );

                expect(result.error).toBeDefined();
            });
        });

        describe('updatePerformance', () => {
            it('should update performance metrics and calculate engagement rate', async () => {
                const mockAsset = { ...validAssetData, id: 'asset-1' } as any;
                const updatedAsset = {
                    ...mockAsset,
                    specs: {
                        ...validAssetData.specs,
                        performance: {
                            totalViews: 1000,
                            totalClicks: 50,
                            averageViewDuration: 30,
                            engagementRate: 0.05
                        }
                    }
                } as any;

                vi.mocked(mockModel.findById).mockResolvedValue(mockAsset);
                vi.mocked(mockModel.update).mockResolvedValue(updatedAsset);

                const metrics = {
                    totalViews: 1000,
                    totalClicks: 50,
                    averageViewDuration: 30
                };

                const result = await service.updatePerformance(adminActor, 'asset-1', metrics);

                expect(result.data).toBeDefined();
                expect(result.error).toBeUndefined();
                expect(mockModel.update).toHaveBeenCalled();
                if (result.data) {
                    const specs = result.data.specs as {
                        performance?: {
                            totalViews?: number;
                            totalClicks?: number;
                            averageViewDuration?: number;
                            engagementRate?: number;
                        };
                    };
                    expect(specs?.performance?.totalViews).toBe(1000);
                    expect(specs?.performance?.totalClicks).toBe(50);
                    expect(specs?.performance?.engagementRate).toBe(0.05);
                }
            });

            it('should require update permission', async () => {
                const result = await service.updatePerformance(userWithoutPermissions, 'asset-1', {
                    totalViews: 1000
                });

                expect(result.error).toBeDefined();
            });
        });

        describe('markAsActive', () => {
            it('should mark asset as active', async () => {
                const mockAsset = {
                    ...validAssetData,
                    id: 'asset-1',
                    specs: { ...validAssetData.specs, status: 'draft' }
                } as any;
                const updatedAsset = {
                    ...mockAsset,
                    specs: { ...validAssetData.specs, status: 'active' }
                } as any;

                vi.mocked(mockModel.findById).mockResolvedValue(mockAsset);
                vi.mocked(mockModel.update).mockResolvedValue(updatedAsset);

                const result = await service.markAsActive(adminActor, 'asset-1');

                expect(result.data).toBeDefined();
                if (result.data) {
                    const specs = result.data.specs as { status?: string };
                    expect(specs?.status).toBe('active');
                }
            });
        });

        describe('markAsInactive', () => {
            it('should mark asset as inactive', async () => {
                const mockAsset = { ...validAssetData, id: 'asset-1' } as any;
                const updatedAsset = {
                    ...mockAsset,
                    specs: { ...validAssetData.specs, status: 'inactive' }
                } as any;

                vi.mocked(mockModel.findById).mockResolvedValue(mockAsset);
                vi.mocked(mockModel.update).mockResolvedValue(updatedAsset);

                const result = await service.markAsInactive(adminActor, 'asset-1');

                expect(result.data).toBeDefined();
                if (result.data) {
                    const specs = result.data.specs as { status?: string };
                    expect(specs?.status).toBe('inactive');
                }
            });
        });

        describe('archive', () => {
            it('should archive asset', async () => {
                const mockAsset = { ...validAssetData, id: 'asset-1' } as any;
                const updatedAsset = {
                    ...mockAsset,
                    specs: { ...validAssetData.specs, status: 'archived' }
                } as any;

                vi.mocked(mockModel.findById).mockResolvedValue(mockAsset);
                vi.mocked(mockModel.update).mockResolvedValue(updatedAsset);

                const result = await service.archive(adminActor, 'asset-1');

                expect(result.data).toBeDefined();
                if (result.data) {
                    const specs = result.data.specs as { status?: string };
                    expect(specs?.status).toBe('archived');
                }
            });
        });
    });
});
