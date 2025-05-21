import { publicUser } from '@/lib/db';
import { DestinationService } from '@repo/db';
import type { DestinationType } from '@repo/types';

/**
 * Maps a database destination record to our application's Destination type
 * @param record - Destination record from database
 * @returns Formatted Destination object
 */

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function mapDestinationRecord(record: any): DestinationType {
    return {
        ...record,
        // Ensure these properties exist even if not in the original record
        id: record.id,
        name: record.name || '',
        displayName: record.displayName || '',
        slug: record.slug || '',
        summary: record.summary || '',
        description: record.description || '',
        media: record.media || {
            featuredImage: {
                url: 'https://images.pexels.com/photos/208701/pexels-photo-208701.jpeg',
                state: 'ACTIVE'
            }
        },
        visibility: record.visibility || 'PUBLIC',
        isFeatured: record.isFeatured || false,
        location: record.location || {
            state: 'Entre Ríos',
            country: 'Argentina',
            zipCode: '',
            coordinates: {
                lat: '-32.4825',
                long: '-58.2372'
            }
        },
        attractions: record.attractions || [],
        state: record.state || 'ACTIVE'
    };
}

/**
 * Fetches all destinations
 * @returns Array of destinations
 */
export async function getDestinations(): Promise<DestinationType[]> {
    try {
        const destinationService = new DestinationService();
        const records = await destinationService.list(
            {
                limit: 20,
                visibility: 'PUBLIC'
            },
            publicUser
        );
        return records.map(mapDestinationRecord);
    } catch (error) {
        console.error('Error fetching destinations:', error);
        return [];
    }
}

/**
 * Fetches a specific destination by ID
 * @param id - Destination ID
 * @returns The destination or undefined if not found
 */
export async function getDestinationById(id: string): Promise<DestinationType | undefined> {
    try {
        const destinationService = new DestinationService();
        const record = await destinationService.getById(id, publicUser);
        if (!record) return undefined;

        // Get additional data
        const attractions = await destinationService.listAttractions(id, publicUser, { limit: 10 });

        // Enhance the record with attractions
        const enhancedRecord = {
            ...record,
            attractions
        };

        return mapDestinationRecord(enhancedRecord);
    } catch (error) {
        console.error(`Error fetching destination ${id}:`, error);
        return undefined;
    }
}

/**
 * Fetches featured destinations
 * @param limit - Maximum number of destinations to return
 * @returns Array of featured destinations
 */
export async function getFeaturedDestinations(limit = 4): Promise<DestinationType[]> {
    try {
        const destinationService = new DestinationService();
        const records = await destinationService.getFeatured(limit, publicUser);
        return records.map(mapDestinationRecord);
    } catch (error) {
        console.error('Error fetching featured destinations:', error);

        // Get all destinations and pick random ones as a fallback
        const allDestinations = await getDestinations();
        if (allDestinations.length > 0) {
            const indexes = new Set<number>();
            while (indexes.size < limit && indexes.size < allDestinations.length) {
                const randomIndex = Math.floor(Math.random() * allDestinations.length);
                indexes.add(randomIndex);
            }
            return Array.from(indexes)
                .map((i) => allDestinations[i])
                .filter((d): d is DestinationType => d !== undefined);
        }

        return [];
    }
}

/**
 * Fetches top destinations
 * @param limit - Maximum number of destinations to return
 * @returns Array of top destinations
 */
export async function getTopDestinations(limit = 4): Promise<DestinationType[]> {
    try {
        const destinationService = new DestinationService();
        const records = await destinationService.listTop(limit, publicUser);
        return records.map(mapDestinationRecord);
    } catch (error) {
        console.error('Error fetching top destinations:', error);
        return [];
    }
}
