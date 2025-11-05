import type { CampaignModel } from '@repo/db';
import { type Campaign, CampaignStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignService } from '../../../src/services/campaign/campaign.service.js';
import type { Actor } from '../../../src/types/index.js';

describe('CampaignService', () => {
    let service: CampaignService;
    let mockModel: CampaignModel;
    let mockActor: Actor;
    let ctx: import('../../../src/types/index.js').ServiceContext;

    // Mock data
    const mockCampaign: Campaign = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Summer Campaign 2024',
        description: 'Summer promotional campaign for tourism services',
        status: CampaignStatusEnum.DRAFT,
        clientId: '00000000-0000-0000-0000-000000000010',
        channels: ['EMAIL', 'SOCIAL_MEDIA'],
        targetAudience: {
            countries: ['AR'],
            cities: ['Concepción del Uruguay'],
            interests: ['tourism', 'travel']
        },
        budget: {
            totalBudget: 5000,
            dailyBudget: 200,
            spentAmount: 0,
            currency: 'ARS',
            bidStrategy: 'automatic'
        },
        schedule: {
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-08-31'),
            timezone: 'America/Argentina/Buenos_Aires'
        },
        content: {
            subject: 'Discover Summer Destinations',
            bodyTemplate: 'Explore amazing summer destinations in the Litoral region...',
            callToAction: 'Book Now',
            landingPageUrl: 'https://example.com/summer',
            assets: []
        },
        performance: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            clickThroughRate: 0,
            conversionRate: 0,
            costPerClick: 0,
            costPerConversion: 0,
            returnOnAdSpend: 0
        },
        settings: {
            priority: 3,
            isTestCampaign: false,
            allowOptOut: true,
            trackingEnabled: true,
            tags: []
        },
        createdById: '00000000-0000-0000-0000-000000000099',
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: null,
        deletedAt: null,
        deletedById: null
    };

    beforeEach(() => {
        ctx = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as import('../../../src/types/index.js').ServiceContext;

        mockActor = {
            id: '00000000-0000-0000-0000-000000000100',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.CAMPAIGN_CREATE,
                PermissionEnum.CAMPAIGN_UPDATE,
                PermissionEnum.CAMPAIGN_DELETE,
                PermissionEnum.CAMPAIGN_VIEW
            ]
        };

        mockModel = {
            findById: vi.fn(),
            update: vi.fn(),
            findAll: vi.fn(),
            findByClient: vi.fn(),
            findActive: vi.fn()
        } as unknown as CampaignModel;

        service = new CampaignService(ctx, mockModel);
    });

    // =========================================================================
    // Permission Hook Tests
    // =========================================================================

    describe('Permission Hooks', () => {
        it('should allow ADMIN to create campaign', () => {
            expect(() => service._canCreate(mockActor, {})).not.toThrow();
        });

        it('should allow user with CAMPAIGN_CREATE permission to create campaign', () => {
            const actorWithPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CAMPAIGN_CREATE]
            };

            expect(() => service._canCreate(actorWithPermission, {})).not.toThrow();
        });

        it('should deny creation without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canCreate(actorWithoutPermission, {})).toThrow();
        });

        it('should allow ADMIN to update campaign', () => {
            expect(() => service._canUpdate(mockActor, mockCampaign)).not.toThrow();
        });

        it('should allow user with CAMPAIGN_UPDATE permission to update campaign', () => {
            const actorWithPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CAMPAIGN_UPDATE]
            };

            expect(() => service._canUpdate(actorWithPermission, mockCampaign)).not.toThrow();
        });

        it('should deny update without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canUpdate(actorWithoutPermission, mockCampaign)).toThrow();
        });

        it('should allow ADMIN to soft delete campaign', () => {
            expect(() => service._canSoftDelete(mockActor, mockCampaign)).not.toThrow();
        });

        it('should allow user with CAMPAIGN_DELETE permission to soft delete campaign', () => {
            const actorWithPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: [PermissionEnum.CAMPAIGN_DELETE]
            };

            expect(() => service._canSoftDelete(actorWithPermission, mockCampaign)).not.toThrow();
        });

        it('should deny soft delete without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canSoftDelete(actorWithoutPermission, mockCampaign)).toThrow();
        });

        it('should allow viewing campaigns with CAMPAIGN_VIEW permission', () => {
            expect(() => service._canView(mockActor, mockCampaign)).not.toThrow();
        });

        it('should deny viewing without permission', () => {
            const actorWithoutPermission: Actor = {
                ...mockActor,
                role: RoleEnum.USER,
                permissions: []
            };

            expect(() => service._canView(actorWithoutPermission, mockCampaign)).toThrow();
        });
    });

    // =========================================================================
    // Business Logic Tests - Status Management
    // =========================================================================

    describe('Status Management', () => {
        it('should activate a draft campaign', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...mockCampaign,
                status: CampaignStatusEnum.ACTIVE
            });

            const result = await service.activate(mockActor, mockCampaign.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.status).toBe(CampaignStatusEnum.ACTIVE);
            }
        });

        it('should not activate an already active campaign', async () => {
            const activeCampaign = { ...mockCampaign, status: CampaignStatusEnum.ACTIVE };
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(activeCampaign);

            const result = await service.activate(mockActor, mockCampaign.id);

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.message).toContain('already active');
            }
        });

        it('should pause an active campaign', async () => {
            const activeCampaign = { ...mockCampaign, status: CampaignStatusEnum.ACTIVE };
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(activeCampaign);
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...activeCampaign,
                status: CampaignStatusEnum.PAUSED
            });

            const result = await service.pause(mockActor, mockCampaign.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.status).toBe(CampaignStatusEnum.PAUSED);
            }
        });

        it('should not pause a non-active campaign', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);

            const result = await service.pause(mockActor, mockCampaign.id);

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.message).toContain('not active');
            }
        });

        it('should complete an active campaign', async () => {
            const activeCampaign = { ...mockCampaign, status: CampaignStatusEnum.ACTIVE };
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(activeCampaign);
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...activeCampaign,
                status: CampaignStatusEnum.COMPLETED
            });

            const result = await service.complete(mockActor, mockCampaign.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.status).toBe(CampaignStatusEnum.COMPLETED);
            }
        });

        it('should cancel a campaign', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...mockCampaign,
                status: CampaignStatusEnum.CANCELLED
            });

            const result = await service.cancel(mockActor, mockCampaign.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.status).toBe(CampaignStatusEnum.CANCELLED);
            }
        });
    });

    // =========================================================================
    // Business Logic Tests - Budget Management
    // =========================================================================

    describe('Budget Management', () => {
        it('should update campaign budget', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);
            const updatedBudget = { totalBudget: 7000, dailyBudget: 300 };
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...mockCampaign,
                budget: { ...mockCampaign.budget, ...updatedBudget }
            });

            const result = await service.updateBudget(mockActor, mockCampaign.id, updatedBudget);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.budget.totalBudget).toBe(7000);
                expect(result.data.budget.dailyBudget).toBe(300);
            }
        });

        it('should not allow daily budget to exceed total budget', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);

            const result = await service.updateBudget(mockActor, mockCampaign.id, {
                totalBudget: 1000,
                dailyBudget: 2000
            });

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.message.toLowerCase()).toContain('daily budget');
            }
        });

        it('should record campaign spend', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...mockCampaign,
                budget: { ...mockCampaign.budget, spentAmount: 150 }
            });

            const result = await service.recordSpend(mockActor, mockCampaign.id, 150);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.budget.spentAmount).toBe(150);
            }
        });

        it('should not allow spend to exceed total budget', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);

            const result = await service.recordSpend(mockActor, mockCampaign.id, 10000);

            expect(result.error).toBeDefined();
            expect(result.data).toBeUndefined();
            if (result.error) {
                expect(result.error.message).toContain('budget');
            }
        });
    });

    // =========================================================================
    // Business Logic Tests - Performance Tracking
    // =========================================================================

    describe('Performance Tracking', () => {
        it('should update campaign performance metrics', async () => {
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(mockCampaign);
            const performanceUpdate = {
                impressions: 1000,
                clicks: 50,
                conversions: 10
            };
            vi.spyOn(service.model, 'update').mockResolvedValueOnce({
                ...mockCampaign,
                performance: {
                    ...mockCampaign.performance,
                    ...performanceUpdate,
                    clickThroughRate: 0.05,
                    conversionRate: 0.2
                }
            });

            const result = await service.updatePerformance(
                mockActor,
                mockCampaign.id,
                performanceUpdate
            );

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data.performance?.impressions).toBe(1000);
                expect(result.data.performance?.clicks).toBe(50);
            }
        });

        it('should calculate performance ROI', async () => {
            const campaignWithPerformance = {
                ...mockCampaign,
                budget: { ...mockCampaign.budget, spentAmount: 1000 },
                performance: {
                    ...mockCampaign.performance,
                    conversions: 20,
                    returnOnAdSpend: 3.5
                }
            };
            vi.spyOn(service.model, 'findById').mockResolvedValueOnce(campaignWithPerformance);

            const result = await service.getPerformanceROI(mockActor, mockCampaign.id);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data).toHaveProperty('roi');
                expect(result.data).toHaveProperty('conversions');
            }
        });
    });

    // =========================================================================
    // Business Logic Tests - Filtering Methods
    // =========================================================================

    describe('Filtering Methods', () => {
        it('should find campaigns by client ID', async () => {
            vi.spyOn(mockModel, 'findByClient').mockResolvedValueOnce([mockCampaign]);

            const result = await service.findByClient(mockActor, mockCampaign.clientId);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].clientId).toBe(mockCampaign.clientId);
            }
        });

        it('should find active campaigns', async () => {
            const activeCampaign = { ...mockCampaign, status: CampaignStatusEnum.ACTIVE };
            vi.spyOn(mockModel, 'findActive').mockResolvedValueOnce([activeCampaign]);

            const result = await service.findActive(mockActor);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].status).toBe(CampaignStatusEnum.ACTIVE);
            }
        });

        it('should find scheduled campaigns', async () => {
            const scheduledCampaign = { ...mockCampaign, status: CampaignStatusEnum.SCHEDULED };
            vi.spyOn(service.model, 'findAll').mockResolvedValueOnce({
                items: [scheduledCampaign],
                total: 1
            });

            const result = await service.findScheduled(mockActor);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].status).toBe(CampaignStatusEnum.SCHEDULED);
            }
        });

        it('should find completed campaigns', async () => {
            const completedCampaign = { ...mockCampaign, status: CampaignStatusEnum.COMPLETED };
            vi.spyOn(service.model, 'findAll').mockResolvedValueOnce({
                items: [completedCampaign],
                total: 1
            });

            const result = await service.findCompleted(mockActor);

            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            if (result.data) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0].status).toBe(CampaignStatusEnum.COMPLETED);
            }
        });
    });
});
