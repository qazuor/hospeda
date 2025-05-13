import type { UserType } from './entities/user.types';
import type { PreferedContactEnum, PriceCurrencyEnum, StateEnum } from './enums.types';

/**
 * Internal admin notes and tags used for moderation and search.
 */
export interface AdminInfoType {
    notes?: string;
    favorite: boolean;
}

/**
 * Reusable base type for all main entities.
 * Includes audit fields and common metadata.
 */
export interface BaseEntityType {
    id: string;
    name: string;
    displayName: string;
    state: StateEnum;
    adminInfo?: AdminInfoType;
    createdAt: Date;
    createdById: string;
    createdBy?: UserType | undefined;
    updatedAt: Date;
    updatedById: string;
    updatedBy?: UserType | undefined;
    deletedAt?: Date | undefined;
    deletedById?: string | undefined;
    deletedBy?: UserType | undefined;
}

/**
 * Tags used for categorizing and filtering content.
 */
export interface TagType extends BaseEntityType {
    ownerId: string;
    owner?: UserType;
    notes?: string;
    color: string;
    icon?: string;
}

/**
 * User contact details across multiple channels.
 */
export interface ContactInfoType {
    personalEmail?: string;
    workEmail?: string;
    homePhone?: string;
    workPhone?: string;
    mobilePhone: string;
    website?: string;
    preferredEmail: PreferedContactEnum;
    preferredPhone: PreferedContactEnum;
}

/**
 * Geographic coordinates.
 */
export interface CoordinatesType {
    lat: string;
    long: string;
}

/**
 * Base generic Location data
 */
export interface BaseLocationType {
    state: string;
    zipCode: string;
    country: string;
    coordinates?: CoordinatesType;
}

/**
 * Full generic Location data
 */
export interface FullLocationType extends BaseLocationType {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    deparment?: string;
}

/**
 * User or business social network links.
 */
export interface SocialNetworkType {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedIn?: string;
    tiktok?: string;
}

/**
 * Common monetary value type.
 */
export interface BasePriceType {
    price?: number;
    currency?: PriceCurrencyEnum;
}

/**
 * Image object used in galleries, profiles, etc.
 */
export interface ImageType {
    url: string;
    caption?: string;
    description?: string;
    tags?: TagType[];
    state: StateEnum;
}

/**
 * Video object with metadata and tags.
 */
export interface VideoType {
    url: string;
    caption?: string;
    description?: string;
    tags?: TagType[];
    state: StateEnum;
}

/**
 * Media content attached to the accommodation (images, videos).
 */
export interface MediaType {
    featuredImage: ImageType;
    gallery?: ImageType[];
    videos?: VideoType[];
}

/**
 * SEO metadata for pages, posts or listings.
 */
export interface SeoType {
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
}
