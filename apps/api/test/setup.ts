/**
 * Test setup file for Vitest.
 * Configures test environment and global mocks.
 */

import { webcrypto } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Polyfill crypto for Hono request-id middleware
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as Crypto;
}

// Global test setup
beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Mock environment variables for testing
    process.env.PORT = '3001';
    process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.HOSPEDA_BETTER_AUTH_SECRET = 'test_better_auth_secret_key_32chars!';
    process.env.API_VALIDATION_AUTH_ENABLED = 'false';
    // Enable mock authentication for tests (required for isMockAuthAllowed())
    process.env.HOSPEDA_DISABLE_AUTH = 'true';
    // Mock exchange rate API key for tests
    process.env.HOSPEDA_EXCHANGE_RATE_API_KEY = 'test_exchange_rate_api_key';

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
        const baseLogger = (loggerModule as any).default;
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
        updatedAt: 'updated_at'
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
vi.mock('@repo/service-core', async () => {
    const { PostService, TagService, PostSponsorService, ServiceError } = await import(
        './helpers/mocks/content-services'
    );

    const { AccommodationService, AmenityService, AccommodationReviewService } = await import(
        './helpers/mocks/accommodation-services'
    );

    const { DestinationService, DestinationReviewService, AttractionService, FeatureService } =
        await import('./helpers/mocks/destination-services');

    const { EventService, EventLocationService, EventOrganizerService } = await import(
        './helpers/mocks/event-services'
    );

    const { UserService, UserBookmarkService } = await import('./helpers/mocks/user-services');

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
