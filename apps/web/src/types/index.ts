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
