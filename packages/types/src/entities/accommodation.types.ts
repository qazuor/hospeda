import type {
    BaseEntityType,
    BasePriceType,
    ContactInfoType,
    FullLocationType,
    MediaType,
    SeoType,
    SocialNetworkType
} from '../common.types';
import type { AccommodationTypeEnum, AmenitiesTypeEnum } from '../enums.types';
import type { DestinationType } from './destination.types';
import type { UserType } from './user.types';

/**
 * Represents optional fees info.
 */
export interface AdditionalFeesInfoType {
    price?: BasePriceType;
    percent?: number;
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}

/**
 * Represents an additional fee not predefined in the system.
 */
export interface OtherAdditionalFeesType extends AdditionalFeesInfoType {
    name: string;
    displayName: string;
}

/**
 * Represents optional fees associated with a stay.
 */
export interface AdditionalFeesType {
    cleaning?: AdditionalFeesInfoType;
    tax?: AdditionalFeesInfoType;
    lateCheckout?: AdditionalFeesInfoType;
    pets?: AdditionalFeesInfoType;
    bedlinen?: AdditionalFeesInfoType;
    towels?: AdditionalFeesInfoType;
    babyCrib?: AdditionalFeesInfoType;
    babyHighChair?: AdditionalFeesInfoType;
    extraBed?: AdditionalFeesInfoType;
    securityDeposit?: AdditionalFeesInfoType;
    extraGuest?: AdditionalFeesInfoType;
    parking?: AdditionalFeesInfoType;
    earlyCheckin?: AdditionalFeesInfoType;
    lateCheckin?: AdditionalFeesInfoType;
    luggageStorage?: AdditionalFeesInfoType;
    others?: OtherAdditionalFeesType[];
}

/**
 * Represents optional discount info.
 */
export interface DiscountInfoType {
    price?: BasePriceType;
    percent?: number;
    isIncluded?: boolean;
    isOptional?: boolean;
    isPercent?: boolean;
    isPerStay?: boolean;
    isPerNight?: boolean;
    isPerGuest?: boolean;
}

/**
 * Represents a custom discount.
 */
export interface OtherDiscountType extends DiscountInfoType {
    name: string;
    displayName: string;
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
export interface AccommodationPriceType extends BasePriceType {
    additionalFees?: AdditionalFeesType;
    discounts?: DiscountsType;
}

/**
 * Schedule and timing configuration for an accommodation.
 */
export interface ScheduleType {
    checkinTime?: string; // Format: "HH:mm"
    checkoutTime?: string;
    earlyCheckinAccepted: boolean;
    earlyCheckinTime?: string;
    lateCheckinAccepted: boolean;
    lateCheckinTime?: string;
    lateCheckoutAccepted: boolean;
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
    smokingAllowed?: boolean;
    extraInfo?: string[];
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
 * User-submitted review about an accommodation.
 */
export interface AccommodationReviewType extends BaseEntityType {
    userId: string; // UUID of user
    user?: UserType;
    accommodationId: string;
    accommodation?: AccommodationType;
    title: string;
    content: string;
    rating: AccommodationRatingType;
}

/**
 * Frequently asked question specific to an accommodation.
 */
export interface AccommodationFaqType extends BaseEntityType {
    accommodationId: string;
    accommodation?: AccommodationType;
    question: string;
    answer: string;
    category?: string;
}

/**
 * Content to use fro AI to responde question about the accommodation.
 */
export interface AccommodationIaDataType extends BaseEntityType {
    accommodationId: string;
    accommodation?: AccommodationType;
    title: string;
    content: string;
    category?: string;
}

/**
 * Features object related to an accommodation.
 */
export interface AccommodationFeaturesType extends BaseEntityType {
    accommodationId: string;
    accommodation?: AccommodationType;
    description?: string;
    icon?: string;
}

/**
 * Amenity object used to define services/extras offered in an accommodation.
 */
export interface AccommodationAmenitiesType extends BaseEntityType {
    accommodationId: string;
    accommodation?: AccommodationType;
    description?: string;
    icon?: string;
    isBuiltin: boolean;
    isOptional: boolean;
    additionalCost?: BasePriceType;
    additionalCostPercent?: number;
    type?: AmenitiesTypeEnum;
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
    owner?: UserType;
    destinationId: string;
    destination?: DestinationType;
    location: FullLocationType;
    features?: AccommodationFeaturesType[];
    amenities?: AccommodationAmenitiesType[];
    media?: MediaType;
    rating: AccommodationRatingType;
    reviews?: AccommodationReviewType[];
    schedule?: ScheduleType;
    extraInfo?: ExtraInfoType;
    isFeatured?: boolean;
    seo?: SeoType;
    faqs?: AccommodationFaqType[];
    iaData?: AccommodationIaDataType[];
}
