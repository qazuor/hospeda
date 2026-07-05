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

export {
    AccommodationReviewService,
    AccommodationService,
    AmenityService
} from '../../test/helpers/mocks/accommodation-services';
export {
    AdMediaAssetService,
    AdPricingCatalogService,
    AdSlotReservationService,
    AdSlotService,
    CampaignService,
    OwnerPromotionService,
    SponsorshipLevelService,
    SponsorshipPackageService,
    SponsorshipService
} from '../../test/helpers/mocks/advertising-services';
export {
    ClientAccessRightService,
    ClientService,
    CreditNoteService,
    InvoiceLineService,
    InvoiceService,
    PaymentMethodService,
    PaymentService,
    PricingPlanService,
    PricingTierService,
    ProductService,
    PurchaseService,
    RefundService,
    SubscriptionItemService,
    SubscriptionService
} from '../../test/helpers/mocks/billing-services';
export { PostService, ServiceError, TagService } from '../../test/helpers/mocks/content-services';
export {
    AttractionService,
    DestinationReviewService,
    DestinationService,
    FeatureService
} from '../../test/helpers/mocks/destination-services';
export {
    EventLocationService,
    EventOrganizerService,
    EventService
} from '../../test/helpers/mocks/event-services';
export {
    DolarApiClient,
    ExchangeRateApiClient,
    ExchangeRateConfigService,
    ExchangeRateFetcher,
    ExchangeRateService
} from '../../test/helpers/mocks/exchange-rate-services';

export {
    AccommodationListingPlanService,
    AccommodationListingService,
    BenefitListingPlanService,
    BenefitListingService,
    BenefitPartnerService,
    DiscountCodeService,
    DiscountCodeUsageService,
    FeaturedAccommodationService,
    NotificationService,
    ProfessionalServiceOrderService,
    ProfessionalServiceService,
    PromotionService,
    ServiceListingPlanService,
    ServiceListingService,
    TouristServiceService
} from '../../test/helpers/mocks/marketplace-services';
export { UserBookmarkService, UserService } from '../../test/helpers/mocks/user-services';
