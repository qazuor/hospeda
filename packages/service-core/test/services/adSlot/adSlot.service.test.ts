/**
 * AdSlot Service Tests
 *
 * Comprehensive test suite for AdSlotService covering permissions,
 * custom finders, and business logic for advertising slot management.
 *
 * @module AdSlotServiceTests
 */

import type { AdSlotModel } from '@repo/db';
import type { AdSlot } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdSlotService } from '../../../src/services/adSlot/adSlot.service.js';
import type { Actor, ServiceContext } from '../../../src/types/index.js';

describe('AdSlotService', () => {
    let service: AdSlotService;
    let mockModel: AdSlotModel;
    let ctx: ServiceContext;

    const mockActor: Actor = {
        id: 'user-123',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.AD_SLOT_CREATE,
            PermissionEnum.AD_SLOT_UPDATE,
            PermissionEnum.AD_SLOT_DELETE,
            PermissionEnum.AD_SLOT_VIEW
        ]
    };

    const mockAdSlot: AdSlot = {
        id: 'slot-123',
        name: 'Homepage Banner',
        description: 'Main banner slot on homepage',
        placement: {
            page: 'homepage',
            position: 'header',
            priority: 1
        },
        format: {
            width: 970,
            height: 250,
            allowedFormats: ['banner', 'leaderboard'],
            isResponsive: true
        },
        targeting: {
            blockedCountries: [],
            allowedDevices: ['desktop', 'mobile', 'tablet'],
            allowedContentTypes: ['general'],
            requiresAuthentication: false,
            allowedUserTypes: ['all']
        },
        pricing: {
            model: 'cpm',
            basePrice: 10,
            currency: 'USD',
            premiumMultiplier: 1,
            seasonalAdjustments: []
        },
        availability: {
            isActive: true,
            timeSlots: [],
            maxReservationsPerDay: 10,
            blackoutDates: []
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
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
            search: vi.fn(),
            count: vi.fn(),
            findByPlacement: vi.fn(),
            findByFormat: vi.fn(),
            findByPricingModel: vi.fn(),
            findAvailableSlots: vi.fn(),
            findByPerformance: vi.fn(),
            getTopPerformingSlots: vi.fn()
        } as unknown as AdSlotModel;

        service = new AdSlotService(ctx, mockModel);
    });

    // ============================================================================
    // Permission Hooks Tests
    // ============================================================================

    describe('Permission Hooks', () => {
        describe('_canCreate', () => {
            it('should allow admin to create ad slot', () => {
                expect(() => {
                    (service as any)._canCreate(mockActor, {});
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_CREATE permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_CREATE]
                };

                expect(() => {
                    (service as any)._canCreate(userActor, {});
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canCreate(userActor, {});
                }).toThrow('Permission denied');
            });
        });

        describe('_canUpdate', () => {
            it('should allow admin to update ad slot', () => {
                expect(() => {
                    (service as any)._canUpdate(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_UPDATE permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_UPDATE]
                };

                expect(() => {
                    (service as any)._canUpdate(userActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canUpdate(userActor, mockAdSlot);
                }).toThrow('Permission denied');
            });
        });

        describe('_canSoftDelete', () => {
            it('should allow admin to soft delete ad slot', () => {
                expect(() => {
                    (service as any)._canSoftDelete(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_DELETE permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_DELETE]
                };

                expect(() => {
                    (service as any)._canSoftDelete(userActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canSoftDelete(userActor, mockAdSlot);
                }).toThrow('Permission denied');
            });
        });

        describe('_canView', () => {
            it('should allow admin to view ad slot', () => {
                expect(() => {
                    (service as any)._canView(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_VIEW permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_VIEW]
                };

                expect(() => {
                    (service as any)._canView(userActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canView(userActor, mockAdSlot);
                }).toThrow('Permission denied');
            });
        });

        describe('_canHardDelete', () => {
            it('should allow admin to hard delete ad slot', () => {
                expect(() => {
                    (service as any)._canHardDelete(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny non-admin user', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_HARD_DELETE]
                };

                expect(() => {
                    (service as any)._canHardDelete(userActor, mockAdSlot);
                }).toThrow('Only admins can permanently delete');
            });
        });

        describe('_canRestore', () => {
            it('should allow admin to restore ad slot', () => {
                expect(() => {
                    (service as any)._canRestore(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_DELETE permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_DELETE]
                };

                expect(() => {
                    (service as any)._canRestore(userActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canRestore(userActor, mockAdSlot);
                }).toThrow('Permission denied');
            });
        });

        describe('_canUpdatePricing', () => {
            it('should allow admin to update pricing', () => {
                expect(() => {
                    (service as any)._canUpdatePricing(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_PRICING_MANAGE permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_PRICING_MANAGE]
                };

                expect(() => {
                    (service as any)._canUpdatePricing(userActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canUpdatePricing(userActor, mockAdSlot);
                }).toThrow('Permission denied');
            });
        });

        describe('_canUpdateAvailability', () => {
            it('should allow admin to update availability', () => {
                expect(() => {
                    (service as any)._canUpdateAvailability(mockActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should allow user with AD_SLOT_AVAILABILITY_MANAGE permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: [PermissionEnum.AD_SLOT_AVAILABILITY_MANAGE]
                };

                expect(() => {
                    (service as any)._canUpdateAvailability(userActor, mockAdSlot);
                }).not.toThrow();
            });

            it('should deny user without permission', () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                expect(() => {
                    (service as any)._canUpdateAvailability(userActor, mockAdSlot);
                }).toThrow('Permission denied');
            });
        });
    });

    // ============================================================================
    // Custom Finder Methods Tests
    // ============================================================================

    describe('Custom Finder Methods', () => {
        describe('findByPlacement', () => {
            it('should find ad slots by page and position', async () => {
                const slots = [mockAdSlot];
                vi.mocked(mockModel.findByPlacement).mockResolvedValue(slots);

                const result = await service.findByPlacement(mockActor, 'homepage', 'header');

                expect(result.data).toEqual(slots);
                expect(mockModel.findByPlacement).toHaveBeenCalledWith('homepage', 'header');
            });

            it('should return error if user lacks permission', async () => {
                const userActor: Actor = {
                    ...mockActor,
                    role: RoleEnum.USER,
                    permissions: []
                };

                const result = await service.findByPlacement(userActor, 'homepage', 'header');

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        describe('findByFormat', () => {
            it('should find ad slots by format', async () => {
                const slots = [mockAdSlot];
                vi.mocked(mockModel.findByFormat).mockResolvedValue(slots);

                const result = await service.findByFormat(mockActor, 'banner');

                expect(result.data).toEqual(slots);
                expect(mockModel.findByFormat).toHaveBeenCalledWith('banner');
            });
        });

        describe('findByPricingModel', () => {
            it('should find ad slots by pricing model', async () => {
                const slots = [mockAdSlot];
                vi.mocked(mockModel.findByPricingModel).mockResolvedValue(slots);

                const result = await service.findByPricingModel(mockActor, 'cpm');

                expect(result.data).toEqual(slots);
                expect(mockModel.findByPricingModel).toHaveBeenCalledWith('cpm');
            });
        });

        describe('findAvailableSlots', () => {
            it('should find available slots for date range', async () => {
                const slots = [mockAdSlot];
                const startDate = new Date('2025-01-01');
                const endDate = new Date('2025-01-31');
                vi.mocked(mockModel.findAvailableSlots).mockResolvedValue(slots);

                const result = await service.findAvailableSlots(mockActor, startDate, endDate);

                expect(result.data).toEqual(slots);
                expect(mockModel.findAvailableSlots).toHaveBeenCalledWith(startDate, endDate);
            });
        });

        describe('getTopPerformingSlots', () => {
            it('should get top performing slots', async () => {
                const slots = [mockAdSlot];
                vi.mocked(mockModel.getTopPerformingSlots).mockResolvedValue(slots);

                const result = await service.getTopPerformingSlots(mockActor, 10);

                expect(result.data).toEqual(slots);
                expect(mockModel.getTopPerformingSlots).toHaveBeenCalledWith(10);
            });
        });
    });

    // ============================================================================
    // Business Logic Methods Tests
    // ============================================================================

    describe('Business Logic Methods', () => {
        describe('updateStatus', () => {
            it('should update slot status to active', async () => {
                vi.mocked(mockModel.findById).mockResolvedValue(mockAdSlot);
                vi.mocked(mockModel.update).mockResolvedValue({ ...mockAdSlot });

                const result = await service.updateStatus(
                    mockActor,
                    'slot-123',
                    true,
                    'Activating for campaign'
                );

                expect(result.data).toBeDefined();
                expect(mockModel.update).toHaveBeenCalled();
            });

            it('should return error if slot not found', async () => {
                vi.mocked(mockModel.findById).mockResolvedValue(null);

                const result = await service.updateStatus(mockActor, 'invalid-id', true, 'Test');

                expect(result.error).toBeDefined();
                expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            });
        });

        describe('updatePricing', () => {
            it('should update slot pricing', async () => {
                vi.mocked(mockModel.findById).mockResolvedValue(mockAdSlot);
                vi.mocked(mockModel.update).mockResolvedValue({ ...mockAdSlot });

                const newPricing = {
                    model: 'cpc' as const,
                    basePrice: 15,
                    currency: 'USD',
                    premiumMultiplier: 1.5,
                    seasonalAdjustments: []
                };

                const result = await service.updatePricing(
                    mockActor,
                    'slot-123',
                    newPricing,
                    'Adjusting for market conditions'
                );

                expect(result.data).toBeDefined();
                expect(mockModel.update).toHaveBeenCalled();
            });
        });

        describe('updatePerformance', () => {
            it('should update performance metrics', async () => {
                const slotWithPerformance = {
                    ...mockAdSlot,
                    performance: {
                        totalImpressions: 1000,
                        totalClicks: 50,
                        totalRevenue: 100,
                        averageCTR: 0.05,
                        averageRPM: 100,
                        fillRate: 0.95
                    }
                };

                vi.mocked(mockModel.findById).mockResolvedValue(slotWithPerformance);
                vi.mocked(mockModel.update).mockResolvedValue({
                    ...slotWithPerformance,
                    performance: {
                        ...slotWithPerformance.performance,
                        totalImpressions: 1100,
                        totalClicks: 55
                    }
                });

                const result = await service.updatePerformance(mockActor, 'slot-123', {
                    impressions: 100,
                    clicks: 5
                });

                expect(result.data).toBeDefined();
                expect(mockModel.update).toHaveBeenCalled();
            });
        });

        describe('activate', () => {
            it('should activate slot', async () => {
                vi.mocked(mockModel.findById).mockResolvedValue(mockAdSlot);
                vi.mocked(mockModel.update).mockResolvedValue({ ...mockAdSlot });

                const result = await service.activate(
                    mockActor,
                    'slot-123',
                    'Activating for new campaign'
                );

                expect(result.data).toBeDefined();
            });
        });

        describe('deactivate', () => {
            it('should deactivate slot', async () => {
                vi.mocked(mockModel.findById).mockResolvedValue(mockAdSlot);
                vi.mocked(mockModel.update).mockResolvedValue({ ...mockAdSlot });

                const result = await service.deactivate(
                    mockActor,
                    'slot-123',
                    'Maintenance required'
                );

                expect(result.data).toBeDefined();
            });
        });

        describe('checkAvailability', () => {
            it('should check slot availability for date range', async () => {
                vi.mocked(mockModel.findById).mockResolvedValue(mockAdSlot);

                const startDate = new Date('2025-01-01');
                const endDate = new Date('2025-01-31');

                const result = await service.checkAvailability(
                    mockActor,
                    'slot-123',
                    startDate,
                    endDate
                );

                expect(result.data).toBeDefined();
                expect(result.data?.isAvailable).toBeDefined();
            });

            it('should return false if slot is inactive', async () => {
                const inactiveSlot = {
                    ...mockAdSlot,
                    availability: { ...mockAdSlot.availability, isActive: false }
                };
                vi.mocked(mockModel.findById).mockResolvedValue(inactiveSlot);

                const result = await service.checkAvailability(
                    mockActor,
                    'slot-123',
                    new Date('2025-01-01'),
                    new Date('2025-01-31')
                );

                expect(result.data?.isAvailable).toBe(false);
            });
        });

        describe('incrementImpressions', () => {
            it('should increment impression count', async () => {
                const slotWithPerformance = {
                    ...mockAdSlot,
                    performance: {
                        totalImpressions: 1000,
                        totalClicks: 50,
                        totalRevenue: 100,
                        averageCTR: 0.05,
                        averageRPM: 100,
                        fillRate: 0.95
                    }
                };

                vi.mocked(mockModel.findById).mockResolvedValue(slotWithPerformance);
                vi.mocked(mockModel.update).mockResolvedValue(slotWithPerformance);

                const result = await service.incrementImpressions(mockActor, 'slot-123', 100);

                expect(result.data).toBeDefined();
                expect(mockModel.update).toHaveBeenCalled();
            });
        });

        describe('incrementClicks', () => {
            it('should increment click count', async () => {
                const slotWithPerformance = {
                    ...mockAdSlot,
                    performance: {
                        totalImpressions: 1000,
                        totalClicks: 50,
                        totalRevenue: 100,
                        averageCTR: 0.05,
                        averageRPM: 100,
                        fillRate: 0.95
                    }
                };

                vi.mocked(mockModel.findById).mockResolvedValue(slotWithPerformance);
                vi.mocked(mockModel.update).mockResolvedValue(slotWithPerformance);

                const result = await service.incrementClicks(mockActor, 'slot-123', 10);

                expect(result.data).toBeDefined();
                expect(mockModel.update).toHaveBeenCalled();
            });
        });
    });
});
