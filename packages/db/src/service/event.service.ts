import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    EventLocationModel,
    type EventLocationRecord,
    EventModel,
    EventOrganizerModel,
    type EventOrganizerRecord,
    type EventRecord
} from '../model/index.js';
import type {
    InsertEvent,
    PaginationParams,
    SelectEventFilter,
    UpdateEventData,
    UpdateEventLocationData,
    UpdateEventOrganizerData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing event operations.
 * Handles business logic, authorization, and interacts with the EventModel and related models.
 */
export class EventService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the author of the resource or an admin.
     * @param authorId - The ID of the resource author.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the author nor an admin.
     */
    private static assertAuthorOrAdmin(authorId: string, actor: UserType): void {
        if (actor.id !== authorId && !EventService.isAdmin(actor)) {
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredAuthorId: authorId
                },
                'Forbidden access attempt'
            );
            throw new Error('Forbidden');
        }
    }

    /**
     * Asserts that the actor is an admin.
     * @param actor - The user performing the action.
     * @throws Error if the actor is not an admin.
     */
    private static assertAdmin(actor: UserType): void {
        if (!EventService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new event.
     * @param data - The data for the new event.
     * @param actor - The user creating the event.
     * @returns The created event record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertEvent, actor: UserType): Promise<EventRecord> {
        dbLogger.info({ actor: actor.id }, 'creating event');

        try {
            const dataWithAudit: InsertEvent = {
                ...data,
                authorId: actor.id, // Set the current user as the author
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdEvent = await EventModel.createEvent(dataWithAudit);
            dbLogger.info({ eventId: createdEvent.id }, 'event created successfully');
            return createdEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to create event');
            throw error;
        }
    }

    /**
     * Get a single event by ID.
     * @param id - The ID of the event to fetch.
     * @param actor - The user performing the action.
     * @returns The event record.
     * @throws Error if event is not found.
     */
    async getById(id: string, actor: UserType): Promise<EventRecord> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'fetching event by id');

        try {
            const event = await EventModel.getEventById(id);
            const existingEvent = assertExists(event, `Event ${id} not found`);

            dbLogger.info({ eventId: existingEvent.id }, 'event fetched successfully');
            return existingEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch event by id');
            throw error;
        }
    }

    /**
     * Get a single event by slug.
     * @param slug - The slug of the event to fetch.
     * @param actor - The user performing the action.
     * @returns The event record.
     * @throws Error if event is not found.
     */
    async getBySlug(slug: string, actor: UserType): Promise<EventRecord> {
        dbLogger.info({ slug, actor: actor.id }, 'fetching event by slug');

        try {
            // Use the listEvents method with a filter for the slug
            const events = await EventModel.listEvents({
                query: slug, // This will search in name, displayName, summary, description, and slug
                limit: 1,
                includeDeleted: false
            });

            // Find the exact match for slug
            const event = events.find((e) => e.slug === slug);
            const existingEvent = assertExists(event, `Event with slug '${slug}' not found`);

            dbLogger.info(
                {
                    eventId: existingEvent.id,
                    slug
                },
                'event fetched by slug successfully'
            );
            return existingEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch event by slug');
            throw error;
        }
    }

    /**
     * List events with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of event records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectEventFilter, actor: UserType): Promise<EventRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing events');

        try {
            const events = await EventModel.listEvents(filter);
            dbLogger.info({ count: events.length, filter }, 'events listed successfully');
            return events;
        } catch (error) {
            dbLogger.error(error, 'failed to list events');
            throw error;
        }
    }

    /**
     * Update fields on an existing event.
     * @param id - The ID of the event to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated event record.
     * @throws Error if event is not found, actor is not authorized, or update fails.
     */
    async update(id: string, changes: UpdateEventData, actor: UserType): Promise<EventRecord> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'updating event');

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateEventData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedEvent = await EventModel.updateEvent(existingEvent.id, dataWithAudit);
            dbLogger.info({ eventId: updatedEvent.id }, 'event updated successfully');
            return updatedEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to update event');
            throw error;
        }
    }

    /**
     * Soft-delete an event by setting the deletedAt timestamp.
     * @param id - The ID of the event to delete.
     * @param actor - The user performing the action.
     * @throws Error if event is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'soft deleting event');

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            await EventModel.softDeleteEvent(id);
            dbLogger.info({ eventId: id }, 'event soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete event');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted event by clearing the deletedAt timestamp.
     * @param id - The ID of the event to restore.
     * @param actor - The user performing the action.
     * @throws Error if event is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'restoring event');

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            await EventModel.restoreEvent(id);
            dbLogger.info({ eventId: id }, 'event restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore event');
            throw error;
        }
    }

    /**
     * Permanently delete an event record from the database.
     * @param id - The ID of the event to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if event is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'hard deleting event');

        // Only admins can hard delete
        EventService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventModel.hardDeleteEvent(id);
            dbLogger.info({ eventId: id }, 'event hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete event');
            throw error;
        }
    }

    /**
     * Get events by category.
     * @param category - The category to filter by.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records with the specified category.
     * @throws Error if listing fails.
     */
    async getByCategory(
        category: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EventRecord[]> {
        dbLogger.info({ category, actor: actor.id, filter }, 'fetching events by category');

        try {
            const eventFilter: SelectEventFilter = {
                category,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            dbLogger.info(
                { category, count: events.length },
                'events fetched by category successfully'
            );
            return events;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch events by category');
            throw error;
        }
    }

    /**
     * Update an event organizer.
     * @param organizerId - The ID of the organizer to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated organizer record.
     * @throws Error if organizer is not found, actor is not authorized, or update fails.
     */
    async updateOrganizer(
        organizerId: string,
        changes: UpdateEventOrganizerData,
        actor: UserType
    ): Promise<EventOrganizerRecord> {
        dbLogger.info({ organizerId, actor: actor.id }, 'updating event organizer');

        // Only admins can update organizers
        EventService.assertAdmin(actor);

        try {
            // Check if organizer exists
            const organizer = await EventOrganizerModel.getOrganizerById(organizerId);
            if (!organizer) {
                throw new Error(`Organizer ${organizerId} not found`);
            }

            const dataToUpdate = sanitizePartialUpdate(changes);
            const dataWithAudit: UpdateEventOrganizerData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            const updatedOrganizer = await EventOrganizerModel.updateOrganizer(
                organizerId,
                dataWithAudit
            );
            dbLogger.info(
                { organizerId: updatedOrganizer.id },
                'event organizer updated successfully'
            );
            return updatedOrganizer;
        } catch (error) {
            dbLogger.error(error, 'failed to update event organizer');
            throw error;
        }
    }

    /**
     * Update an event location.
     * @param locationId - The ID of the location to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated location record.
     * @throws Error if location is not found, actor is not authorized, or update fails.
     */
    async updateLocation(
        locationId: string,
        changes: UpdateEventLocationData,
        actor: UserType
    ): Promise<EventLocationRecord> {
        dbLogger.info({ locationId, actor: actor.id }, 'updating event location');

        // Only admins can update locations
        EventService.assertAdmin(actor);

        try {
            // Check if location exists
            const location = await EventLocationModel.getLocationById(locationId);
            if (!location) {
                throw new Error(`Location ${locationId} not found`);
            }

            const dataToUpdate = sanitizePartialUpdate(changes);
            const dataWithAudit: UpdateEventLocationData = {
                ...dataToUpdate,
                updatedById: actor.id
            };

            const updatedLocation = await EventLocationModel.updateLocation(
                locationId,
                dataWithAudit
            );
            dbLogger.info(
                { locationId: updatedLocation.id },
                'event location updated successfully'
            );
            return updatedLocation;
        } catch (error) {
            dbLogger.error(error, 'failed to update event location');
            throw error;
        }
    }

    /**
     * List events by location.
     * @param locationId - The ID of the location.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records at the specified location.
     * @throws Error if location is not found or listing fails.
     */
    async listByLocation(
        locationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EventRecord[]> {
        dbLogger.info({ locationId, actor: actor.id, filter }, 'listing events by location');

        try {
            // Check if location exists
            const location = await EventLocationModel.getLocationById(locationId);
            if (!location) {
                throw new Error(`Location ${locationId} not found`);
            }

            const eventFilter: SelectEventFilter = {
                locationId,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            dbLogger.info(
                { locationId, count: events.length },
                'events listed by location successfully'
            );
            return events;
        } catch (error) {
            dbLogger.error(error, 'failed to list events by location');
            throw error;
        }
    }

    /**
     * List events by organizer.
     * @param organizerId - The ID of the organizer.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records by the specified organizer.
     * @throws Error if organizer is not found or listing fails.
     */
    async listByOrganizer(
        organizerId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EventRecord[]> {
        dbLogger.info({ organizerId, actor: actor.id, filter }, 'listing events by organizer');

        try {
            // Check if organizer exists
            const organizer = await EventOrganizerModel.getOrganizerById(organizerId);
            if (!organizer) {
                throw new Error(`Organizer ${organizerId} not found`);
            }

            const eventFilter: SelectEventFilter = {
                organizerId,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            dbLogger.info(
                { organizerId, count: events.length },
                'events listed by organizer successfully'
            );
            return events;
        } catch (error) {
            dbLogger.error(error, 'failed to list events by organizer');
            throw error;
        }
    }

    /**
     * List upcoming events (events with start date in the future).
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of upcoming event records.
     * @throws Error if listing fails.
     */
    async listUpcoming(actor: UserType, filter: PaginationParams = {}): Promise<EventRecord[]> {
        dbLogger.info({ actor: actor.id, filter }, 'listing upcoming events');

        try {
            // Get all active events
            const allEvents = await EventModel.listEvents({
                ...filter,
                includeDeleted: false
            });

            // Filter for upcoming events (start date in the future)
            const now = new Date();
            const upcomingEvents = allEvents.filter((event) => {
                if (!event.date || !event.date.start) {
                    return false;
                }

                const startDate = new Date(event.date.start);
                return startDate > now;
            });

            // Sort by start date (ascending)
            upcomingEvents.sort((a, b) => {
                const dateA = new Date(a.date?.start || 0);
                const dateB = new Date(b.date?.start || 0);
                return dateA.getTime() - dateB.getTime();
            });

            dbLogger.info({ count: upcomingEvents.length }, 'upcoming events listed successfully');
            return upcomingEvents;
        } catch (error) {
            dbLogger.error(error, 'failed to list upcoming events');
            throw error;
        }
    }

    /**
     * List past events (events with end date in the past).
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of past event records.
     * @throws Error if listing fails.
     */
    async listPast(actor: UserType, filter: PaginationParams = {}): Promise<EventRecord[]> {
        dbLogger.info({ actor: actor.id, filter }, 'listing past events');

        try {
            // Get all active events
            const allEvents = await EventModel.listEvents({
                ...filter,
                includeDeleted: false
            });

            // Filter for past events (end date in the past)
            const now = new Date();
            const pastEvents = allEvents.filter((event) => {
                if (!event.date) {
                    return false;
                }

                // If there's an end date, use it; otherwise use start date
                const endDate = event.date.end
                    ? new Date(event.date.end)
                    : new Date(event.date.start || 0);
                return endDate < now;
            });

            // Sort by start date (descending - most recent first)
            pastEvents.sort((a, b) => {
                const dateA = new Date(a.date?.start || 0);
                const dateB = new Date(b.date?.start || 0);
                return dateB.getTime() - dateA.getTime();
            });

            dbLogger.info({ count: pastEvents.length }, 'past events listed successfully');
            return pastEvents;
        } catch (error) {
            dbLogger.error(error, 'failed to list past events');
            throw error;
        }
    }

    /**
     * List events for the current month.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records for the current month.
     * @throws Error if listing fails.
     */
    async listThisMonth(actor: UserType, filter: PaginationParams = {}): Promise<EventRecord[]> {
        dbLogger.info({ actor: actor.id, filter }, 'listing events for this month');

        try {
            // Get all active events
            const allEvents = await EventModel.listEvents({
                ...filter,
                includeDeleted: false
            });

            // Get current month boundaries
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0,
                23,
                59,
                59,
                999
            );

            // Filter for events in the current month
            const thisMonthEvents = allEvents.filter((event) => {
                if (!event.date || !event.date.start) {
                    return false;
                }

                const startDate = new Date(event.date.start);

                // If there's an end date, check if any part of the event falls within the month
                if (event.date.end) {
                    const endDate = new Date(event.date.end);
                    return (
                        (startDate >= firstDayOfMonth && startDate <= lastDayOfMonth) || // Start date in this month
                        (endDate >= firstDayOfMonth && endDate <= lastDayOfMonth) || // End date in this month
                        (startDate <= firstDayOfMonth && endDate >= lastDayOfMonth) // Event spans the entire month
                    );
                }

                // For single-day events, just check the start date
                return startDate >= firstDayOfMonth && startDate <= lastDayOfMonth;
            });

            // Sort by start date (ascending)
            thisMonthEvents.sort((a, b) => {
                const dateA = new Date(a.date?.start || 0);
                const dateB = new Date(b.date?.start || 0);
                return dateA.getTime() - dateB.getTime();
            });

            dbLogger.info(
                { count: thisMonthEvents.length },
                'events for this month listed successfully'
            );
            return thisMonthEvents;
        } catch (error) {
            dbLogger.error(error, 'failed to list events for this month');
            throw error;
        }
    }

    /**
     * List events for the current week.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records for the current week.
     * @throws Error if listing fails.
     */
    async listThisWeek(actor: UserType, filter: PaginationParams = {}): Promise<EventRecord[]> {
        dbLogger.info({ actor: actor.id, filter }, 'listing events for this week');

        try {
            // Get all active events
            const allEvents = await EventModel.listEvents({
                ...filter,
                includeDeleted: false
            });

            // Get current week boundaries (Sunday to Saturday)
            const now = new Date();
            const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
            const firstDayOfWeek = new Date(now);
            firstDayOfWeek.setDate(now.getDate() - currentDay); // Go back to Sunday
            firstDayOfWeek.setHours(0, 0, 0, 0);

            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // Go forward to Saturday
            lastDayOfWeek.setHours(23, 59, 59, 999);

            // Filter for events in the current week
            const thisWeekEvents = allEvents.filter((event) => {
                if (!event.date || !event.date.start) {
                    return false;
                }

                const startDate = new Date(event.date.start);

                // If there's an end date, check if any part of the event falls within the week
                if (event.date.end) {
                    const endDate = new Date(event.date.end);
                    return (
                        (startDate >= firstDayOfWeek && startDate <= lastDayOfWeek) || // Start date in this week
                        (endDate >= firstDayOfWeek && endDate <= lastDayOfWeek) || // End date in this week
                        (startDate <= firstDayOfWeek && endDate >= lastDayOfWeek) // Event spans the entire week
                    );
                }

                // For single-day events, just check the start date
                return startDate >= firstDayOfWeek && startDate <= lastDayOfWeek;
            });

            // Sort by start date (ascending)
            thisWeekEvents.sort((a, b) => {
                const dateA = new Date(a.date?.start || 0);
                const dateB = new Date(b.date?.start || 0);
                return dateA.getTime() - dateB.getTime();
            });

            dbLogger.info(
                { count: thisWeekEvents.length },
                'events for this week listed successfully'
            );
            return thisWeekEvents;
        } catch (error) {
            dbLogger.error(error, 'failed to list events for this week');
            throw error;
        }
    }

    /**
     * Get events within a date range.
     * @param startDate - The start date of the range.
     * @param endDate - The end date of the range.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records within the date range.
     * @throws Error if listing fails.
     */
    async getByDateRange(
        startDate: Date,
        endDate: Date,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EventRecord[]> {
        dbLogger.info(
            { startDate, endDate, actor: actor.id, filter },
            'getting events by date range'
        );

        try {
            // Get all active events
            const allEvents = await EventModel.listEvents({
                ...filter,
                includeDeleted: false
            });

            // Filter for events within the date range
            const eventsInRange = allEvents.filter((event) => {
                if (!event.date || !event.date.start) {
                    return false;
                }

                const eventStartDate = new Date(event.date.start);
                const eventEndDate = event.date.end ? new Date(event.date.end) : eventStartDate;

                // Check if any part of the event falls within the range
                return (
                    (eventStartDate >= startDate && eventStartDate <= endDate) || // Start date in range
                    (eventEndDate >= startDate && eventEndDate <= endDate) || // End date in range
                    (eventStartDate <= startDate && eventEndDate >= endDate) // Event spans the entire range
                );
            });

            // Sort by start date (ascending)
            eventsInRange.sort((a, b) => {
                const dateA = new Date(a.date?.start || 0);
                const dateB = new Date(b.date?.start || 0);
                return dateA.getTime() - dateB.getTime();
            });

            dbLogger.info(
                { count: eventsInRange.length },
                'events in date range retrieved successfully'
            );
            return eventsInRange;
        } catch (error) {
            dbLogger.error(error, 'failed to get events by date range');
            throw error;
        }
    }

    /**
     * Publish an event by setting its visibility to PUBLIC.
     * @param id - The ID of the event to publish.
     * @param actor - The user performing the action.
     * @returns The updated event record.
     * @throws Error if event is not found, actor is not authorized, or update fails.
     */
    async publish(id: string, actor: UserType): Promise<EventRecord> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'publishing event');

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            const changes: UpdateEventData = {
                visibility: 'PUBLIC',
                updatedById: actor.id
            };
            const updatedEvent = await EventModel.updateEvent(existingEvent.id, changes);
            dbLogger.info({ eventId: updatedEvent.id }, 'event published successfully');
            return updatedEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to publish event');
            throw error;
        }
    }

    /**
     * Unpublish an event by setting its visibility to DRAFT.
     * @param id - The ID of the event to unpublish.
     * @param actor - The user performing the action.
     * @returns The updated event record.
     * @throws Error if event is not found, actor is not authorized, or update fails.
     */
    async unpublish(id: string, actor: UserType): Promise<EventRecord> {
        dbLogger.info({ eventId: id, actor: actor.id }, 'unpublishing event');

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            const changes: UpdateEventData = {
                visibility: 'DRAFT',
                updatedById: actor.id
            };
            const updatedEvent = await EventModel.updateEvent(existingEvent.id, changes);
            dbLogger.info({ eventId: updatedEvent.id }, 'event unpublished successfully');
            return updatedEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to unpublish event');
            throw error;
        }
    }
}
