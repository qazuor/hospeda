import type { BaseEntity, ContactInfo, SocialNetworks, Status } from '../common';

/**
 * Accommodation type enum
 */
export enum AccommodationType {
    HOTEL = 'hotel',
    APARTMENT = 'apartment',
    STUDIO = 'studio',
    COUNTRY_HOUSE = 'countryHouse'
}

/**
 * Price information interface
 */
export interface Price {
    /**
     * Base price per night
     */
    basePrice: number;

    /**
     * Currency code
     */
    currency: string;

    /**
     * Additional fees
     */
    additionalFees?: {
        /**
         * Cleaning fee
         */
        cleaning?: number;

        /**
         * Service fee
         */
        service?: number;

        /**
         * Tax percentage
         */
        taxPercentage?: number;
    };

    /**
     * Discounts
     */
    discounts?: {
        /**
         * Weekly discount percentage
         */
        weekly?: number;

        /**
         * Monthly discount percentage
         */
        monthly?: number;

        /**
         * Last minute discount percentage
         */
        lastMinute?: number;
    };
}

/**
 * Availability interface
 */
export interface Availability {
    /**
     * Available dates
     */
    availableDates: {
        /**
         * Start date
         */
        from: Date;

        /**
         * End date
         */
        to: Date;
    }[];

    /**
     * Minimum stay in nights
     */
    minimumStay?: number;

    /**
     * Maximum stay in nights
     */
    maximumStay?: number;

    /**
     * Check-in time
     */
    checkInTime?: string;

    /**
     * Check-out time
     */
    checkOutTime?: string;
}

/**
 * Accommodation interface
 */
export interface Accommodation extends BaseEntity {
    /**
     * Accommodation type
     */
    type: AccommodationType;

    /**
     * Accommodation status
     */
    status: Status;

    /**
     * Accommodation description
     */
    description: string;

    /**
     * Contact information
     */
    contactInfo: ContactInfo;

    /**
     * Social network links
     */
    socialNetworks?: SocialNetworks;

    /**
     * Price information
     */
    price: Price;

    /**
     * Availability information
     */
    availability: Availability;

    /**
     * Owner user ID
     */
    ownerId: string;

    /**
     * Location coordinates
     */
    location: {
        latitude: number;
        longitude: number;
    };

    /**
     * Amenities list
     */
    amenities: string[];

    /**
     * Images URLs
     */
    images: string[];
}
