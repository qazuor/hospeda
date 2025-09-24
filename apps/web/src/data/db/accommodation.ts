import { getCurrentUser } from '@/data/user';
import { ensureDatabase } from '@/server/db';
import type { Accommodation } from '@repo/schemas';
import { AccommodationService, DestinationService } from '@repo/service-core';

/**
 * Returns paginated accommodations data.
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

export const getAccommodations = async ({
    locals,
    page = 1,
    pageSize = 12,
    filters = {}
}: {
    locals?: { auth?: LocalsAuth };
    page?: number;
    pageSize?: number;
    filters?: Record<string, unknown>;
} = {}): Promise<{
    accommodations: Accommodation[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const accommodationService = new AccommodationService({});

    try {
        const { data, error } = await accommodationService.list(actor, {
            page,
            pageSize,
            ...filters
        });

        if (error || !data) {
            return {
                accommodations: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0
            };
        }

        const totalPages = Math.ceil(data.total / pageSize);

        return {
            accommodations: data.items as Accommodation[],
            total: data.total,
            page,
            pageSize,
            totalPages
        };
    } catch (error) {
        console.error('Error fetching accommodations:', error);
        return {
            accommodations: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
        };
    }
};

/**
 * Fetch accommodations filtered by destination. If no destinationId is provided, returns a paginated list.
 * Uses `DestinationService.getAccommodations` when `destinationId` is present; otherwise falls back to
 * `AccommodationService.list`.
 *
 * @param destinationId - Optional destination id to filter accommodations
 * @returns Promise with the list of accommodations
 */

type GetAccommodationsByDestinationInput = {
    destinationId?: string;
    locals?: { auth?: LocalsAuth };
};

export const getAccommodationsByDestination = async ({
    destinationId,
    locals
}: GetAccommodationsByDestinationInput = {}): Promise<Accommodation[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    if (destinationId) {
        const destinationService = new DestinationService({});
        const { data, error } = await destinationService.getAccommodations(actor, {
            destinationId,
            page: 1,
            pageSize: 100 // Get a reasonable number for destination page
        });
        if (error || !data) return [];
        return data.accommodations as Accommodation[];
    }
    const accommodationService = new AccommodationService({});
    const { data } = await accommodationService.list(actor, { page: 1, pageSize: 10 });
    return (data?.items as Accommodation[]) ?? [];
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
}: GetAccommodationBySlugInput): Promise<Accommodation | null> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const accommodationService = new AccommodationService({});
    const { data } = await accommodationService.getBySlug(actor, slug);
    return (data as Accommodation) ?? null;
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
}: GetAllAccommodationsInput = {}): Promise<Accommodation[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const accommodationService = new AccommodationService({});

    try {
        // Get all accommodations with a large page size for static generation
        const { data } = await accommodationService.list(actor, {
            page: 1,
            pageSize: 1000 // Large enough to get all accommodations
        });
        return (data?.items as Accommodation[]) ?? [];
    } catch (error) {
        console.error('Error fetching all accommodations:', error);
        return [];
    }
};
