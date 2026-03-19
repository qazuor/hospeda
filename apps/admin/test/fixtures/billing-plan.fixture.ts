/**
 * Billing Plan Fixtures
 *
 * Mock data for billing plan entities used in admin integration tests.
 * Shapes derived from PlanDefinition in packages/billing/src/types/plan.types.ts
 */
import { mockSuccessResponse } from '../mocks/handlers';

/** Single valid billing plan */
export const mockBillingPlan = {
    id: 'plan-uuid-001',
    slug: 'basic-owner',
    name: 'Basic Owner',
    description: 'Basic plan for accommodation owners',
    category: 'owner',
    monthlyPriceArs: 500000,
    annualPriceArs: 5000000,
    monthlyPriceUsdRef: 500,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: [
        'publish_accommodations',
        'edit_accommodation_info',
        'view_basic_stats',
        'respond_reviews'
    ],
    limits: [
        {
            key: 'max_accommodations',
            value: 1,
            name: 'Max Accommodations',
            description: 'Maximum number of accommodation listings'
        },
        {
            key: 'max_photos_per_accommodation',
            value: 5,
            name: 'Max Photos',
            description: 'Maximum photos per accommodation'
        }
    ],
    isActive: true
} as const;

/** List of 3 billing plans */
export const mockBillingPlanList = [
    mockBillingPlan,
    {
        ...mockBillingPlan,
        id: 'plan-uuid-002',
        slug: 'pro-owner',
        name: 'Pro Owner',
        description: 'Professional plan for active owners',
        monthlyPriceArs: 1500000,
        annualPriceArs: 15000000,
        monthlyPriceUsdRef: 1500,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 2,
        entitlements: [
            'publish_accommodations',
            'edit_accommodation_info',
            'view_basic_stats',
            'view_advanced_stats',
            'respond_reviews',
            'featured_listing',
            'create_promotions'
        ],
        limits: [
            {
                key: 'max_accommodations',
                value: 5,
                name: 'Max Accommodations',
                description: 'Maximum number of accommodation listings'
            },
            {
                key: 'max_photos_per_accommodation',
                value: 20,
                name: 'Max Photos',
                description: 'Maximum photos per accommodation'
            },
            {
                key: 'max_active_promotions',
                value: 3,
                name: 'Max Active Promotions',
                description: 'Maximum active promotions'
            }
        ]
    },
    {
        ...mockBillingPlan,
        id: 'plan-uuid-003',
        slug: 'enterprise-complex',
        name: 'Enterprise Complex',
        description: 'Enterprise plan for accommodation complexes',
        category: 'complex',
        monthlyPriceArs: 5000000,
        annualPriceArs: 50000000,
        monthlyPriceUsdRef: 5000,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 3,
        entitlements: [
            'publish_accommodations',
            'edit_accommodation_info',
            'view_basic_stats',
            'view_advanced_stats',
            'respond_reviews',
            'featured_listing',
            'create_promotions',
            'multi_property_management',
            'consolidated_analytics',
            'staff_management'
        ],
        limits: [
            {
                key: 'max_accommodations',
                value: -1,
                name: 'Max Accommodations',
                description: 'Maximum number of accommodation listings'
            },
            {
                key: 'max_photos_per_accommodation',
                value: 50,
                name: 'Max Photos',
                description: 'Maximum photos per accommodation'
            },
            {
                key: 'max_staff_accounts',
                value: 10,
                name: 'Max Staff Accounts',
                description: 'Maximum staff accounts'
            }
        ]
    }
] as const;

/** Non-paginated response (plans endpoint returns array directly) */
export const mockBillingPlanListResponse = mockSuccessResponse([...mockBillingPlanList]);
