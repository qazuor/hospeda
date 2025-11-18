/**
 * adSlotFactory.ts
 *
 * Factory functions for generating AdSlot mock data for tests.
 * All mock data for AdSlotService tests should be created here.
 */

import type { AdSlot } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock AdSlotId for use in tests.
 */
export const getMockAdSlotId = (id?: string): string => getMockId('adSlot', id) as string;

// ============================================================================
// BASE MOCK DATA
// ============================================================================

/**
 * Creates a base AdSlot with sensible defaults for testing.
 */
export const createMockAdSlot = (overrides: Partial<AdSlot> = {}): AdSlot => ({
    // Base fields
    id: getMockAdSlotId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdById: getMockId('user') as string,
    updatedById: getMockId('user') as string,
    deletedById: null,

    // Slot identification and basic info
    name: 'Test Ad Slot',
    description: 'Test ad slot description for testing purposes',

    // Slot positioning and placement
    placement: {
        page: 'homepage',
        position: 'header',
        priority: 5
    },

    // Slot dimensions and format requirements
    format: {
        width: 970,
        height: 250,
        aspectRatio: '16:9',
        allowedFormats: ['banner', 'leaderboard'],
        isResponsive: true
    },

    // Targeting and visibility rules
    targeting: {
        blockedCountries: [],
        allowedDevices: ['desktop', 'mobile', 'tablet'],
        allowedContentTypes: ['general'],
        requiresAuthentication: false,
        allowedUserTypes: ['all']
    },

    // Pricing and monetization
    pricing: {
        model: 'cpm',
        basePrice: 10.0,
        currency: 'USD',
        premiumMultiplier: 1,
        seasonalAdjustments: []
    },

    // Availability and scheduling
    availability: {
        isActive: true,
        timeSlots: [],
        maxReservationsPerDay: 10,
        blackoutDates: []
    },

    // Performance tracking (optional)
    performance: {
        totalImpressions: 0,
        totalClicks: 0,
        totalRevenue: 0,
        averageCTR: 0,
        averageRPM: 0,
        fillRate: 0
    },

    // Content restrictions and policies (optional)
    restrictions: {
        blockedCategories: [],
        requiredCertifications: [],
        languageRestrictions: [],
        allowExternalLinks: true,
        requiresReview: false
    },

    // Metadata and settings (optional)
    metadata: {
        tags: [],
        isTestSlot: false,
        autoApprove: false
    },

    ...overrides
});

/**
 * Creates a collection of AdSlots for bulk testing.
 */
export const createMockAdSlots = (count: number, overrides: Partial<AdSlot> = {}): AdSlot[] =>
    Array.from({ length: count }, (_, i) =>
        createMockAdSlot({
            id: getMockAdSlotId(`slot-${i + 1}`),
            name: `Test Ad Slot ${i + 1}`,
            ...overrides
        })
    );

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    create: createMockAdSlot,
    createMany: createMockAdSlots,
    ids: {
        adSlot: getMockAdSlotId
    }
};

// ============================================================================
// SCENARIO-SPECIFIC FACTORIES
// ============================================================================

/**
 * Creates an ad slot with homepage header placement
 */
export const createHomepageHeaderSlot = (overrides?: Partial<AdSlot>): AdSlot => {
    return createMockAdSlot({
        name: 'Homepage Header Banner',
        placement: {
            page: 'homepage',
            position: 'header',
            priority: 1
        },
        format: {
            width: 970,
            height: 250,
            aspectRatio: '16:9',
            allowedFormats: ['banner', 'leaderboard'],
            isResponsive: true
        },
        ...overrides
    });
};

/**
 * Creates an ad slot with sidebar placement
 */
export const createSidebarSlot = (overrides?: Partial<AdSlot>): AdSlot => {
    return createMockAdSlot({
        name: 'Sidebar Ad',
        placement: {
            page: 'search_results',
            position: 'sidebar_top',
            priority: 3
        },
        format: {
            width: 300,
            height: 600,
            aspectRatio: '1:2',
            allowedFormats: ['skyscraper'],
            isResponsive: true
        },
        ...overrides
    });
};

/**
 * Creates an inactive ad slot
 */
export const createInactiveSlot = (overrides?: Partial<AdSlot>): AdSlot => {
    return createMockAdSlot({
        availability: {
            isActive: false,
            timeSlots: [],
            maxReservationsPerDay: 10,
            blackoutDates: []
        },
        ...overrides
    });
};

/**
 * Creates a premium ad slot with high pricing
 */
export const createPremiumSlot = (overrides?: Partial<AdSlot>): AdSlot => {
    return createMockAdSlot({
        name: 'Premium Homepage Banner',
        placement: {
            page: 'homepage',
            position: 'header',
            priority: 1
        },
        pricing: {
            model: 'cpm',
            basePrice: 50.0,
            currency: 'USD',
            premiumMultiplier: 2.5,
            seasonalAdjustments: []
        },
        ...overrides
    });
};

/**
 * Creates a test ad slot (for development)
 */
export const createTestSlot = (overrides?: Partial<AdSlot>): AdSlot => {
    return createMockAdSlot({
        metadata: {
            tags: ['test', 'development'],
            isTestSlot: true,
            autoApprove: true
        },
        ...overrides
    });
};
