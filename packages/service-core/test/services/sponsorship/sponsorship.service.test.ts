import type { SponsorshipModel } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    SponsorshipEntityTypeEnum,
    SponsorshipStatusEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import type { Actor } from '../../../src/types/actor';
import type { ServiceContext } from '../../../src/types/service-context';

describe('SponsorshipService', () => {
    let service: SponsorshipService;
    let mockModel: SponsorshipModel;
    let mockContext: ServiceContext;

    const validAdminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.SPONSORSHIP_CREATE,
            PermissionEnum.SPONSORSHIP_UPDATE,
            PermissionEnum.SPONSORSHIP_DELETE,
            PermissionEnum.SPONSORSHIP_VIEW,
            PermissionEnum.SPONSORSHIP_RESTORE,
            PermissionEnum.SPONSORSHIP_HARD_DELETE,
            PermissionEnum.SPONSORSHIP_STATUS_MANAGE
        ]
    };

    const validUserActor: Actor = {
        id: 'user-123',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.SPONSORSHIP_VIEW]
    };

    const mockSponsorship = {
        id: 'sponsorship-123',
        clientId: 'client-123',
        entityType: SponsorshipEntityTypeEnum.POST,
        entityId: 'post-123',
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
        status: SponsorshipStatusEnum.ACTIVE,
        priority: 50,
        budgetAmount: 1000,
        spentAmount: 0,
        impressionCount: 0,
        clickCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'admin-123',
        updatedById: 'admin-123',
        deletedAt: null,
        deletedById: null
    };

    beforeEach(() => {
        mockModel = {
            findById: vi.fn(),
            findAll: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            count: vi.fn(),
            findActive: vi.fn(),
            findByClient: vi.fn(),
            findByEntity: vi.fn(),
            activate: vi.fn(),
            pause: vi.fn(),
            expire: vi.fn(),
            cancel: vi.fn(),
            sponsorPost: vi.fn(),
            sponsorEvent: vi.fn(),
            isActive: vi.fn(),
            calculateCost: vi.fn(),
            getVisibilityStats: vi.fn(),
            getImpressions: vi.fn(),
            getClicks: vi.fn(),
            calculateROI: vi.fn()
        } as unknown as SponsorshipModel;

        mockContext = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as ServiceContext;

        service = new SponsorshipService(mockContext, mockModel);
    });

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create', () => {
                expect(() => service._canCreate(validAdminActor, {})).not.toThrow();
            });

            it('should allow user with CREATE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_CREATE]
                };

                expect(() => service._canCreate(actorWithPermission, {})).not.toThrow();
            });

            it('should deny user without CREATE permission', () => {
                expect(() => service._canCreate(validUserActor, {})).toThrow();
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() => service._canUpdate(validAdminActor, mockSponsorship)).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_UPDATE]
                };

                expect(() =>
                    service._canUpdate(actorWithPermission, mockSponsorship)
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() => service._canUpdate(validUserActor, mockSponsorship)).toThrow();
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow admin to soft delete', () => {
                expect(() =>
                    service._canSoftDelete(validAdminActor, mockSponsorship)
                ).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_DELETE]
                };

                expect(() =>
                    service._canSoftDelete(actorWithPermission, mockSponsorship)
                ).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() => service._canSoftDelete(validUserActor, mockSponsorship)).toThrow();
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() => service._canView(validAdminActor, mockSponsorship)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canView(validUserActor, mockSponsorship)).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                const actorWithoutPermission: Actor = {
                    id: 'user-789',
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => service._canView(actorWithoutPermission, mockSponsorship)).toThrow();
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete', () => {
                expect(() =>
                    service._canHardDelete(validAdminActor, mockSponsorship)
                ).not.toThrow();
            });

            it('should deny regular user even with HARD_DELETE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE]
                };

                expect(() =>
                    service._canHardDelete(actorWithPermission, mockSponsorship)
                ).toThrow();
            });
        });

        describe('_canRestore', () => {
            const deletedSponsorship = { ...mockSponsorship, deletedAt: new Date() };

            it('should allow admin to restore', () => {
                expect(() =>
                    service._canRestore(validAdminActor, deletedSponsorship)
                ).not.toThrow();
            });

            it('should allow user with RESTORE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_RESTORE]
                };

                expect(() =>
                    service._canRestore(actorWithPermission, deletedSponsorship)
                ).not.toThrow();
            });

            it('should deny user without RESTORE permission', () => {
                expect(() => service._canRestore(validUserActor, deletedSponsorship)).toThrow();
            });
        });

        describe('_canList', () => {
            it('should allow admin to list', () => {
                expect(() => service._canList(validAdminActor)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canList(validUserActor)).not.toThrow();
            });
        });

        describe('_canSearch', () => {
            it('should allow admin to search', () => {
                expect(() => service._canSearch(validAdminActor)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canSearch(validUserActor)).not.toThrow();
            });
        });

        describe('_canCount', () => {
            it('should allow admin to count', () => {
                expect(() => service._canCount(validAdminActor)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canCount(validUserActor)).not.toThrow();
            });
        });

        describe('_canUpdateVisibility', () => {
            it('should allow admin to update visibility', () => {
                expect(() =>
                    service._canUpdateVisibility(validAdminActor, mockSponsorship)
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_UPDATE]
                };

                expect(() =>
                    service._canUpdateVisibility(actorWithPermission, mockSponsorship)
                ).not.toThrow();
            });
        });

        describe('_canManageStatus', () => {
            it('should allow admin to manage status', () => {
                expect(() =>
                    service._canManageStatus(validAdminActor, mockSponsorship)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.SPONSORSHIP_STATUS_MANAGE]
                };

                expect(() =>
                    service._canManageStatus(actorWithPermission, mockSponsorship)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() => service._canManageStatus(validUserActor, mockSponsorship)).toThrow();
            });
        });
    });

    describe('Custom Finder Methods', () => {
        describe('findActive', () => {
            it('should find active sponsorships', async () => {
                vi.spyOn(mockModel, 'findActive').mockResolvedValueOnce([mockSponsorship]);

                const result = await service.findActive(validAdminActor);

                expect(result).toEqual({ data: [mockSponsorship] });
                expect(mockModel.findActive).toHaveBeenCalled();
            });

            it('should return empty array when no active sponsorships found', async () => {
                vi.spyOn(mockModel, 'findActive').mockResolvedValueOnce([]);

                const result = await service.findActive(validAdminActor);

                expect(result).toEqual({ data: [] });
            });
        });

        describe('findByClient', () => {
            it('should find sponsorships by client ID', async () => {
                vi.spyOn(mockModel, 'findByClient').mockResolvedValueOnce([mockSponsorship]);

                const result = await service.findByClient(validAdminActor, 'client-123');

                expect(result).toEqual({ data: [mockSponsorship] });
                expect(mockModel.findByClient).toHaveBeenCalledWith('client-123');
            });
        });

        describe('findByEntity', () => {
            it('should find sponsorships by entity ID and type', async () => {
                vi.spyOn(mockModel, 'findByEntity').mockResolvedValueOnce([mockSponsorship]);

                const result = await service.findByEntity(
                    validAdminActor,
                    'post-123',
                    SponsorshipEntityTypeEnum.POST
                );

                expect(result).toEqual({ data: [mockSponsorship] });
                expect(mockModel.findByEntity).toHaveBeenCalledWith(
                    'post-123',
                    SponsorshipEntityTypeEnum.POST
                );
            });
        });
    });

    describe('Business Logic Methods', () => {
        describe('activate', () => {
            it('should activate a sponsorship', async () => {
                const activatedSponsorship = {
                    ...mockSponsorship,
                    status: SponsorshipStatusEnum.ACTIVE
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockSponsorship);
                vi.spyOn(mockModel, 'activate').mockResolvedValueOnce(activatedSponsorship);

                const result = await service.activate(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: activatedSponsorship });
                expect(mockModel.activate).toHaveBeenCalledWith('sponsorship-123');
            });

            it('should return error when sponsorship not found', async () => {
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(null);

                const result = await service.activate(validAdminActor, 'sponsorship-999');

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(result.error?.message).toBe('Sponsorship not found');
            });
        });

        describe('pause', () => {
            it('should pause a sponsorship', async () => {
                const pausedSponsorship = {
                    ...mockSponsorship,
                    status: SponsorshipStatusEnum.PAUSED
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockSponsorship);
                vi.spyOn(mockModel, 'pause').mockResolvedValueOnce(pausedSponsorship);

                const result = await service.pause(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: pausedSponsorship });
                expect(mockModel.pause).toHaveBeenCalledWith('sponsorship-123');
            });
        });

        describe('expire', () => {
            it('should expire a sponsorship', async () => {
                const expiredSponsorship = {
                    ...mockSponsorship,
                    status: SponsorshipStatusEnum.EXPIRED
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockSponsorship);
                vi.spyOn(mockModel, 'expire').mockResolvedValueOnce(expiredSponsorship);

                const result = await service.expire(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: expiredSponsorship });
                expect(mockModel.expire).toHaveBeenCalledWith('sponsorship-123');
            });
        });

        describe('cancel', () => {
            it('should cancel a sponsorship', async () => {
                const cancelledSponsorship = {
                    ...mockSponsorship,
                    status: SponsorshipStatusEnum.CANCELLED
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockSponsorship);
                vi.spyOn(mockModel, 'cancel').mockResolvedValueOnce(cancelledSponsorship);

                const result = await service.cancel(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: cancelledSponsorship });
                expect(mockModel.cancel).toHaveBeenCalledWith('sponsorship-123');
            });
        });

        describe('sponsorPost', () => {
            it('should create a post sponsorship', async () => {
                const newSponsorship = {
                    ...mockSponsorship,
                    entityType: SponsorshipEntityTypeEnum.POST
                };
                vi.spyOn(mockModel, 'sponsorPost').mockResolvedValueOnce(newSponsorship);

                const params = {
                    clientId: 'client-123',
                    postId: 'post-123',
                    fromDate: new Date('2025-01-01'),
                    toDate: new Date('2025-01-31')
                };

                const result = await service.sponsorPost(validAdminActor, params);

                expect(result).toEqual({ data: newSponsorship });
                expect(mockModel.sponsorPost).toHaveBeenCalledWith(params);
            });
        });

        describe('sponsorEvent', () => {
            it('should create an event sponsorship', async () => {
                const newSponsorship = {
                    ...mockSponsorship,
                    entityType: SponsorshipEntityTypeEnum.EVENT
                };
                vi.spyOn(mockModel, 'sponsorEvent').mockResolvedValueOnce(newSponsorship);

                const params = {
                    clientId: 'client-123',
                    eventId: 'event-123',
                    fromDate: new Date('2025-01-01'),
                    toDate: new Date('2025-01-31')
                };

                const result = await service.sponsorEvent(validAdminActor, params);

                expect(result).toEqual({ data: newSponsorship });
                expect(mockModel.sponsorEvent).toHaveBeenCalledWith(params);
            });
        });

        describe('isActive', () => {
            it('should check if sponsorship is active', async () => {
                vi.spyOn(mockModel, 'isActive').mockResolvedValueOnce(true);

                const result = await service.isActive(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: true });
                expect(mockModel.isActive).toHaveBeenCalledWith('sponsorship-123');
            });
        });

        describe('calculateCost', () => {
            it('should calculate sponsorship cost', async () => {
                vi.spyOn(mockModel, 'calculateCost').mockResolvedValueOnce(1500);

                const result = await service.calculateCost(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: 1500 });
                expect(mockModel.calculateCost).toHaveBeenCalledWith('sponsorship-123');
            });
        });

        describe('getVisibilityStats', () => {
            it('should get visibility statistics', async () => {
                const stats = {
                    impressions: 1000,
                    clicks: 50,
                    reach: 800,
                    engagement: 25
                };
                vi.spyOn(mockModel, 'getVisibilityStats').mockResolvedValueOnce(stats);

                const result = await service.getVisibilityStats(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: stats });
                expect(mockModel.getVisibilityStats).toHaveBeenCalledWith('sponsorship-123');
            });
        });

        describe('calculateROI', () => {
            it('should calculate return on investment', async () => {
                vi.spyOn(mockModel, 'calculateROI').mockResolvedValueOnce(150); // 150% ROI

                const result = await service.calculateROI(validAdminActor, 'sponsorship-123');

                expect(result).toEqual({ data: 150 });
                expect(mockModel.calculateROI).toHaveBeenCalledWith('sponsorship-123');
            });
        });
    });
});
