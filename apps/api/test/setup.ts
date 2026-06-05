/**
 * Test setup file for Vitest.
 * Configures test environment and global mocks.
 *
 * IMPORTANT: Environment variables MUST be set at module scope (before any
 * beforeAll block) because modules like env.ts are imported and validated
 * during test collection, which happens before beforeAll runs.
 */

import { webcrypto } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Polyfill crypto for Hono request-id middleware
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as Crypto;
}

// ---------------------------------------------------------------------------
// Environment variables — set at MODULE SCOPE so they are available when
// modules (env.ts, create-app.ts, etc.) are imported during test collection.
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.API_PORT = '3001';
process.env.HOSPEDA_API_URL = 'http://localhost:3001';
process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
process.env.HOSPEDA_BETTER_AUTH_URL = 'http://localhost:3001/api/auth';
process.env.API_VALIDATION_AUTH_ENABLED = 'false';
// Enable mock authentication for tests (required for isMockAuthAllowed())
process.env.HOSPEDA_DISABLE_AUTH = 'true';
process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
// Mock exchange rate API key for tests
process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';
// Revalidation secret must be >= 32 chars
process.env.HOSPEDA_REVALIDATION_SECRET = 'test_revalidation_secret_key_at_least_32_characters';
// Trusted origins
process.env.HOSPEDA_SITE_URL = 'http://localhost:4321';
process.env.HOSPEDA_ADMIN_URL = 'http://localhost:3000';
// Location obfuscation salt (required, >= 32 chars)
process.env.HOSPEDA_LOCATION_SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';
// View-tracking visitor hash secret (required, >= 32 chars, SPEC-159)
process.env.HOSPEDA_VIEWS_HASH_SECRET = 'test-views-hash-secret-fixed-for-deterministic-tests-32ch';
// Disable rate limiting in tests by default.
// IMPORTANT: z.coerce.boolean() uses Boolean() constructor, so any non-empty
// string (including 'false') coerces to TRUE. Use empty string '' to get false.
// This also overrides any value from .env.test that dotenv might load.
process.env.HOSPEDA_TESTING_RATE_LIMIT = '';
// Disable origin verification in tests
process.env.HOSPEDA_TESTING_ORIGIN_VERIFICATION = '';
// CI sometimes has HOSPEDA_REDIS_URL set as a secret; tests that exercise
// the Redis path mock the redis client and set this env var explicitly.
// Strip it here so the validated env starts without Redis (in-memory store)
// and the per-test setup is fully in control of the store selection.
// biome-ignore lint/performance/noDelete: required to remove the variable from process so env validation sees it as unset
delete process.env.HOSPEDA_REDIS_URL;
// GitHub Actions sets CI=true on every runner. Several test-only guards in
// the API source check for `env.CI !== 'true'` to refuse to enable mock
// actors / disabled-auth shortcuts when running on a real CI pipeline with
// production tokens. That guard is correct for live deployments but wrong
// for the unit-test runner inside CI: there are no production tokens here,
// only mocks. Strip the variable so the guards see this as a regular test
// environment.
// biome-ignore lint/performance/noDelete: required to remove the variable from process so env validation sees it as unset
delete process.env.CI;
// Linear / Feedback integration is loaded eagerly at module init; without
// a key the feedback route returns null linearIssueId regardless of how the
// service is mocked. Provide a stable test value so the route's eager guard
// (`if (!apiKey) return null`) does not short-circuit before the mocked
// LinearFeedbackService is consulted.
process.env.HOSPEDA_LINEAR_API_KEY = 'test_linear_api_key_placeholder';
process.env.HOSPEDA_FEEDBACK_ENABLED = 'true';

// Global test setup
beforeAll(async () => {
    // Initialize environment validation
    try {
        const envModule = await import('../src/utils/env');
        if (envModule.validateApiEnv && typeof envModule.validateApiEnv === 'function') {
            envModule.validateApiEnv();
        }
    } catch (_error) {
        // Environment validation failed or module is mocked - expected in some scenarios
    }

    // Reduce logger noise in tests: show only errors
    try {
        const loggerModule = await import('@repo/logger');
        const baseLogger = (loggerModule as Record<string, unknown>).default as
            | { configure?: (opts: Record<string, unknown>) => void }
            | undefined;
        if (baseLogger?.configure) {
            baseLogger.configure({
                LEVEL: 'ERROR',
                INCLUDE_LEVEL: false,
                INCLUDE_TIMESTAMPS: false,
                USE_COLORS: false,
                SAVE: false,
                EXPAND_OBJECT_LEVELS: 0,
                TRUNCATE_LONG_TEXT: true,
                TRUNCATE_LONG_TEXT_AT: 80,
                STRINGIFY_OBJECTS: false
            });
        }
    } catch {
        // noop
    }
});

// Mock @repo/logger - must be top-level to ensure hoisting before module imports
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    const AuditEventType = {
        AUTH_LOGIN_FAILED: 'auth.login.failed',
        AUTH_LOGIN_SUCCESS: 'auth.login.success',
        AUTH_LOCKOUT: 'auth.lockout',
        AUTH_PASSWORD_CHANGED: 'auth.password.changed',
        ACCESS_DENIED: 'access.denied',
        BILLING_MUTATION: 'billing.mutation',
        PERMISSION_CHANGE: 'permission.change',
        SESSION_SIGNOUT: 'session.signout',
        USER_ADMIN_MUTATION: 'user.admin.mutation',
        ROUTE_MUTATION: 'route.mutation'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel,
        AuditEventType
    };
});

// Mock @repo/db - must be top-level to ensure hoisting before module imports
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('./helpers/mocks/db-mock');
    return createDbMock();
});

// Mock @repo/db/schemas separately
vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        canceledAt: 'canceled_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        promoCodeId: 'promo_code_id',
        metadata: 'metadata',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    },
    billingNotificationLogs: {
        id: 'id',
        customerId: 'customer_id',
        eventType: 'event_type',
        channel: 'channel',
        status: 'status',
        metadata: 'metadata',
        createdAt: 'created_at'
    }
}));

// Mock @repo/service-core - service classes are imported from dedicated mock files.
// Must be top-level to ensure hoisting before module imports.
// Pure utility functions (no side effects) are passed through from the real module.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const { PostService, TagService, PostTagService, PostSponsorService, ServiceError } =
        await import('./helpers/mocks/content-services');

    const { AccommodationService, AmenityService, AccommodationReviewService } = await import(
        './helpers/mocks/accommodation-services'
    );

    const { DestinationService, DestinationReviewService, AttractionService, FeatureService } =
        await import('./helpers/mocks/destination-services');

    const { EventService, EventLocationService, EventOrganizerService } = await import(
        './helpers/mocks/event-services'
    );

    const { UserService, UserBookmarkService, UserBookmarkCollectionService } = await import(
        './helpers/mocks/user-services'
    );

    const {
        ExchangeRateService,
        ExchangeRateConfigService,
        ExchangeRateFetcher,
        DolarApiClient,
        ExchangeRateApiClient
    } = await import('./helpers/mocks/exchange-rate-services');

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
    } = await import('./helpers/mocks/billing-services');

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
    } = await import('./helpers/mocks/advertising-services');

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
    } = await import('./helpers/mocks/marketplace-services');

    return {
        // Pass through all actual exports (types, enums, pure functions) then override service classes
        ...actual,
        ServiceError,
        PostService,
        TagService,
        PostTagService,
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
        UserBookmarkCollectionService,
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
        DiscountCodeUsageService,
        // SPEC-192 T-024: PlanService.getBySlug is used by entitlement middleware
        // (buildHostDraftDefaultsResult) for the host-draft fallback path. The global
        // mock returns the owner-basico plan data so existing entitlement tests that
        // assert on HOST actor entitlements continue to pass without a real DB.
        PlanService: class MockPlanService {
            async getBySlug(slug: string) {
                if (slug === 'owner-basico') {
                    return {
                        success: true as const,
                        data: {
                            id: 'mock-owner-basico-id',
                            slug: 'owner-basico',
                            name: 'Básico',
                            description: 'Plan básico para anfitriones',
                            category: 'owner' as const,
                            monthlyPriceArs: 500_000,
                            annualPriceArs: null,
                            monthlyPriceUsdRef: 5,
                            hasTrial: true,
                            trialDays: 14,
                            isDefault: true,
                            sortOrder: 1,
                            // Entitlements mirror the real owner-basico static config so
                            // existing entitlement tests (e.g. PUBLISH_ACCOMMODATIONS
                            // assertion at line 209 of entitlement.test.ts) continue to pass.
                            // Values match packages/billing/src/config/plans.config.ts OWNER_BASICO_PLAN.
                            entitlements: [
                                'publish_accommodations',
                                'edit_accommodation_info',
                                'view_basic_stats',
                                'respond_reviews',
                                'can_use_calendar',
                                'can_contact_whatsapp_display'
                            ],
                            // Limits mirror the real owner-basico static config
                            limits: {
                                max_accommodations: 1,
                                max_photos_per_accommodation: 5,
                                max_active_promotions: 0
                            },
                            isActive: true,
                            createdAt: '2026-01-01T00:00:00.000Z',
                            updatedAt: '2026-01-01T00:00:00.000Z'
                        }
                    };
                }
                return {
                    success: false as const,
                    error: { code: 'NOT_FOUND', message: `Plan not found: ${slug}` }
                };
            }
            async list() {
                return {
                    success: true as const,
                    data: {
                        items: [],
                        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                    }
                };
            }
            async getById() {
                return {
                    success: false as const,
                    error: { code: 'NOT_FOUND', message: 'Plan not found' }
                };
            }
        }
    };
});

// Global test cleanup
afterAll(async () => {
    // Cleanup test environment
});

// Per-test setup
beforeEach(async () => {
    // Setup before each test
});

// Per-test cleanup
afterEach(async () => {
    // Cleanup after each test
});
