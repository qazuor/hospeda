import type { UserType } from './entities/user.types';
import type { PreferedContactEnum, PriceCurrencyEnum, StateEnum } from './enums.types';

/**
 * Reusable base type for all main entities.
 * Includes audit fields and common metadata.
 */
export interface BaseEntityType {
    id: string;
    name: string;
    displayName: string;
    state: StateEnum;
    tags?: TagType[];
    adminInfo?: AdminInfoType;
    createdAt: Date;
    createdById: string;
    createdBy?: UserType;
    updatedAt: Date;
    updatedById: string;
    updatedBy?: UserType;
    deletedAt?: Date;
    deletedById?: string;
    deletedBy?: UserType;
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
    website?: string;
    preferredEmail: PreferedContactEnum;
    preferredPhone: PreferedContactEnum;
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

/**
 * Internal admin notes and tags used for moderation and search.
 */
export interface AdminInfoType {
    notes: string;
    favorite: boolean;
}

/**
 * Tags used for categorizing and filtering content.
 */
export interface TagType extends BaseEntityType {
    owerId: string;
    owner?: UserType;
    notes: string;
    variants: string[];
    color: string;
    icon: string;
}
