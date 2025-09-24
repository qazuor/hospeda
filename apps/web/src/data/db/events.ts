import { ensureDatabase } from '@/server/db';
import type { Event } from '@repo/schemas';
import { EventService } from '@repo/service-core';

import { getCurrentUser } from '@/data/user';

/**
 * Returns paginated events data.
 */
type LocalsAuth = () => { userId?: string | null } | undefined | null;

export const getEvents = async ({
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
    events: Event[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const eventService = new EventService({});

    const result = await eventService.search(actor, {
        page,
        pageSize,
        filters
    });

    const events = result.data?.items ?? [];
    const total = result.data?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
        events: events as Event[],
        total,
        page,
        pageSize,
        totalPages
    };
};

/**
 * Returns a single event by slug.
 */
export const getEventBySlug = async ({
    locals,
    slug
}: {
    locals?: { auth?: LocalsAuth };
    slug: string;
}): Promise<{
    event: Event | null;
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const eventService = new EventService({});

    const result = await eventService.getBySlug(actor, slug);

    return {
        event: (result.data as Event) ?? null
    };
};

/**
 * Returns upcoming events.
 */
export const getUpcomingEvents = async ({
    locals,
    limit = 6
}: {
    locals?: { auth?: LocalsAuth };
    limit?: number;
} = {}): Promise<{
    events: Event[];
}> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });

    const eventService = new EventService({});

    const result = await eventService.getUpcoming(actor, {
        page: 1,
        pageSize: limit,
        daysAhead: 30 // Get events for the next 30 days
    });

    return {
        events: (result.data?.items as Event[]) ?? []
    };
};

/**
 * Fetch all events for static path generation.
 * Used by getStaticPaths to prerender all event pages.
 *
 * @param locals - Optional locals for authentication context
 * @returns Promise with all events
 */
export const getAllEvents = async ({
    locals
}: {
    locals?: { auth?: LocalsAuth };
} = {}): Promise<Event[]> => {
    ensureDatabase();
    const { actor } = await getCurrentUser({ locals });
    const eventService = new EventService({});

    try {
        // Get all events with a large page size for static generation
        const { data } = await eventService.list(actor, {
            page: 1,
            pageSize: 1000 // Large enough to get all events
        });
        return (data?.items as Event[]) ?? [];
    } catch (error) {
        console.error('Error fetching all events:', error);
        return [];
    }
};
