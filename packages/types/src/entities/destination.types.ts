import type {
    AdminInfoType,
    BaseEntityType,
    CoordinatesType,
    MediaType,
    SeoType
} from '../common.types';
import type { VisibilityEnum } from '../enums.types';

/**
 * Location data specific to a destination.
 */
export interface DestinationLocationType {
    department: string;
    state: string;
    zipCode?: string;
    country: string;
    coordinates: CoordinatesType;
}

/**
 * Individual point of interest or attraction inside a destination.
 */
export interface DestinationAttractionsType extends BaseEntityType {
    name: string;
    slug: string;
    description: string;
    icon: string; // e.g., emoji, URL, or icon name
}

/**
 * Detailed user rating categories for an destinnation.
 */
export interface DestinationRatingType {
    landscape: number; // Natural beauty and landscapes
    attractions: number; // Quality and variety of tourist attractions
    accessibility: number; // Ease of access and transportation options
    safety: number; // Perceived safety of the area
    cleanliness: number; // General cleanliness of public spaces
    hospitality: number; // Friendliness and warmth of locals
    culturalOffer: number; // Cultural events, museums, and local traditions
    gastronomy: number; // Local cuisine and food options
    affordability: number; // Value for money (e.g. food, attractions)
    nightlife: number; // Entertainment and night-time activities
    infrastructure: number; // Roads, signage, public services condition
    environmentalCare: number; // Environmental awareness and sustainability
    wifiAvailability: number; // Internet access quality and availability
    shopping: number; // Variety and quality of local shops
    beaches: number; // Quality and cleanliness of beaches
    greenSpaces: number; // Availability and condition of parks and green areas
    localEvents: number; // Local events such as festivals, fairs, parades
    weatherSatisfaction: number; // Weather experience during the visit
}

/**
 * User-submitted review about an destination.
 */
export interface DestinationReviewType {
    author: string; // UUID of user
    title: string;
    content: string;
    rating: DestinationRatingType;
}

/**
 * Represents a tourist destination or city region.
 */
export interface DestinationType extends BaseEntityType {
    name: string;
    longName: string;
    slug: string;
    summary: string;
    description: string;
    media: MediaType;
    tags?: string[];
    isFeatured?: boolean;
    visibility: VisibilityEnum;
    seo?: SeoType;
    adminInfo?: AdminInfoType;
    rating?: DestinationRatingType;
    reviews?: DestinationReviewType[];
    location: DestinationLocationType;
    attractions: DestinationAttractionsType[];
}
