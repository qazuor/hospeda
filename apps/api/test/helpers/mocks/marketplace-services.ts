/**
 * Mock implementations for marketplace and professional services.
 *
 * Provides happy-path mock classes for ProfessionalServiceService,
 * ProfessionalServiceOrderService, ServiceListingService,
 * AccommodationListingService, AccommodationListingPlanService,
 * ServiceListingPlanService, BenefitPartnerService, BenefitListingPlanService,
 * BenefitListingService, TouristServiceService, FeaturedAccommodationService,
 * NotificationService, PromotionService, DiscountCodeService,
 * and DiscountCodeUsageService used in unit tests.
 *
 * @module test/helpers/mocks/marketplace-services
 */

/** Non-existent UUID used to trigger 404 responses in tests. */
const NOT_FOUND_UUID = '87654321-4321-4321-8765-876543218765';

/**
 * Mock ProfessionalServiceService - returns predictable happy-path data.
 */
export class ProfessionalServiceService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'professional_service_mock_id',
                providerId: String(b.providerId),
                serviceName: String(b.serviceName || 'Mock Service'),
                serviceType: String(b.serviceType || 'CONSULTING'),
                description: String(b.description || ''),
                basePrice: Number(b.basePrice || 0),
                currency: String(b.currency || 'USD'),
                durationMinutes: Number(b.durationMinutes || 60),
                isActive: b.isActive !== undefined ? b.isActive : true,
                metadata: b.metadata || null,
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
                providerId: 'provider_mock_id',
                serviceName: 'Mock Service',
                serviceType: 'CONSULTING',
                basePrice: 100,
                currency: 'USD',
                durationMinutes: 60,
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
                basePrice: (params.data as Record<string, unknown>).basePrice || 100,
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
 * Mock ProfessionalServiceOrderService - returns predictable happy-path data.
 */
export class ProfessionalServiceOrderService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'service_order_mock_id',
                clientId: String(b.clientId),
                serviceTypeId: String(b.serviceTypeId),
                pricingPlanId: String(b.pricingPlanId),
                status: 'PENDING',
                orderedAt: new Date().toISOString(),
                clientRequirements: String(b.clientRequirements || ''),
                pricing: b.pricing || {},
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
                clientId: 'client_mock_id',
                serviceTypeId: 'service_type_mock_id',
                pricingPlanId: 'pricing_plan_mock_id',
                status: 'PENDING',
                orderedAt: '2024-01-01T00:00:00.000Z',
                clientRequirements: 'Mock requirements',
                pricing: {},
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                status: (params.data as Record<string, unknown>).status || 'PENDING',
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
 * Mock ServiceListingService - returns predictable happy-path data.
 */
export class ServiceListingService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'service_listing_mock_id',
                providerId: String(b.providerId),
                title: String(b.title || 'Mock Service Listing'),
                description: String(b.description || ''),
                serviceCategory: String(b.serviceCategory || 'OTHER'),
                basePrice: Number(b.basePrice || 0),
                currency: String(b.currency || 'USD'),
                isActive: b.isActive !== undefined ? b.isActive : true,
                metadata: b.metadata || null,
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
                providerId: 'provider_mock_id',
                title: 'Mock Service Listing',
                serviceCategory: 'CONSULTING',
                basePrice: 100,
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
                basePrice: (params.data as Record<string, unknown>).basePrice || 100,
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
 * Mock AccommodationListingService - returns predictable happy-path data.
 */
export class AccommodationListingService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'accommodation_listing_mock_id',
                accommodationId: String(b.accommodationId),
                pricingPlanId: String(b.pricingPlanId),
                status: String(b.status || 'DRAFT'),
                isTrial: b.isTrial !== undefined ? b.isTrial : false,
                trialEndsAt: b.trialEndsAt || null,
                listingStartDate: b.listingStartDate || new Date().toISOString(),
                listingEndDate: b.listingEndDate || null,
                metadata: b.metadata || null,
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
                accommodationId: 'accommodation_mock_id',
                pricingPlanId: 'pricing_plan_mock_id',
                status: 'ACTIVE',
                isTrial: false,
                listingStartDate: '2024-01-01T00:00:00.000Z',
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
 * Mock AccommodationListingPlanService - returns predictable happy-path data.
 */
export class AccommodationListingPlanService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'accommodation_listing_plan_mock_id',
                name: String(b.name || 'Mock Plan'),
                description: b.description || null,
                pricingPlanId: String(b.pricingPlanId),
                features: b.features || [],
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
                name: 'Mock Plan',
                pricingPlanId: 'pricing_plan_mock_id',
                features: [],
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
                name: (params.data as Record<string, unknown>).name || 'Updated Plan',
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
 * Mock ServiceListingPlanService - returns predictable happy-path data.
 */
export class ServiceListingPlanService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'service_listing_plan_mock_id',
                name: String(b.name || 'Mock Service Plan'),
                description: b.description || null,
                pricingPlanId: String(b.pricingPlanId),
                features: b.features || [],
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
                name: 'Mock Service Plan',
                pricingPlanId: 'pricing_plan_mock_id',
                features: [],
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
                name: (params.data as Record<string, unknown>).name || 'Updated Service Plan',
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
 * Mock BenefitPartnerService - returns predictable happy-path data.
 */
export class BenefitPartnerService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'benefit_partner_mock_id',
                name: String(b.name || 'Mock Partner'),
                description: b.description || null,
                category: String(b.category || 'GENERAL'),
                contactInfo: b.contactInfo || {},
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
                name: 'Mock Partner',
                category: 'GENERAL',
                contactInfo: {},
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
                name: (params.data as Record<string, unknown>).name || 'Updated Partner',
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
 * Mock BenefitListingPlanService - returns predictable happy-path data.
 */
export class BenefitListingPlanService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'benefit_listing_plan_mock_id',
                name: String(b.name || 'Mock Benefit Plan'),
                description: b.description || null,
                pricingPlanId: String(b.pricingPlanId),
                maxListings: Number(b.maxListings || 10),
                features: b.features || [],
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
                name: 'Mock Benefit Plan',
                pricingPlanId: 'pricing_plan_mock_id',
                maxListings: 10,
                features: [],
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
                name: (params.data as Record<string, unknown>).name || 'Updated Benefit Plan',
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
 * Mock BenefitListingService - returns predictable happy-path data.
 */
export class BenefitListingService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'benefit_listing_mock_id',
                clientId: String(b.clientId),
                benefitPartnerId: String(b.benefitPartnerId),
                benefitListingPlanId: String(b.benefitListingPlanId),
                title: String(b.title || 'Mock Benefit'),
                description: b.description || null,
                terms: b.terms || '',
                status: 'ACTIVE',
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
                clientId: 'client_mock_id',
                benefitPartnerId: 'partner_mock_id',
                benefitListingPlanId: 'plan_mock_id',
                title: 'Mock Benefit',
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
                title: (params.data as Record<string, unknown>).title || 'Updated Benefit',
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
 * Mock TouristServiceService - returns predictable happy-path data.
 */
export class TouristServiceService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'tourist_service_mock_id',
                clientId: String(b.clientId),
                name: String(b.name || 'Mock Tourist Service'),
                description: b.description || null,
                category: String(b.category || 'TOUR'),
                pricing: b.pricing || {},
                schedule: b.schedule || {},
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
                clientId: 'client_mock_id',
                name: 'Mock Tourist Service',
                category: 'TOUR',
                pricing: {},
                schedule: {},
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
                name: (params.data as Record<string, unknown>).name || 'Updated Tourist Service',
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
 * Mock FeaturedAccommodationService - returns predictable happy-path data.
 */
export class FeaturedAccommodationService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'featured_accommodation_mock_id',
                accommodationId: String(b.accommodationId),
                startDate: b.startDate || new Date().toISOString(),
                endDate: b.endDate || null,
                priority: Number(b.priority || 0),
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
                accommodationId: 'accommodation_mock_id',
                priority: 1,
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
                priority: (params.data as Record<string, unknown>).priority || 1,
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
 * Mock NotificationService - returns predictable happy-path data.
 */
export class NotificationService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'notification_mock_id',
                userId: String(b.userId),
                type: String(b.type || 'INFO'),
                title: String(b.title || 'Mock Notification'),
                message: String(b.message || 'Mock notification message'),
                isRead: b.isRead !== undefined ? b.isRead : false,
                readAt: b.readAt || null,
                actionUrl: b.actionUrl || null,
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
                userId: 'user_mock_id',
                type: 'INFO',
                title: 'Mock Notification',
                message: 'Mock notification message',
                isRead: false,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                isRead: (params.data as Record<string, unknown>).isRead || true,
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
 * Mock PromotionService - returns predictable happy-path data.
 */
export class PromotionService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'promotion_mock_id',
                name: String(b.name || 'Mock Promotion'),
                description: b.description || null,
                promotionType: String(b.promotionType || 'PERCENTAGE'),
                discountPercentage: b.discountPercentage || null,
                discountAmount: b.discountAmount || null,
                startDate: b.startDate || new Date().toISOString(),
                endDate: b.endDate || null,
                isActive: b.isActive !== undefined ? b.isActive : true,
                metadata: b.metadata || null,
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
                name: 'Mock Promotion',
                promotionType: 'PERCENTAGE',
                discountPercentage: 10,
                startDate: '2024-01-01T00:00:00.000Z',
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
                name: (params.data as Record<string, unknown>).name || 'Updated Promotion',
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
 * Mock DiscountCodeService - returns predictable happy-path data.
 */
export class DiscountCodeService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'discount_code_mock_id',
                code: String(b.code || 'MOCK10'),
                promotionId: b.promotionId || null,
                discountType: String(b.discountType || 'PERCENTAGE'),
                discountValue: Number(b.discountValue || 10),
                maxUses: b.maxUses || null,
                usedCount: b.usedCount || 0,
                validFrom: b.validFrom || new Date().toISOString(),
                validTo: b.validTo || null,
                isActive: b.isActive !== undefined ? b.isActive : true,
                metadata: b.metadata || null,
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
                code: 'MOCK10',
                discountType: 'PERCENTAGE',
                discountValue: 10,
                validFrom: '2024-01-01T00:00:00.000Z',
                isActive: true,
                usedCount: 0,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                code: (params.data as Record<string, unknown>).code || 'UPDATED10',
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
 * Mock DiscountCodeUsageService - returns predictable happy-path data.
 */
export class DiscountCodeUsageService {
    async create(_actor: unknown, body: Record<string, unknown>) {
        const b = body as Record<string, unknown>;
        return {
            data: {
                id: 'discount_code_usage_mock_id',
                discountCodeId: String(b.discountCodeId),
                clientId: String(b.clientId),
                subscriptionId: b.subscriptionId || null,
                purchaseId: b.purchaseId || null,
                discountAmount: Number(b.discountAmount || 0),
                usedAt: new Date().toISOString(),
                metadata: b.metadata || null,
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
                discountCodeId: 'discount_code_mock_id',
                clientId: 'client_mock_id',
                discountAmount: 10,
                usedAt: '2024-01-01T00:00:00.000Z',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
    }

    async update(_actor: unknown, params: { id: string; data: Record<string, unknown> }) {
        return {
            data: {
                id: params.id,
                discountAmount: (params.data as Record<string, unknown>).discountAmount || 10,
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
