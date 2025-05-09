/**
 * Represents an accommodation listing in the system
 */
export interface Accommodation {
    /** Unique identifier for the accommodation */
    id: number;
    /** Title of the accommodation listing */
    title: string;
    /** Description of the accommodation */
    description: string;
    /** Location city name */
    location: string;
    /** Price per night in ARS */
    price: number;
    /** Average rating from 1-5 */
    rating: number;
    /** Number of reviews */
    reviews: number;
    /** URL to the main image */
    image: string;
    /** Additional image URLs */
    images?: string[];
    /** Features/amenities of the accommodation */
    features: string[];
    /** Maximum number of guests */
    maxGuests?: number;
    /** Number of bedrooms */
    bedrooms?: number;
    /** Number of bathrooms */
    bathrooms?: number;
    /** Whether the accommodation is available */
    available?: boolean;
}

/**
 * Parameters for searching accommodations
 */
export interface AccommodationSearchParams {
    /** Location to search for */
    location?: string;
    /** Check-in date as ISO string */
    checkIn?: string;
    /** Check-out date as ISO string */
    checkOut?: string;
    /** Number of guests */
    guests?: number;
    /** Minimum price per night */
    minPrice?: number;
    /** Maximum price per night */
    maxPrice?: number;
    /** Minimum rating (1-5) */
    minRating?: number;
    /** Features to filter by */
    features?: string[];
}
