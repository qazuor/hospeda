import type { ProfessionalService } from '@repo/schemas';
import { ProfessionalServiceCategoryEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory.js';

/**
 * Creates a mock ProfessionalService for testing
 *
 * @param overrides - Partial ProfessionalService to override defaults
 * @returns Complete ProfessionalService object
 */
export function createMockProfessionalService(
    overrides?: Partial<ProfessionalService>
): ProfessionalService {
    const now = new Date();

    const defaults: ProfessionalService = {
        // Base fields
        id: getMockId('professionalService', 'ps1'),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdById: getMockId('user', 'creator') as string | null,
        updatedById: getMockId('user', 'updater') as string | null,
        deletedById: null,

        // Basic service information
        name: 'Professional Photography Service',
        description: 'High-quality professional photography services for accommodations',

        // Service categorization
        category: ProfessionalServiceCategoryEnum.PHOTOGRAPHY,

        // Pricing information
        defaultPricing: {
            basePrice: 50000, // $500.00 in cents
            currency: 'ARS',
            billingUnit: 'project',
            minOrderValue: 30000, // $300.00
            maxOrderValue: 100000 // $1000.00
        },

        // Service availability
        isActive: true,

        // Admin info (optional)
        adminInfo: {
            category: 'photography',
            priority: 'high'
        }
    };

    return { ...defaults, ...overrides };
}

/**
 * Creates a mock inactive ProfessionalService for testing
 *
 * @param overrides - Partial ProfessionalService to override defaults
 * @returns Complete ProfessionalService object with isActive = false
 */
export function createMockInactiveProfessionalService(
    overrides?: Partial<ProfessionalService>
): ProfessionalService {
    return createMockProfessionalService({
        isActive: false,
        ...overrides
    });
}

/**
 * Creates a mock ProfessionalService with hourly billing for testing
 *
 * @param overrides - Partial ProfessionalService to override defaults
 * @returns Complete ProfessionalService object with hourly billing
 */
export function createMockHourlyProfessionalService(
    overrides?: Partial<ProfessionalService>
): ProfessionalService {
    return createMockProfessionalService({
        name: 'Consulting Service',
        description: 'Professional consulting services for accommodation management',
        category: ProfessionalServiceCategoryEnum.CONSULTING,
        defaultPricing: {
            basePrice: 15000, // $150/hour
            currency: 'ARS',
            billingUnit: 'hour',
            minOrderValue: 15000,
            maxOrderValue: 150000
        },
        ...overrides
    });
}
