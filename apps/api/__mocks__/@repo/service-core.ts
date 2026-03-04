/**
 * Manual mock for @repo/service-core
 *
 * Vitest uses this file automatically when `vi.mock('@repo/service-core')` is called
 * without a factory function. Split across focused helper modules for maintainability.
 *
 * All mock classes return predictable happy-path data and trigger 404 responses
 * for the well-known sentinel UUID: `87654321-4321-4321-8765-876543218765`.
 *
 * @module __mocks__/@repo/service-core
 */

export { ServiceError, PostService, TagService } from '../../test/helpers/mocks/content-services';

export {
    AccommodationService,
    AmenityService,
    AccommodationReviewService
} from '../../test/helpers/mocks/accommodation-services';

export {
    DestinationService,
    DestinationReviewService,
    AttractionService,
    FeatureService
} from '../../test/helpers/mocks/destination-services';

export {
    EventService,
    EventLocationService,
    EventOrganizerService
} from '../../test/helpers/mocks/event-services';

export { UserService, UserBookmarkService } from '../../test/helpers/mocks/user-services';

export {
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
} from '../../test/helpers/mocks/billing-services';

export {
    AdSlotService,
    AdSlotReservationService,
    AdPricingCatalogService,
    AdMediaAssetService,
    CampaignService,
    SponsorshipService,
    SponsorshipLevelService,
    SponsorshipPackageService,
    OwnerPromotionService
} from '../../test/helpers/mocks/advertising-services';

export {
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
} from '../../test/helpers/mocks/marketplace-services';

export {
    ExchangeRateService,
    ExchangeRateConfigService,
    ExchangeRateFetcher,
    DolarApiClient,
    ExchangeRateApiClient
} from '../../test/helpers/mocks/exchange-rate-services';
