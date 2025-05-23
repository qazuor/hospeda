import type {
    BaseEntityType,
    BaseLocationType,
    MediaType,
    SeoType,
    TagType
} from '../common.types.js';
import type { VisibilityEnum } from '../enums.types.js';
import type { UserType } from './user.types.js';

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
 * Detailed user rating categories for a destination.
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
    userId: string; // UUID of user
    user?: UserType;
    destinationId: string;
    destination?: DestinationType;
    title?: string;
    content?: string;
    rating: DestinationRatingType;
}

/**
 * Represents a tourist destination or city region.
 */
export interface DestinationType extends BaseEntityType {
    slug: string;
    summary: string;
    description: string;
    media: MediaType;
    isFeatured?: boolean;
    visibility: VisibilityEnum;
    seo?: SeoType;
    rating?: DestinationRatingType;
    reviews?: DestinationReviewType[];
    location: BaseLocationType;
    attractions: DestinationAttractionsType[];
    tags?: TagType[];
    reviewsCount?: number;
    averageRating?: number;
    accommodationsCount?: number;
}
