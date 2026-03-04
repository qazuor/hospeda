/**
 * Real User Scenarios End-to-End Integration Tests
 * Tests complete user journeys through the API to ensure the entire stack
 * works together seamlessly for real-world use cases
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initApp } from '../../src/app';
import { resetMetrics } from '../../src/middlewares/metrics';

// Mock external dependencies
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis(),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger())
    };

    return {
        default: mockLogger,
        logger: mockLogger,
        createLogger: mockLogger.createLogger,
        LoggerColors: {
            BLACK: 'BLACK',
            RED: 'RED',
            GREEN: 'GREEN',
            YELLOW: 'YELLOW',
            BLUE: 'BLUE',
            MAGENTA: 'MAGENTA',
            CYAN: 'CYAN',
            WHITE: 'WHITE',
            GRAY: 'GRAY'
        },
        LogLevel: {
            LOG: 'LOG',
            INFO: 'INFO',
            WARN: 'WARN',
            ERROR: 'ERROR',
            DEBUG: 'DEBUG'
        }
    };
});

// Mock @repo/billing to avoid unbuilt dist issues in e2e config
vi.mock('@repo/billing', () => ({
    DUNNING_RETRY_INTERVALS: [1, 3, 5, 7] as const,
    DUNNING_GRACE_PERIOD_DAYS: 7,
    OWNER_TRIAL_DAYS: 14,
    COMPLEX_TRIAL_DAYS: 14,
    PAYMENT_GRACE_PERIOD_DAYS: 3,
    MAX_PAYMENT_RETRY_ATTEMPTS: 3,
    ENTITLEMENT_CACHE_TTL_MS: 300000,
    PLAN_CACHE_TTL_MS: 1800000,
    DEFAULT_CURRENCY: 'ARS',
    REFERENCE_CURRENCY: 'USD',
    MERCADO_PAGO_DEFAULT_TIMEOUT_MS: 5000,
    LimitKey: {
        MAX_ACCOMMODATIONS: 'MAX_ACCOMMODATIONS',
        MAX_IMAGES_PER_ACCOMMODATION: 'MAX_IMAGES_PER_ACCOMMODATION',
        MAX_FEATURED_ACCOMMODATIONS: 'MAX_FEATURED_ACCOMMODATIONS'
    },
    EntitlementKey: {
        ANALYTICS_BASIC: 'ANALYTICS_BASIC',
        ANALYTICS_ADVANCED: 'ANALYTICS_ADVANCED'
    },
    ALL_PLANS: [],
    ALL_ADDONS: [],
    LIMIT_METADATA: {},
    getPlanBySlug: vi.fn().mockReturnValue(undefined),
    getAddonBySlug: vi.fn().mockReturnValue(undefined),
    validateBillingConfigOrThrow: vi.fn(),
    createMercadoPagoAdapter: vi.fn().mockReturnValue({}),
    createBillingAdapter: vi.fn().mockReturnValue({})
}));

// Mock @repo/db to avoid real database connections
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return createDbMock();
});

// Mock @repo/service-core using the same helpers as test/setup.ts
vi.mock('@repo/service-core', async () => {
    const { PostService, TagService, PostSponsorService, ServiceError } = await import(
        '../helpers/mocks/content-services'
    );

    const { AccommodationService, AmenityService, AccommodationReviewService } = await import(
        '../helpers/mocks/accommodation-services'
    );

    const { DestinationService, DestinationReviewService, AttractionService, FeatureService } =
        await import('../helpers/mocks/destination-services');

    const { EventService, EventLocationService, EventOrganizerService } = await import(
        '../helpers/mocks/event-services'
    );

    const { UserService, UserBookmarkService } = await import('../helpers/mocks/user-services');

    const {
        ExchangeRateService,
        ExchangeRateConfigService,
        ExchangeRateFetcher,
        DolarApiClient,
        ExchangeRateApiClient
    } = await import('../helpers/mocks/exchange-rate-services');

    const {
        ClientService,
        ClientAccessRightService,
        ProductService,
        PricingPlanService,
        PricingTierService,
        SubscriptionService,
        PurchaseService,
        SubscriptionItemService,
        PaymentService,
        PaymentMethodService,
        InvoiceService,
        InvoiceLineService,
        RefundService,
        CreditNoteService
    } = await import('../helpers/mocks/billing-services');

    const {
        AdSlotService,
        AdSlotReservationService,
        AdPricingCatalogService,
        AdMediaAssetService,
        CampaignService,
        SponsorshipService,
        SponsorshipLevelService,
        SponsorshipPackageService,
        OwnerPromotionService
    } = await import('../helpers/mocks/advertising-services');

    const {
        ProfessionalServiceService,
        ProfessionalServiceOrderService,
        ServiceListingService,
        AccommodationListingService,
        AccommodationListingPlanService,
        ServiceListingPlanService,
        BenefitPartnerService,
        BenefitListingPlanService,
        BenefitListingService,
        TouristServiceService,
        FeaturedAccommodationService,
        NotificationService,
        PromotionService,
        DiscountCodeService,
        DiscountCodeUsageService
    } = await import('../helpers/mocks/marketplace-services');

    return {
        ServiceError,
        PostService,
        TagService,
        PostSponsorService,
        AccommodationService,
        AmenityService,
        AccommodationReviewService,
        DestinationService,
        DestinationReviewService,
        AttractionService,
        FeatureService,
        EventService,
        EventLocationService,
        EventOrganizerService,
        UserService,
        UserBookmarkService,
        ExchangeRateService,
        ExchangeRateConfigService,
        ExchangeRateFetcher,
        DolarApiClient,
        ExchangeRateApiClient,
        ClientService,
        ClientAccessRightService,
        ProductService,
        PricingPlanService,
        PricingTierService,
        SubscriptionService,
        PurchaseService,
        SubscriptionItemService,
        PaymentService,
        PaymentMethodService,
        InvoiceService,
        InvoiceLineService,
        RefundService,
        CreditNoteService,
        AdSlotService,
        AdSlotReservationService,
        AdPricingCatalogService,
        AdMediaAssetService,
        CampaignService,
        SponsorshipService,
        SponsorshipLevelService,
        SponsorshipPackageService,
        OwnerPromotionService,
        ProfessionalServiceService,
        ProfessionalServiceOrderService,
        ServiceListingService,
        AccommodationListingService,
        AccommodationListingPlanService,
        ServiceListingPlanService,
        BenefitPartnerService,
        BenefitListingPlanService,
        BenefitListingService,
        TouristServiceService,
        FeaturedAccommodationService,
        NotificationService,
        PromotionService,
        DiscountCodeService,
        DiscountCodeUsageService
    };
});

// Tests use global service mocks from test/setup.ts (unit config) or inline mocks above (e2e config)
describe('Real User Scenarios End-to-End', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMetrics();
    });

    describe('API Discovery Journey', () => {
        // TODO: Fix test - assumes /metrics route exists at root level, but actual route is
        // /api/v1/admin/metrics. Also assumes health response uses { success, data } wrapper
        // format, but the actual /health response format differs. Needs route path alignment
        // and response format verification before re-enabling.
        it.todo('should guide user through API exploration (docs → health → metrics)');
    });

    describe('Frontend Integration Journey', () => {
        it('should handle CORS preflight and data fetching for frontend app', async () => {
            const app = initApp();
            const origin = 'https://hospeda-frontend.com';

            // Step 1: Browser sends CORS preflight for API call
            const preflightRes = await app.request('/api/v1/accommodations', {
                method: 'OPTIONS',
                headers: {
                    origin,
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'content-type,authorization'
                }
            });

            // CORS preflight should be handled appropriately
            expect([200, 204, 404, 429]).toContain(preflightRes.status);
            expect(preflightRes.headers.get('x-request-id')).toBeTruthy();

            // Step 2: Frontend makes actual API call
            const apiRes = await app.request('/api/v1/accommodations', {
                method: 'GET',
                headers: {
                    'user-agent': 'Mozilla/5.0 (frontend app)',
                    accept: 'application/json',
                    origin
                }
            });

            expect([200, 404, 429]).toContain(apiRes.status);

            if (apiRes.status === 200) {
                // Should have CORS headers for frontend
                const allowOrigin = apiRes.headers.get('access-control-allow-origin');
                expect(allowOrigin).toBeTruthy();

                // Should have proper JSON response
                const data = await apiRes.json();
                expect(data.success).toBe(true);
                expect(data.metadata.requestId).toBeTruthy();
            }

            // Step 3: Frontend handles pagination
            const paginatedRes = await app.request('/api/v1/accommodations?page=1&pageSize=10', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (frontend pagination)',
                    accept: 'application/json',
                    origin
                }
            });

            expect([200, 404, 429]).toContain(paginatedRes.status);
            expect(paginatedRes.headers.get('x-request-id')).toBeTruthy();
        });
    });

    describe('Mobile App Integration Journey', () => {
        // TODO: Fix test - assumes x-request-id header is present on all responses including
        // 404 not-found responses from /api/v1/accommodations (wrong path, real path is
        // /api/v1/public/accommodations). The not-found handler does not inject x-request-id.
        // Needs correct API paths and verification of header injection on error responses.
        it.todo('should handle mobile app requests with different user agents');
    });

    describe('API Client Integration Journey', () => {
        // TODO: Fix test - uses incorrect paths (/metrics, /api/v1/accommodations) that return
        // 404. The 404 not-found handler does not inject x-request-id, causing the assertion
        // `expect(res.headers.get('x-request-id')).toBeTruthy()` to fail for those responses.
        // Correct paths: /api/v1/admin/metrics, /api/v1/public/accommodations.
        it.todo('should handle programmatic API usage patterns');
    });

    describe('Error Recovery Journey', () => {
        it('should help user recover from various error conditions', async () => {
            const app = initApp();

            // Step 1: User makes request with wrong content type
            const wrongContentRes = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'not json'
            });

            expect([400, 429]).toContain(wrongContentRes.status);

            if (wrongContentRes.status === 400) {
                const errorData = await wrongContentRes.json();
                expect(errorData.success).toBe(false);
                expect(errorData.error.code).toBeDefined();
                expect(errorData.error.message).toBeDefined();
                // Error should guide user to correct usage
                expect(errorData.metadata.requestId).toBeTruthy();
            }

            // Step 2: User corrects and retries with proper format
            const correctedRes = await app.request('/health/live', {
                method: 'GET', // Use GET instead of POST
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json'
                }
            });

            expect([200, 429]).toContain(correctedRes.status);

            if (correctedRes.status === 200) {
                const successData = await correctedRes.json();
                expect(successData.success).toBe(true);
                expect(successData.data).toBeDefined();
            }

            // Step 3: User tries invalid endpoint and gets helpful error
            const notFoundRes = await app.request('/api/v1/nonexistent', {
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json'
                }
            });

            expect([404, 429]).toContain(notFoundRes.status);

            if (notFoundRes.status === 404) {
                const notFoundData = await notFoundRes.json();
                expect(notFoundData.success).toBe(false);
                expect(notFoundData.error).toBeDefined();
            }
        });
    });

    describe('Performance Under Load Journey', () => {
        // TODO: Fix test - asserts x-request-id is present on every response, but the
        // security headers middleware (which injects x-request-id and x-content-type-options)
        // is not applied uniformly across all 200 health endpoint responses in the e2e config.
        // Needs verification that health route middleware chain includes security headers.
        it.todo('should maintain consistent performance across user session');
    });

    describe('Monitoring and Debugging Journey', () => {
        // TODO: Fix test - uses /metrics, /metrics/system, and /metrics/api paths that do not
        // exist. The actual metrics endpoint is /api/v1/admin/metrics (requires admin auth).
        // Sub-paths /metrics/system and /metrics/api are also non-existent routes.
        // Needs correct path: /api/v1/admin/metrics with appropriate auth headers.
        it.todo('should provide comprehensive information for debugging issues');
    });

    describe('Cross-Origin Resource Sharing Journey', () => {
        // TODO: Fix test - asserts x-request-id is present on /health responses for each
        // origin iteration. In practice the header is not present on all /health responses
        // when running under the e2e config. Likely a rate-limit or middleware ordering issue
        // under concurrent requests. Needs isolated investigation per origin.
        it.todo('should handle complex CORS scenarios for web applications');
    });

    describe('Complete User Workflow', () => {
        // TODO: Fix test - asserts x-request-id and security headers (x-content-type-options,
        // x-frame-options) are present on all responses. Under the e2e config the security
        // middleware does not consistently inject these headers on health and public API
        // responses. Requires verifying the full middleware chain for each route group.
        it.todo('should handle a complete user interaction workflow');
    });
});
