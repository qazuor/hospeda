/**
 * Base entity interface with common properties
 */
export interface BaseEntity {
    /**
     * Unique identifier
     */
    id: string;

    /**
     * System key for the entity
     */
    name: string;

    /**
     * User-facing name for the entity
     */
    displayName: string;

    /**
     * Creation timestamp
     */
    createdAt: Date;

    /**
     * Last update timestamp
     */
    updatedAt: Date;
}

/**
 * Contact information interface
 */
export interface ContactInfo {
    /**
     * Email address
     */
    email: string;

    /**
     * Phone number
     */
    phone?: string;

    /**
     * Address information
     */
    address?: Address;
}

/**
 * Address interface
 */
export interface Address {
    /**
     * Street address
     */
    street: string;

    /**
     * City
     */
    city: string;

    /**
     * State or province
     */
    state: string;

    /**
     * Postal code
     */
    postalCode: string;

    /**
     * Country
     */
    country: string;
}

/**
 * Social network links
 */
export interface SocialNetworks {
    /**
     * Facebook profile URL
     */
    facebook?: string;

    /**
     * Twitter/X profile URL
     */
    twitter?: string;

    /**
     * Instagram profile URL
     */
    instagram?: string;

    /**
     * LinkedIn profile URL
     */
    linkedin?: string;

    /**
     * Website URL
     */
    website?: string;
}

/**
 * Status enum for entities
 */
export enum Status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    PENDING = 'pending',
    DELETED = 'deleted'
}
