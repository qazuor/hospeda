import { ensureDatabase } from '@/server/db';
import type { Destination } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';

import { getCurrentUser } from '@/data/user';

/**
 * Returns paginated destinations data.
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

export const getDestinations = async ({
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
    destinations: Destination[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const destinationService = new DestinationService({});

    const result = await destinationService.search(actor, {
        page: 1,
        pageSize: pageSize,
        ...filters
    });

    const destinations = result.data?.items ?? [];
    const total = result.data?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
        destinations: destinations as Destination[],
        total,
        page,
        pageSize,
        totalPages
    };
};

/**
 * Returns a single destination by slug.
 */
export const getDestinationBySlug = async ({
    locals,
    slug
}: {
    locals?: { auth?: LocalsAuth };
    slug: string;
}): Promise<{
    destination: Destination | null;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const destinationService = new DestinationService({});

    const result = await destinationService.getBySlug(actor, slug);

    return {
        destination: (result.data as Destination) ?? null
    };
};

/**
 * Returns featured destinations for homepage.
 */
export const getFeaturedDestinations = async ({
    locals,
    limit = 8
}: {
    locals?: { auth?: LocalsAuth };
    limit?: number;
} = {}): Promise<{
    destinations: Destination[];
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const destinationService = new DestinationService({});

    const result = await destinationService.search(actor, {
        page: 1,
        pageSize: limit,
        isFeatured: true
    });

    return {
        destinations: (result.data?.items as Destination[]) ?? []
    };
};

/**
 * Fetch all destinations for static path generation.
 * Used by getStaticPaths to prerender all destination pages.
 *
 * @param locals - Optional locals for authentication context
 * @returns Promise with all destinations
 */
export const getAllDestinations = async ({
    locals
}: {
    locals?: { auth?: LocalsAuth };
} = {}): Promise<Destination[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const destinationService = new DestinationService({});

    try {
        // Get all destinations with a large page size for static generation
        const { data } = await destinationService.list(actor, {
            page: 1,
            pageSize: 1000 // Large enough to get all destinations
        });
        return (data?.items as Destination[]) ?? [];
    } catch (error) {
        console.error('Error fetching all destinations:', error);
        return [];
    }
};
