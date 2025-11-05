import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdPricingCatalogModel } from '@repo/db';
import {
	CampaignChannelEnum,
	type AdPricingCatalog,
	PermissionEnum,
	RoleEnum,
	ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext } from '../../../src/types/index.js';
import { AdPricingCatalogService } from '../../../src/services/adPricingCatalog/adPricingCatalog.service.js';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCatalog: AdPricingCatalog = {
	id: '00000000-0000-0000-0000-000000000001',
	adSlotId: '00000000-0000-0000-0000-000000000002',
	channel: CampaignChannelEnum.WEB,
	basePrice: '100.00',
	currency: 'USD',
	pricingModel: 'CPM',
	dailyRate: '10.00',
	weeklyRate: '60.00',
	monthlyRate: '200.00',
	weekendMultiplier: '1.5',
	holidayMultiplier: '2.0',
	minimumBudget: '50.00',
	maximumBudget: '5000.00',
	description: 'Test pricing catalog for web campaigns',
	availableFrom: new Date('2024-01-01'),
	availableUntil: new Date('2024-12-31'),
	isActive: true,
	metadata: null,
	createdAt: new Date('2024-01-01'),
	updatedAt: new Date('2024-01-01'),
	createdById: null,
	updatedById: null,
	deletedAt: null,
	deletedById: null
};

const mockCatalog2: AdPricingCatalog = {
	...mockCatalog,
	id: '00000000-0000-0000-0000-000000000003',
	channel: CampaignChannelEnum.SOCIAL,
	pricingModel: 'CPC',
	basePrice: '2.50'
};

const mockInactiveCatalog: AdPricingCatalog = {
	...mockCatalog,
	id: '00000000-0000-0000-0000-000000000004',
	isActive: false
};

// ============================================================================
// MOCK ACTORS
// ============================================================================

const mockAdminActor: Actor = {
	id: 'admin-001',
	email: 'admin@hospeda.com',
	role: RoleEnum.ADMIN,
	permissions: [PermissionEnum.ADMIN],
	metadata: null
};

const mockAuthorizedActor: Actor = {
	id: 'authorized-001',
	email: 'authorized@hospeda.com',
	role: RoleEnum.USER,
	permissions: [PermissionEnum.ADMIN], // Temporarily using ADMIN until AD_PRICING_UPDATE is added
	metadata: null
};

const mockUnauthorizedActor: Actor = {
	id: 'unauthorized-001',
	email: 'unauthorized@hospeda.com',
	role: RoleEnum.USER,
	permissions: [],
	metadata: null
};

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockModel: Partial<AdPricingCatalogModel> = {
	findById: vi.fn(),
	findByAdSlot: vi.fn(),
	findByChannel: vi.fn(),
	findActive: vi.fn(),
	calculatePrice: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	softDelete: vi.fn(),
	hardDelete: vi.fn(),
	restore: vi.fn(),
	findAll: vi.fn(),
	count: vi.fn()
};

const mockContext: ServiceContext = {
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
};

// ============================================================================
// TESTS
// ============================================================================

describe('AdPricingCatalogService', () => {
	let service: AdPricingCatalogService;

	beforeEach(() => {
		service = new AdPricingCatalogService(mockContext, mockModel as AdPricingCatalogModel);
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ========================================================================
	// PERMISSION HOOKS TESTS
	// ========================================================================

	describe('Permission Hooks', () => {
		describe('_canCreate', () => {
			it('should allow ADMIN to create', async () => {
				vi.mocked(mockModel.create).mockResolvedValue(mockCatalog);

				const result = await service.create(mockAdminActor, {
					adSlotId: mockCatalog.adSlotId,
					channel: mockCatalog.channel,
					basePrice: 100,
					currency: 'USD',
					pricingModel: 'CPM'
				});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
			});

			it('should allow authorized user to create', async () => {
				vi.mocked(mockModel.create).mockResolvedValue(mockCatalog);

				const result = await service.create(mockAuthorizedActor, {
					adSlotId: mockCatalog.adSlotId,
					channel: mockCatalog.channel,
					basePrice: 100,
					currency: 'USD',
					pricingModel: 'CPM'
				});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
			});

			it('should deny unauthorized user to create', async () => {
				// Validation happens BEFORE permission check in BaseCrudService
				// So we need valid data, but actor without permissions
				const result = await service.create(mockUnauthorizedActor, {
					adSlotId: mockCatalog.adSlotId,
					channel: mockCatalog.channel,
					basePrice: 100,
					currency: 'USD',
					pricingModel: 'CPM'
				});

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('_canUpdate', () => {
			it('should allow ADMIN to update', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);
				vi.mocked(mockModel.update).mockResolvedValue({ ...mockCatalog, basePrice: '150.00' });

				const result = await service.update(mockAdminActor, mockCatalog.id, {
					basePrice: 150
				});

				expect(result.error).toBeUndefined();
				expect(result.data).toBeDefined();
			});

			it('should deny unauthorized user to update', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);

				// Validation happens BEFORE permission check in BaseCrudService
				// So we need valid data, but actor without permissions
				const result = await service.update(mockUnauthorizedActor, mockCatalog.id, {
					basePrice: 150 // Valid data
				});

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('_canSoftDelete', () => {
			it('should allow ADMIN to soft delete', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);
				vi.mocked(mockModel.softDelete).mockResolvedValue(undefined);

				const result = await service.softDelete(mockAdminActor, mockCatalog.id);

				expect(result.error).toBeUndefined();
				expect(result.data).toBeDefined();
				expect(result.data).toEqual({ count: undefined });
			});

			it('should deny unauthorized user to soft delete', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);

				const result = await service.softDelete(mockUnauthorizedActor, mockCatalog.id);

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('_canHardDelete', () => {
			it('should allow ADMIN to hard delete', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);
				vi.mocked(mockModel.hardDelete).mockResolvedValue(undefined);

				const result = await service.hardDelete(mockAdminActor, mockCatalog.id);

				expect(result.error).toBeUndefined();
				expect(result.data).toBeDefined();
				expect(result.data).toEqual({ count: undefined });
			});

			it('should deny authorized non-admin user to hard delete', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);

				const result = await service.hardDelete(mockAuthorizedActor, mockCatalog.id);

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('_canList', () => {
			it('should allow ADMIN to list', async () => {
				vi.mocked(mockModel.findAll).mockResolvedValue({
					items: [mockCatalog, mockCatalog2],
					total: 2
				});

				const result = await service.list(mockAdminActor, {});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
			});

			it('should deny unauthorized user to list', async () => {
				const result = await service.list(mockUnauthorizedActor, {});

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});
	});

	// ========================================================================
	// BUSINESS METHODS TESTS
	// ========================================================================

	describe('Business Methods', () => {
		describe('findByAdSlot', () => {
			it('should return catalogs for a specific ad slot', async () => {
				vi.mocked(mockModel.findByAdSlot).mockResolvedValue([mockCatalog, mockCatalog2]);

				const result = await service.findByAdSlot(mockAdminActor, mockCatalog.adSlotId);

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toHaveLength(2);
				expect(result.data?.[0].adSlotId).toBe(mockCatalog.adSlotId);
			});

			it('should return empty array when no catalogs found', async () => {
				vi.mocked(mockModel.findByAdSlot).mockResolvedValue([]);

				const result = await service.findByAdSlot(mockAdminActor, 'non-existent-slot');

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toHaveLength(0);
			});

			it('should deny unauthorized user', async () => {
				const result = await service.findByAdSlot(mockUnauthorizedActor, mockCatalog.adSlotId);

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('findByChannel', () => {
			it('should return catalogs for WEB channel', async () => {
				vi.mocked(mockModel.findByChannel).mockResolvedValue([mockCatalog]);

				const result = await service.findByChannel(mockAdminActor, CampaignChannelEnum.WEB);

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toHaveLength(1);
				expect(result.data?.[0].channel).toBe(CampaignChannelEnum.WEB);
			});

			it('should return catalogs for SOCIAL channel', async () => {
				vi.mocked(mockModel.findByChannel).mockResolvedValue([mockCatalog2]);

				const result = await service.findByChannel(mockAdminActor, CampaignChannelEnum.SOCIAL);

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toHaveLength(1);
				expect(result.data?.[0].channel).toBe(CampaignChannelEnum.SOCIAL);
			});

			it('should deny unauthorized user', async () => {
				const result = await service.findByChannel(
					mockUnauthorizedActor,
					CampaignChannelEnum.WEB
				);

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('findActive', () => {
			it('should return only active catalogs', async () => {
				vi.mocked(mockModel.findActive).mockResolvedValue([mockCatalog, mockCatalog2]);

				const result = await service.findActive(mockAdminActor);

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toHaveLength(2);
				expect(result.data?.every((c) => c.isActive)).toBe(true);
			});

			it('should return empty array when no active catalogs', async () => {
				vi.mocked(mockModel.findActive).mockResolvedValue([]);

				const result = await service.findActive(mockAdminActor);

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toHaveLength(0);
			});

			it('should deny unauthorized user', async () => {
				const result = await service.findActive(mockUnauthorizedActor);

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});

		describe('calculatePrice', () => {
			it('should calculate CPM price with impressions', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);
				vi.mocked(mockModel.calculatePrice).mockResolvedValue(100.0); // 100/1000 * 1000

				const result = await service.calculatePrice(mockAdminActor, {
					catalogId: mockCatalog.id,
					impressions: 1000
				});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toBe(100.0);
			});

			it('should calculate CPC price with clicks', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog2);
				vi.mocked(mockModel.calculatePrice).mockResolvedValue(25.0); // 2.5 * 10

				const result = await service.calculatePrice(mockAdminActor, {
					catalogId: mockCatalog2.id,
					clicks: 10
				});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toBe(25.0);
			});

			it('should apply weekend multiplier', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);
				vi.mocked(mockModel.calculatePrice).mockResolvedValue(150.0); // 100 * 1.5

				const result = await service.calculatePrice(mockAdminActor, {
					catalogId: mockCatalog.id,
					impressions: 1000,
					isWeekend: true
				});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toBe(150.0);
			});

			it('should apply holiday multiplier', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockCatalog);
				vi.mocked(mockModel.calculatePrice).mockResolvedValue(200.0); // 100 * 2.0

				const result = await service.calculatePrice(mockAdminActor, {
					catalogId: mockCatalog.id,
					impressions: 1000,
					isHoliday: true
				});

				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
				expect(result.data).toBe(200.0);
			});

			it('should return error when catalog not found', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(null);

				const result = await service.calculatePrice(mockAdminActor, {
					catalogId: 'non-existent-id',
					impressions: 1000
				});

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
			});

			it('should return error when catalog is inactive', async () => {
				vi.mocked(mockModel.findById).mockResolvedValue(mockInactiveCatalog);

				const result = await service.calculatePrice(mockAdminActor, {
					catalogId: mockInactiveCatalog.id,
					impressions: 1000
				});

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.BUSINESS_RULE_VIOLATION);
			});

			it('should deny unauthorized user', async () => {
				const result = await service.calculatePrice(mockUnauthorizedActor, {
					catalogId: mockCatalog.id,
					impressions: 1000
				});

				expect(result.data).toBeUndefined();
				expect(result.error).toBeDefined();
				expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
			});
		});
	});
});
