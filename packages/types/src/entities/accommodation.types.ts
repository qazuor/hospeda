import type {
    AdminInfoType,
    BaseEntityType,
    BasePriceType,
    ContactInfoType,
    LocationType,
    MediaType,
    SeoType,
    SocialNetworkType
} from '../common.types';
import type { AccommodationTypeEnum, AmenitiesTypeEnum } from '../enums.types';

/**
 * Represents an additional fee not predefined in the system.
 */
export interface OtherAdditionalFeesType {
    name: string;
    displayName: string;
    value: number;
}

/**
 * Represents a custom discount.
 */
export interface OtherDiscountType {
    name: string;
    displayName: string;
    value: number;
}

/**
 * Represents optional fees associated with a stay.
 */
export interface AdditionalFeesType {
    cleaning?: number;
    taxPercent?: number;
    lateCheckout?: number;
    others?: OtherAdditionalFeesType[];
}

/**
 * Represents optional discounts applied to a booking.
 */
export interface DiscountsType {
    weekly?: number;
    monthly?: number;
    lastMinute?: number;
    others?: OtherDiscountType[];
}

/**
 * Price details of the accommodation, including base and modifiers.
 */
export interface AccommodationPriceType {
    basePrice: BasePriceType;
    additionalFees?: AdditionalFeesType;
    discounts?: DiscountsType;
}

/**
 * Amenity object used to define services/features offered in an accommodation.
 */
export interface AmenitiesType {
    name: string;
    displayName: string;
    optional: boolean;
    additionalCost?: BasePriceType;
    additionalCostPercent?: number;
    description: string;
    type?: AmenitiesTypeEnum;
}

/**
 * Detailed user rating categories for an accommodation.
 */
export interface AccommodationRatingType {
    cleanliness: number;
    hospitality: number;
    services: number;
    accuracy: number;
    communication: number;
    location: number;
}

/**
 * Schedule and timing configuration for an accommodation.
 */
export interface ScheduleType {
    checkinTime?: string; // Format: "HH:mm"
    checkoutTime?: string;
    lateCheckout: boolean;
    lateCheckoutTime?: string;
    selfCheckin: boolean;
    selfCheckout: boolean;
}

/**
 * Detailed information about capacity, rooms and rules.
 */
export interface ExtraInfoType {
    capacity: number;
    minNights: number;
    maxNights?: number;
    bedrooms: number;
    beds?: number;
    bathrooms: number;
    petFriendly?: boolean;
    smokingAllowed?: boolean;
    extraRules?: string[];
}

/**
 * User-submitted review about an accommodation.
 */
export interface AccommodationReviewType {
    author: string; // UUID of user
    title: string;
    content: string;
    rating: AccommodationRatingType;
}

/**
 * Frequently asked question specific to an accommodation.
 */
export interface AccommodationFaqType extends BaseEntityType {
    question: string;
    answer: string;
    adminInfo?: AdminInfoType;
}

/**
 * Content generated or summarized via AI for the accommodation.
 */
export interface AccommodationIaDataType extends BaseEntityType {
    title: string;
    content: string;
    adminInfo?: AdminInfoType;
}

/**
 * Full representation of an accommodation listing.
 */
export interface AccommodationType extends BaseEntityType {
    slug: string;
    type: AccommodationTypeEnum;
    description: string;
    contactInfo: ContactInfoType;
    socialNetworks: SocialNetworkType;
    price: AccommodationPriceType;
    ownerId: string;
    destinationId: string;
    location: LocationType;
    features: string[];
    amenities: AmenitiesType[];
    media: MediaType;
    rating: AccommodationRatingType;
    reviews: AccommodationReviewType[];
    schedule: ScheduleType;
    extraInfo: ExtraInfoType;
    isFeatured?: boolean;
    tags?: string[];
    seo?: SeoType;
    adminInfo?: AdminInfoType;
    faqs?: AccommodationFaqType[];
    iaData?: AccommodationIaDataType[];
}
