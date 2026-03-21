/**
 * Mock implementations for advertising and sponsorship related services.
 *
 * Provides happy-path mock classes for AdSlotService, AdSlotReservationService,
 * AdPricingCatalogService, AdMediaAssetService, CampaignService,
 * SponsorshipService, SponsorshipLevelService, SponsorshipPackageService,
 * and OwnerPromotionService used in unit tests.
 *
 * @module test/helpers/mocks/advertising-services
 */

/** Non-existent UUID used to trigger 404 responses in tests. */
const NOT_FOUND_UUID = '87654321-4321-4321-8765-876543218765';

/**
 * Mock AdSlotService - returns predictable happy-path data.
 */
export class AdSlotService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'ad_slot_mock_id',
                slotIdentifier: String(b.slotIdentifier || 'SLOT-001'),
                placementPage: String(b.placementPage || 'HOME'),
                position: String(b.position || 'TOP_BANNER'),
                dimensions: b.dimensions || { width: 728, height: 90 },
                pricingModel: String(b.pricingModel || 'CPM'),
                basePrice: Number(b.basePrice || 0),
                currency: String(b.currency || 'USD'),
                isActive: b.isActive !== undefined ? b.isActive : true,
                isTestSlot: b.isTestSlot !== undefined ? b.isTestSlot : false,
                metadata: b.metadata || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isDeleted: b.isDeleted !== undefined ? b.isDeleted : false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                slotIdentifier: 'SLOT-001',
                placementPage: 'HOME',
                position: 'TOP_BANNER',
                pricingModel: 'CPM',
                basePrice: 10,
                currency: 'USD',
                isActive: true,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                basePrice: (params.data as Record<string, unknown>).basePrice || 10,
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock AdSlotReservationService - returns predictable happy-path data.
 */
export class AdSlotReservationService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'ad_slot_reservation_mock_id',
                adSlotId: String(b.adSlotId),
                clientId: String(b.clientId),
                reservationNumber: String(b.reservationNumber || 'RES-001'),
                startDate: b.startDate || new Date().toISOString(),
                endDate: b.endDate || new Date().toISOString(),
                status: String(b.status || 'PENDING'),
                totalAmount: Number(b.totalAmount || 0),
                currency: String(b.currency || 'USD'),
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isDeleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                adSlotId: 'adslot_mock_id',
                clientId: 'client_mock_id',
                reservationNumber: 'RES-001',
                status: 'CONFIRMED',
                totalAmount: 100,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'CONFIRMED',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock AdPricingCatalogService - returns predictable happy-path data.
 */
export class AdPricingCatalogService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'ad_pricing_catalog_mock_id',
                name: String(b.name || 'Mock Ad Pricing'),
                basePrice: Number(b.basePrice || 0),
                currency: String(b.currency || 'USD'),
                pricingModel: String(b.pricingModel || 'CPM'),
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                name: 'Mock Ad Pricing',
                basePrice: 10,
                currency: 'USD',
                pricingModel: 'CPM',
                isActive: true,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                basePrice: (params.data as Record<string, unknown>).basePrice || 10,
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock AdMediaAssetService - returns predictable happy-path data.
 */
export class AdMediaAssetService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'ad_media_asset_mock_id',
                campaignId: String(b.campaignId),
                assetType: String(b.assetType || 'IMAGE'),
                assetUrl: String(b.assetUrl || 'https://example.com/asset.jpg'),
                altText: b.altText || null,
                metadata: b.metadata || null,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                campaignId: 'campaign_mock_id',
                assetType: 'IMAGE',
                assetUrl: 'https://example.com/asset.jpg',
                isActive: true,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                assetUrl:
                    (params.data as Record<string, unknown>).assetUrl ||
                    'https://example.com/updated.jpg',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock CampaignService - returns predictable happy-path data.
 */
export class CampaignService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'campaign_mock_id',
                name: String(b.name || 'Mock Campaign'),
                description: b.description || null,
                campaignType: String(b.campaignType || 'EMAIL'),
                startDate: b.startDate || new Date().toISOString(),
                endDate: b.endDate || null,
                budget: b.budget || null,
                currency: b.currency || 'USD',
                status: String(b.status || 'DRAFT'),
                metadata: b.metadata || null,
                lifecycleState: b.lifecycleState || 'ACTIVE',
                isActive: b.isActive !== undefined ? b.isActive : true,
                isDeleted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                name: 'Mock Campaign',
                campaignType: 'EMAIL',
                startDate: '2024-01-01T00:00:00.000Z',
                status: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'ACTIVE',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock SponsorshipService - returns predictable happy-path data.
 */
export class SponsorshipService {
    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'sponsorship_mock_id',
                sponsorId: String(b.sponsorId),
                entityType: String(b.entityType || 'POST'),
                entityId: String(b.entityId),
                startDate: b.startDate || new Date().toISOString(),
                endDate: b.endDate || null,
                amount: Number(b.amount || 0),
                currency: String(b.currency || 'USD'),
                status: String(b.status || 'ACTIVE'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                sponsorId: 'sponsor_mock_id',
                entityType: 'POST',
                entityId: 'entity_mock_id',
                amount: 100,
                currency: 'USD',
                status: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'ACTIVE',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock SponsorshipLevelService - returns predictable happy-path data.
 */
export class SponsorshipLevelService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'sponsorship_level_mock_id',
                name: String(b.name || 'Mock Level'),
                description: b.description || null,
                benefits: b.benefits || [],
                sortOrder: Number(b.sortOrder || 0),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        return {
            data: {
                id: params.id,
                name: 'Mock Level',
                benefits: [],
                sortOrder: 0,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                name: (params.data as Record<string, unknown>).name || 'Updated Level',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock SponsorshipPackageService - returns predictable happy-path data.
 */
export class SponsorshipPackageService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'sponsorship_package_mock_id',
                name: String(b.name || 'Mock Package'),
                description: b.description || null,
                price: Number(b.price || 0),
                duration: Number(b.duration || 30),
                features: b.features || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        return {
            data: {
                id: params.id,
                name: 'Mock Package',
                price: 100,
                duration: 30,
                features: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                name: (params.data as Record<string, unknown>).name || 'Updated Package',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}

/**
 * Mock OwnerPromotionService - returns predictable happy-path data.
 */
export class OwnerPromotionService {
    async adminList(_actor: unknown, _query?: Record<string, unknown>) {
        return { data: { items: [], total: 0 } };
    }

    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'owner_promotion_mock_id',
                ownerId: String(b.ownerId),
                accommodationId: String(b.accommodationId),
                startDate: b.startDate || new Date().toISOString(),
                endDate: b.endDate || null,
                type: String(b.type || 'HIGHLIGHT'),
                status: String(b.status || 'ACTIVE'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async search(_actor: unknown, _opts?: Record<string, unknown>) {
        return {
            data: { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }
        };
    }

    async findById(_actor: unknown, params: { id: string }) {
        if (params.id === NOT_FOUND_UUID) return { data: null };
        return {
            data: {
                id: params.id,
                ownerId: 'owner_mock_id',
                accommodationId: 'accommodation_mock_id',
                type: 'HIGHLIGHT',
                status: 'ACTIVE',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'ACTIVE',
                updatedAt: new Date().toISOString()
            }
        };
    }

    async delete(_actor: unknown, params: { id: string }) {
        return {
            data: { id: params.id, deletedAt: new Date().toISOString(), isDeleted: true }
        };
    }
}
