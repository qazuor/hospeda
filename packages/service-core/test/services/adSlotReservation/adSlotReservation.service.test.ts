import type { AdSlotReservationModel } from '@repo/db';
import {
    AdSlotReservationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdSlotReservationService } from '../../../src/services/adSlotReservation/adSlotReservation.service';
import type { Actor } from '../../../src/types/actor';
import type { ServiceContext } from '../../../src/types/service-context';

describe('AdSlotReservationService', () => {
    let service: AdSlotReservationService;
    let mockModel: AdSlotReservationModel;
    let mockContext: ServiceContext;

    const validAdminActor: Actor = {
        id: 'admin-123',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.AD_SLOT_RESERVATION_CREATE,
            PermissionEnum.AD_SLOT_RESERVATION_UPDATE,
            PermissionEnum.AD_SLOT_RESERVATION_DELETE,
            PermissionEnum.AD_SLOT_RESERVATION_VIEW,
            PermissionEnum.AD_SLOT_RESERVATION_RESTORE,
            PermissionEnum.AD_SLOT_RESERVATION_HARD_DELETE,
            PermissionEnum.AD_SLOT_RESERVATION_STATUS_MANAGE
        ]
    };

    const validUserActor: Actor = {
        id: 'user-123',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.AD_SLOT_RESERVATION_VIEW]
    };

    const mockReservation = {
        id: 'reservation-123',
        adSlotId: 'slot-123',
        campaignId: 'campaign-123',
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-01-31'),
        status: AdSlotReservationStatusEnum.RESERVED,
        adminInfo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: 'admin-123',
        updatedById: 'admin-123',
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
            findByCampaign: vi.fn(),
            findByAdSlot: vi.fn(),
            findByStatus: vi.fn(),
            activate: vi.fn(),
            pause: vi.fn(),
            cancel: vi.fn(),
            end: vi.fn()
        } as unknown as AdSlotReservationModel;

        mockContext = {
            logger: {
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            }
        } as unknown as ServiceContext;

        service = new AdSlotReservationService(mockContext, mockModel);
    });

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create', () => {
                expect(() => service._canCreate(validAdminActor)).not.toThrow();
            });

            it('should allow user with CREATE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_CREATE]
                };

                expect(() => service._canCreate(actorWithPermission)).not.toThrow();
            });

            it('should deny user without CREATE permission', () => {
                expect(() => service._canCreate(validUserActor)).toThrow();
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update', () => {
                expect(() => service._canUpdate(validAdminActor, mockReservation)).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_UPDATE]
                };

                expect(() =>
                    service._canUpdate(actorWithPermission, mockReservation)
                ).not.toThrow();
            });

            it('should deny user without UPDATE permission', () => {
                expect(() => service._canUpdate(validUserActor, mockReservation)).toThrow();
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow admin to soft delete', () => {
                expect(() =>
                    service._canSoftDelete(validAdminActor, mockReservation)
                ).not.toThrow();
            });

            it('should allow user with DELETE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_DELETE]
                };

                expect(() =>
                    service._canSoftDelete(actorWithPermission, mockReservation)
                ).not.toThrow();
            });

            it('should deny user without DELETE permission', () => {
                expect(() => service._canSoftDelete(validUserActor, mockReservation)).toThrow();
            });
        });

        describe('_canView', () => {
            it('should allow admin to view', () => {
                expect(() => service._canView(validAdminActor, mockReservation)).not.toThrow();
            });

            it('should allow user with VIEW permission', () => {
                expect(() => service._canView(validUserActor, mockReservation)).not.toThrow();
            });

            it('should deny user without VIEW permission', () => {
                const actorWithoutPermission: Actor = {
                    id: 'user-789',
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => service._canView(actorWithoutPermission, mockReservation)).toThrow();
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete', () => {
                expect(() =>
                    service._canHardDelete(validAdminActor, mockReservation)
                ).not.toThrow();
            });

            it('should deny regular user even with HARD_DELETE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_HARD_DELETE]
                };

                expect(() =>
                    service._canHardDelete(actorWithPermission, mockReservation)
                ).toThrow();
            });
        });

        describe('_canRestore', () => {
            const deletedReservation = { ...mockReservation, deletedAt: new Date() };

            it('should allow admin to restore', () => {
                expect(() =>
                    service._canRestore(validAdminActor, deletedReservation)
                ).not.toThrow();
            });

            it('should allow user with RESTORE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_RESTORE]
                };

                expect(() =>
                    service._canRestore(actorWithPermission, deletedReservation)
                ).not.toThrow();
            });

            it('should deny user without RESTORE permission', () => {
                expect(() => service._canRestore(validUserActor, deletedReservation)).toThrow();
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
                    service._canUpdateVisibility(validAdminActor, mockReservation)
                ).not.toThrow();
            });

            it('should allow user with UPDATE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_UPDATE]
                };

                expect(() =>
                    service._canUpdateVisibility(actorWithPermission, mockReservation)
                ).not.toThrow();
            });
        });

        describe('_canManageStatus', () => {
            it('should allow admin to manage status', () => {
                expect(() =>
                    service._canManageStatus(validAdminActor, mockReservation)
                ).not.toThrow();
            });

            it('should allow user with STATUS_MANAGE permission', () => {
                const actorWithPermission: Actor = {
                    id: 'user-456',
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_RESERVATION_STATUS_MANAGE]
                };

                expect(() =>
                    service._canManageStatus(actorWithPermission, mockReservation)
                ).not.toThrow();
            });

            it('should deny user without STATUS_MANAGE permission', () => {
                expect(() => service._canManageStatus(validUserActor, mockReservation)).toThrow();
            });
        });
    });

    describe('Custom Finder Methods', () => {
        describe('findByCampaign', () => {
            it('should find reservations by campaign ID', async () => {
                vi.spyOn(mockModel, 'findByCampaign').mockResolvedValueOnce([mockReservation]);

                const result = await service.findByCampaign(validAdminActor, 'campaign-123');

                expect(result).toEqual({ data: [mockReservation] });
                expect(mockModel.findByCampaign).toHaveBeenCalledWith('campaign-123');
            });

            it('should return empty array when no reservations found', async () => {
                vi.spyOn(mockModel, 'findByCampaign').mockResolvedValueOnce([]);

                const result = await service.findByCampaign(validAdminActor, 'campaign-999');

                expect(result).toEqual({ data: [] });
            });
        });

        describe('findByAdSlot', () => {
            it('should find reservations by ad slot ID', async () => {
                vi.spyOn(mockModel, 'findByAdSlot').mockResolvedValueOnce([mockReservation]);

                const result = await service.findByAdSlot(validAdminActor, 'slot-123');

                expect(result).toEqual({ data: [mockReservation] });
                expect(mockModel.findByAdSlot).toHaveBeenCalledWith('slot-123');
            });
        });

        describe('findByStatus', () => {
            it('should find reservations by status', async () => {
                vi.spyOn(mockModel, 'findByStatus').mockResolvedValueOnce([mockReservation]);

                const result = await service.findByStatus(
                    validAdminActor,
                    AdSlotReservationStatusEnum.ACTIVE
                );

                expect(result).toEqual({ data: [mockReservation] });
                expect(mockModel.findByStatus).toHaveBeenCalledWith(
                    AdSlotReservationStatusEnum.ACTIVE
                );
            });
        });
    });

    describe('Business Logic Methods', () => {
        describe('activate', () => {
            it('should activate a reservation', async () => {
                const activatedReservation = {
                    ...mockReservation,
                    status: AdSlotReservationStatusEnum.ACTIVE
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockReservation);
                vi.spyOn(mockModel, 'activate').mockResolvedValueOnce(activatedReservation);

                const result = await service.activate(validAdminActor, 'reservation-123');

                expect(result).toEqual({ data: activatedReservation });
                expect(mockModel.activate).toHaveBeenCalledWith('reservation-123');
            });

            it('should return error when reservation not found', async () => {
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(null);

                const result = await service.activate(validAdminActor, 'reservation-999');

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(result.error?.message).toBe('Reservation not found');
            });
        });

        describe('pause', () => {
            it('should pause a reservation', async () => {
                const pausedReservation = {
                    ...mockReservation,
                    status: AdSlotReservationStatusEnum.PAUSED
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockReservation);
                vi.spyOn(mockModel, 'pause').mockResolvedValueOnce(pausedReservation);

                const result = await service.pause(validAdminActor, 'reservation-123');

                expect(result).toEqual({ data: pausedReservation });
                expect(mockModel.pause).toHaveBeenCalledWith('reservation-123');
            });
        });

        describe('cancel', () => {
            it('should cancel a reservation', async () => {
                const cancelledReservation = {
                    ...mockReservation,
                    status: AdSlotReservationStatusEnum.CANCELLED
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockReservation);
                vi.spyOn(mockModel, 'cancel').mockResolvedValueOnce(cancelledReservation);

                const result = await service.cancel(validAdminActor, 'reservation-123');

                expect(result).toEqual({ data: cancelledReservation });
                expect(mockModel.cancel).toHaveBeenCalledWith('reservation-123');
            });
        });

        describe('end', () => {
            it('should end a reservation', async () => {
                const endedReservation = {
                    ...mockReservation,
                    status: AdSlotReservationStatusEnum.ENDED
                };
                vi.spyOn(mockModel, 'findById').mockResolvedValueOnce(mockReservation);
                vi.spyOn(mockModel, 'end').mockResolvedValueOnce(endedReservation);

                const result = await service.end(validAdminActor, 'reservation-123');

                expect(result).toEqual({ data: endedReservation });
                expect(mockModel.end).toHaveBeenCalledWith('reservation-123');
            });
        });
    });
});
