import type { UserType } from './entities/user.types';
import type { PreferedContactEnum, PriceCurrencyEnum, StateEnum } from './enums.types';

/**
 * Reusable base type for all main entities.
 * Includes audit fields and common metadata.
 */
export interface BaseEntityType {
    /**
     * Unique identifier of the entity.
     */
    id: string;

    /**
     * Internal name or code of the entity.
     */
    name: string;

    /**
     * Human-friendly display name.
     */
    displayName: string;

    /**
     * Current state of the entity (e.g. ACTIVE, DELETED).
     */
    state: StateEnum;

    /**
     * Creation timestamp.
     */
    createdAt: Date;

    /**
     * User who created the entity.
     */
    createdBy: UserType;

    /**
     * Last update timestamp.
     */
    updatedAt: Date;

    /**
     * User who last updated the entity.
     */
    updatedBy: UserType;

    /**
     * Deletion timestamp (soft delete).
     */
    deletedAt: Date;

    /**
     * User who deleted the entity.
     */
    deletedBy: UserType;
}

/**
 * User contact details across multiple channels.
 */
export interface ContactInfoType {
    personalEmail: string;
    workEmail?: string;
    homePhone?: string;
    workPhone?: string;
    mobilePhone: string;

    /**
     * Preferred email address to be used by the system.
     */
    preferredEmail: PreferedContactEnum;

    /**
     * Preferred phone contact.
     */
    preferredPhone: PreferedContactEnum;
}

/**
 * A full location reference, including address and coordinates.
 */
export interface LocationType {
    street: string;
    neighborhood?: string;
    city: string;
    state: string;
    zipCode?: string;
    country: string;
    placeName?: string;

    /**
     * Geolocation coordinates (latitude/longitude).
     */
    coordinates: CoordinatesType;
}

/**
 * Geographic coordinates.
 */
export interface CoordinatesType {
    lat: string;
    long: string;
}

/**
 * User or business social network links.
 */
export interface SocialNetworkType {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedIn?: string;
    website?: string;
}

/**
 * Common monetary value type.
 */
export interface BasePriceType {
    /**
     * Numeric value of the price.
     */
    price?: number;

    /**
     * Currency code (e.g. ARS, USD).
     */
    currency?: PriceCurrencyEnum;
}

/**
 * Image object used in galleries, profiles, etc.
 */
export interface ImageType {
    url: string;
    caption?: string;
    description?: string;
    tags?: string[];

    /**
     * State of the image in the system (e.g. approved or deleted).
     */
    state: StateEnum;
}

/**
 * Video object with metadata and tags.
 */
export interface VideoType {
    url: string;
    caption?: string;
    description?: string;
    tags?: string[];
    state: StateEnum;
}

/**
 * SEO metadata for pages, posts or listings.
 */
export interface SeoType {
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
}

/**
 * Internal admin notes and tags used for moderation and search.
 */
export interface AdminInfoType {
    notes: string;
    favorite: boolean;
    tags: string[];
}

/**
 * Media content attached to the accommodation (images, videos).
 */
export interface MediaType {
    featuredImage: ImageType;
    gallery?: ImageType[];
    videos?: VideoType[];
}
