import { publicUser } from '@/lib/db';
import { AccommodationService } from '@repo/db';
import type { AccommodationType } from '@repo/types';

/**
 * Maps a database accommodation record to our application's Accommodation type
 * @param record - Accommodation record from database
 * @returns Formatted Accommodation object
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function mapAccommodationRecord(record: any): AccommodationType {
    return {
        ...record,
        // Ensure these properties exist even if not in the original record
        id: record.id,
        name: record.name || '',
        displayName: record.displayName || '',
        slug: record.slug || '',
        type: record.type || 'APARTMENT',
        description: record.description || '',
        media: record.media || {
            featuredImage: {
                url: 'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                state: 'ACTIVE'
            }
        },
        price: record.price || { price: 0, currency: 'ARS' },
        features: record.features || [],
        amenities: record.amenities || [],
        rating: record.rating || {
            cleanliness: 4.5,
            hospitality: 4.5,
            services: 4.5,
            accuracy: 4.5,
            communication: 4.5,
            location: 4.5
        },
        reviews: record.reviews || [],
        state: record.state || 'ACTIVE',
        extraInfo: record.extraInfo || {
            capacity: 2,
            minNights: 1,
            bedrooms: 1,
            beds: 1,
            bathrooms: 1,
            smokingAllowed: false
        },
        isFeatured: record.isFeatured || false
    };
}

/**
 * Fetches all accommodations
 * @returns Array of accommodations
 */
export async function getAllAccommodations(): Promise<AccommodationType[]> {
    try {
        const accommodationService = new AccommodationService();
        const records = await accommodationService.list({ limit: 20 }, publicUser);
        const accommodations = [];
        for (const record of records) {
            const features = await accommodationService.listFeatures(record.id, publicUser);
            const amenities = await accommodationService.listAmenities(record.id, publicUser);
            const reviews = await accommodationService.listReviews(record.id, publicUser);
            accommodations.push(
                mapAccommodationRecord({
                    ...record,
                    features,
                    amenities,
                    reviews
                })
            );
        }
        return accommodations;
    } catch (error) {
        console.error('Error fetching accommodations:', error);
        return [];
    }
}

/**
 * Fetches accommodations for a specific destination
 * @param id - Destination ID
 * @returns Array of accommodations for the destination
 */
export async function getAccommodationsByDestination(id: string): Promise<AccommodationType[]> {
    try {
        const accommodationService = new AccommodationService();
        const records = await accommodationService.listByDestination(id, publicUser, { limit: 20 });
        return records.map(mapAccommodationRecord);
    } catch (error) {
        console.error(`Error fetching accommodations for destination ${id}:`, error);
        return [];
    }
}

/**
 * Fetches a specific accommodation by ID
 * @param id - Accommodation ID
 * @returns The accommodation or undefined if not found
 */
export async function getAccommodationById(id: string): Promise<AccommodationType | undefined> {
    try {
        const accommodationService = new AccommodationService();
        const record = await accommodationService.getWithDetails(id, publicUser);
        if (!record) return undefined;
        return mapAccommodationRecord(record);
    } catch (error) {
        console.error(`Error fetching accommodation ${id}:`, error);
        return undefined;
    }
}

/**
 * Fetches featured accommodations
 * @param limit - Maximum number of accommodations to return
 * @returns Array of featured accommodations
 */
export async function getFeaturedAccommodations(limit = 3): Promise<AccommodationType[]> {
    try {
        const accommodationService = new AccommodationService();
        // Try to get featured accommodations first
        const records = await accommodationService.list(
            {
                isFeatured: true,
                limit
            },
            publicUser
        );

        // If we don't have enough featured accommodations, supplement with top rated ones
        if (records.length < limit) {
            const topRated = await accommodationService.getTopRated(
                limit - records.length,
                publicUser
            );
            // Make sure we don't have duplicates
            const existingIds = records.map((rec) => rec.id);
            const uniqueTopRated = topRated.filter((rec) => !existingIds.includes(rec.id));
            records.push(...uniqueTopRated.slice(0, limit - records.length));
        }

        return records.map(mapAccommodationRecord);
    } catch (error) {
        console.error('Error fetching featured accommodations:', error);

        // Get all accommodations and pick random ones as a fallback
        const allAccommodations = await getAllAccommodations();
        if (allAccommodations.length > 0) {
            const indexes = new Set<number>();
            while (indexes.size < limit && indexes.size < allAccommodations.length) {
                const randomIndex = Math.floor(Math.random() * allAccommodations.length);
                indexes.add(randomIndex);
            }
            return Array.from(indexes)
                .map((i) => allAccommodations[i])
                .filter((a): a is AccommodationType => a !== undefined);
        }

        return [];
    }
}
