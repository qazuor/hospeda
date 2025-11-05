import { z } from 'zod';

const BaseIdSchema = z
    .string({
        message: 'zodError.common.id.required'
    })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

export const IdSchema = BaseIdSchema;
export type IdType = z.infer<typeof IdSchema>;

/**
 * Base ID fields - Using UUID as agreed
 */
export const BaseIdFields = {
    id: z.string().uuid({
        message: 'zodError.common.id.invalid'
    })
} as const;

// Specific ID schemas for each entity
export const UserIdSchema = BaseIdSchema;
export type UserIdType = z.infer<typeof UserIdSchema>;

export const UserBookmarkIdSchema = BaseIdSchema;
export type UserBookmarkIdType = z.infer<typeof UserBookmarkIdSchema>;

export const TagIdSchema = BaseIdSchema;
export type TagIdType = z.infer<typeof TagIdSchema>;

export const AccommodationIdSchema = BaseIdSchema;
export type AccommodationIdType = z.infer<typeof AccommodationIdSchema>;

export const AccommodationFaqIdSchema = BaseIdSchema;
export type AccommodationFaqIdType = z.infer<typeof AccommodationFaqIdSchema>;

export const AccommodationIaDataIdSchema = BaseIdSchema;
export type AccommodationIaDataIdType = z.infer<typeof AccommodationIaDataIdSchema>;

export const AccommodationReviewIdSchema = BaseIdSchema;
export type AccommodationReviewIdType = z.infer<typeof AccommodationReviewIdSchema>;

export const AmenityIdSchema = BaseIdSchema;
export type AmenityIdType = z.infer<typeof AmenityIdSchema>;

export const FeatureIdSchema = BaseIdSchema;
export type FeatureIdType = z.infer<typeof FeatureIdSchema>;

export const AttractionIdSchema = BaseIdSchema;
export type AttractionIdType = z.infer<typeof AttractionIdSchema>;

export const DestinationIdSchema = BaseIdSchema;
export type DestinationIdType = z.infer<typeof DestinationIdSchema>;

export const DestinationReviewIdSchema = BaseIdSchema;
export type DestinationReviewIdType = z.infer<typeof DestinationReviewIdSchema>;

export const EventIdSchema = BaseIdSchema;
export type EventIdType = z.infer<typeof EventIdSchema>;

export const EventLocationIdSchema = BaseIdSchema;
export type EventLocationIdType = z.infer<typeof EventLocationIdSchema>;

export const EventOrganizerIdSchema = BaseIdSchema;
export type EventOrganizerIdType = z.infer<typeof EventOrganizerIdSchema>;

export const PostIdSchema = BaseIdSchema;
export type PostIdType = z.infer<typeof PostIdSchema>;

export const PostSponsorIdSchema = BaseIdSchema;
export type PostSponsorIdType = z.infer<typeof PostSponsorIdSchema>;

export const PostSponsorshipIdSchema = BaseIdSchema;
export type PostSponsorshipIdType = z.infer<typeof PostSponsorshipIdSchema>;

export const PaymentIdSchema = BaseIdSchema;
export type PaymentIdType = z.infer<typeof PaymentIdSchema>;

export const PaymentPlanIdSchema = BaseIdSchema;
export type PaymentPlanIdType = z.infer<typeof PaymentPlanIdSchema>;

export const SubscriptionIdSchema = BaseIdSchema;
export type SubscriptionIdType = z.infer<typeof SubscriptionIdSchema>;

export const ClientIdSchema = BaseIdSchema;
export type ClientIdType = z.infer<typeof ClientIdSchema>;

export const ClientAccessRightIdSchema = BaseIdSchema;
export type ClientAccessRightIdType = z.infer<typeof ClientAccessRightIdSchema>;

export const ProductIdSchema = BaseIdSchema;
export type ProductIdType = z.infer<typeof ProductIdSchema>;

export const PricingPlanIdSchema = BaseIdSchema;
export type PricingPlanIdType = z.infer<typeof PricingPlanIdSchema>;

export const PricingTierIdSchema = BaseIdSchema;
export type PricingTierIdType = z.infer<typeof PricingTierIdSchema>;

export const PurchaseIdSchema = BaseIdSchema;
export type PurchaseIdType = z.infer<typeof PurchaseIdSchema>;

export const SubscriptionItemIdSchema = BaseIdSchema;
export type SubscriptionItemIdType = z.infer<typeof SubscriptionItemIdSchema>;

// === Billing System IDs ===
export const InvoiceIdSchema = BaseIdSchema;
export type InvoiceIdType = z.infer<typeof InvoiceIdSchema>;

export const InvoiceLineIdSchema = BaseIdSchema;
export type InvoiceLineIdType = z.infer<typeof InvoiceLineIdSchema>;

export const PaymentMethodIdSchema = BaseIdSchema;
export type PaymentMethodIdType = z.infer<typeof PaymentMethodIdSchema>;

export const CreditNoteIdSchema = BaseIdSchema;
export type CreditNoteIdType = z.infer<typeof CreditNoteIdSchema>;

export const RefundIdSchema = BaseIdSchema;
export type RefundIdType = z.infer<typeof RefundIdSchema>;

// === Promotions & Discounts System IDs ===
export const DiscountCodeIdSchema = BaseIdSchema;
export type DiscountCodeIdType = z.infer<typeof DiscountCodeIdSchema>;

export const DiscountCodeUsageIdSchema = BaseIdSchema;
export type DiscountCodeUsageIdType = z.infer<typeof DiscountCodeUsageIdSchema>;

export const PromotionIdSchema = BaseIdSchema;
export type PromotionIdType = z.infer<typeof PromotionIdSchema>;

export const SponsorshipIdSchema = BaseIdSchema;
export type SponsorshipIdType = z.infer<typeof SponsorshipIdSchema>;

// === Notifications & Marketing System IDs ===
export const NotificationIdSchema = BaseIdSchema;
export type NotificationIdType = z.infer<typeof NotificationIdSchema>;

export const CampaignIdSchema = BaseIdSchema;
export type CampaignIdType = z.infer<typeof CampaignIdSchema>;

export const AdSlotIdSchema = BaseIdSchema;
export type AdSlotIdType = z.infer<typeof AdSlotIdSchema>;

export const AdMediaAssetIdSchema = BaseIdSchema;
export type AdMediaAssetIdType = z.infer<typeof AdMediaAssetIdSchema>;

export const AdPricingCatalogIdSchema = BaseIdSchema;
export type AdPricingCatalogIdType = z.infer<typeof AdPricingCatalogIdSchema>;

// === Professional Services System IDs ===
export const ProfessionalServiceIdSchema = BaseIdSchema;
export type ProfessionalServiceIdType = z.infer<typeof ProfessionalServiceIdSchema>;

export const ServiceOrderIdSchema = BaseIdSchema;
export type ServiceOrderIdType = z.infer<typeof ServiceOrderIdSchema>;

// === Benefit Listings System IDs ===
export const BenefitListingIdSchema = BaseIdSchema;
export type BenefitListingIdType = z.infer<typeof BenefitListingIdSchema>;

export const BenefitPartnerIdSchema = BaseIdSchema;
export type BenefitPartnerIdType = z.infer<typeof BenefitPartnerIdSchema>;

export const BenefitListingPlanIdSchema = BaseIdSchema;
export type BenefitListingPlanIdType = z.infer<typeof BenefitListingPlanIdSchema>;

// === Accommodation Listings System IDs ===
export const AccommodationListingIdSchema = BaseIdSchema;
export type AccommodationListingIdType = z.infer<typeof AccommodationListingIdSchema>;

export const AccommodationListingPlanIdSchema = BaseIdSchema;
export type AccommodationListingPlanIdType = z.infer<typeof AccommodationListingPlanIdSchema>;

export const FeaturedAccommodationIdSchema = BaseIdSchema;
export type FeaturedAccommodationIdType = z.infer<typeof FeaturedAccommodationIdSchema>;
