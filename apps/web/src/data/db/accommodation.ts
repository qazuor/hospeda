import { getCurrentUser } from '@/data/user';
import { ensureDatabase } from '@/server/db';
import { AccommodationService, DestinationService } from '@repo/service-core';
import type { AccommodationType } from '@repo/types';

/**
 * Fetch accommodations filtered by destination. If no destinationId is provided, returns a paginated list.
 * Uses `DestinationService.getAccommodations` when `destinationId` is present; otherwise falls back to
 * `AccommodationService.list`.
 *
 * @param destinationId - Optional destination id to filter accommodations
 * @returns Promise with the list of accommodations
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

type GetAccommodationsByDestinationInput = {
    destinationId?: string;
    locals?: { auth?: LocalsAuth };
};

export const getAccommodationsByDestination = async ({
    destinationId,
    locals
}: GetAccommodationsByDestinationInput = {}): Promise<AccommodationType[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    if (destinationId) {
        const destinationService = new DestinationService({});
        const { data, error } = await destinationService.getAccommodations(actor, {
            destinationId
        });
        if (error || !data) return [];
        return data.accommodations;
    }
    const accommodationService = new AccommodationService({});
    const { data } = await accommodationService.list(actor, { page: 1, pageSize: 10 });
    return data?.items ?? [];
};

/**
 * Fetch one accommodation by slug.
 * Returns null if not found or if visibility forbids access for the current actor.
 *
 * @param slug - The accommodation slug
 * @returns Promise with the accommodation or null
 */
type GetAccommodationBySlugInput = { slug: string; locals?: { auth?: LocalsAuth } };

export const getAccommodationBySlug = async ({
    slug,
    locals
}: GetAccommodationBySlugInput): Promise<AccommodationType | null> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const accommodationService = new AccommodationService({});
    const { data } = await accommodationService.getBySlug(actor, slug);
    return data ?? null;
};

/**
 * Fetch all accommodations for static path generation.
 * Used by getStaticPaths to prerender all accommodation pages.
 *
 * @param locals - Optional locals for authentication context
 * @returns Promise with all accommodations
 */
type GetAllAccommodationsInput = {
    locals?: { auth?: LocalsAuth };
};

export const getAllAccommodations = async ({
    locals
}: GetAllAccommodationsInput = {}): Promise<AccommodationType[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const accommodationService = new AccommodationService({});

    try {
        // Get all accommodations with a large page size for static generation
        const { data } = await accommodationService.list(actor, {
            page: 1,
            pageSize: 1000 // Large enough to get all accommodations
        });
        return data?.items ?? [];
    } catch (error) {
        console.error('Error fetching all accommodations:', error);
        return [];
    }
};
