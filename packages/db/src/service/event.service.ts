import { logger } from '@repo/logger';
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

const log = logger.createLogger('EventService');

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
            log.warn('Forbidden access attempt', 'assertAuthorOrAdmin', {
                actorId: actor.id,
                requiredAuthorId: authorId
            });
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
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
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
        log.info('creating event', 'create', { actor: actor.id });

        try {
            const dataWithAudit: InsertEvent = {
                ...data,
                authorId: actor.id, // Set the current user as the author
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdEvent = await EventModel.createEvent(dataWithAudit);
            log.info('event created successfully', 'create', { eventId: createdEvent.id });
            return createdEvent;
        } catch (error) {
            log.error('failed to create event', 'create', error, { actor: actor.id });
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
        log.info('fetching event by id', 'getById', { eventId: id, actor: actor.id });

        try {
            const event = await EventModel.getEventById(id);
            const existingEvent = assertExists(event, `Event ${id} not found`);

            log.info('event fetched successfully', 'getById', { eventId: existingEvent.id });
            return existingEvent;
        } catch (error) {
            log.error('failed to fetch event by id', 'getById', error, {
                eventId: id,
                actor: actor.id
            });
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
        log.info('fetching event by slug', 'getBySlug', { slug, actor: actor.id });

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

            log.info('event fetched by slug successfully', 'getBySlug', {
                eventId: existingEvent.id,
                slug
            });
            return existingEvent;
        } catch (error) {
            log.error('failed to fetch event by slug', 'getBySlug', error, {
                slug,
                actor: actor.id
            });
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
        log.info('listing events', 'list', { filter, actor: actor.id });

        try {
            const events = await EventModel.listEvents(filter);
            log.info('events listed successfully', 'list', {
                count: events.length,
                filter
            });
            return events;
        } catch (error) {
            log.error('failed to list events', 'list', error, { filter, actor: actor.id });
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
        log.info('updating event', 'update', { eventId: id, actor: actor.id });

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
            log.info('event updated successfully', 'update', { eventId: updatedEvent.id });
            return updatedEvent;
        } catch (error) {
            log.error('failed to update event', 'update', error, {
                eventId: id,
                actor: actor.id
            });
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
        log.info('soft deleting event', 'delete', { eventId: id, actor: actor.id });

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            await EventModel.softDeleteEvent(id);
            log.info('event soft deleted successfully', 'delete', { eventId: id });
        } catch (error) {
            log.error('failed to soft delete event', 'delete', error, {
                eventId: id,
                actor: actor.id
            });
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
        log.info('restoring event', 'restore', { eventId: id, actor: actor.id });

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            await EventModel.restoreEvent(id);
            log.info('event restored successfully', 'restore', { eventId: id });
        } catch (error) {
            log.error('failed to restore event', 'restore', error, {
                eventId: id,
                actor: actor.id
            });
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
        log.info('hard deleting event', 'hardDelete', { eventId: id, actor: actor.id });

        // Only admins can hard delete
        EventService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventModel.hardDeleteEvent(id);
            log.info('event hard deleted successfully', 'hardDelete', { eventId: id });
        } catch (error) {
            log.error('failed to hard delete event', 'hardDelete', error, {
                eventId: id,
                actor: actor.id
            });
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
        log.info('fetching events by category', 'getByCategory', {
            category,
            actor: actor.id,
            filter
        });

        try {
            const eventFilter: SelectEventFilter = {
                category,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            log.info('events fetched by category successfully', 'getByCategory', {
                category,
                count: events.length
            });
            return events;
        } catch (error) {
            log.error('failed to fetch events by category', 'getByCategory', error, {
                category,
                actor: actor.id
            });
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
        log.info('updating event organizer', 'updateOrganizer', {
            organizerId,
            actor: actor.id
        });

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
            log.info('event organizer updated successfully', 'updateOrganizer', {
                organizerId: updatedOrganizer.id
            });
            return updatedOrganizer;
        } catch (error) {
            log.error('failed to update event organizer', 'updateOrganizer', error, {
                organizerId,
                actor: actor.id
            });
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
        log.info('updating event location', 'updateLocation', {
            locationId,
            actor: actor.id
        });

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
            log.info('event location updated successfully', 'updateLocation', {
                locationId: updatedLocation.id
            });
            return updatedLocation;
        } catch (error) {
            log.error('failed to update event location', 'updateLocation', error, {
                locationId,
                actor: actor.id
            });
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
        log.info('listing events by location', 'listByLocation', {
            locationId,
            actor: actor.id,
            filter
        });

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
            log.info('events listed by location successfully', 'listByLocation', {
                locationId,
                count: events.length
            });
            return events;
        } catch (error) {
            log.error('failed to list events by location', 'listByLocation', error, {
                locationId,
                actor: actor.id
            });
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
        log.info('listing events by organizer', 'listByOrganizer', {
            organizerId,
            actor: actor.id,
            filter
        });

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
            log.info('events listed by organizer successfully', 'listByOrganizer', {
                organizerId,
                count: events.length
            });
            return events;
        } catch (error) {
            log.error('failed to list events by organizer', 'listByOrganizer', error, {
                organizerId,
                actor: actor.id
            });
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
        log.info('listing upcoming events', 'listUpcoming', { actor: actor.id, filter });

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

            log.info('upcoming events listed successfully', 'listUpcoming', {
                count: upcomingEvents.length
            });
            return upcomingEvents;
        } catch (error) {
            log.error('failed to list upcoming events', 'listUpcoming', error, {
                actor: actor.id
            });
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
        log.info('listing past events', 'listPast', { actor: actor.id, filter });

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

            log.info('past events listed successfully', 'listPast', {
                count: pastEvents.length
            });
            return pastEvents;
        } catch (error) {
            log.error('failed to list past events', 'listPast', error, {
                actor: actor.id
            });
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
        log.info('listing events for this month', 'listThisMonth', { actor: actor.id, filter });

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

            log.info('events for this month listed successfully', 'listThisMonth', {
                count: thisMonthEvents.length
            });
            return thisMonthEvents;
        } catch (error) {
            log.error('failed to list events for this month', 'listThisMonth', error, {
                actor: actor.id
            });
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
        log.info('listing events for this week', 'listThisWeek', { actor: actor.id, filter });

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

            log.info('events for this week listed successfully', 'listThisWeek', {
                count: thisWeekEvents.length
            });
            return thisWeekEvents;
        } catch (error) {
            log.error('failed to list events for this week', 'listThisWeek', error, {
                actor: actor.id
            });
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
        log.info('getting events by date range', 'getByDateRange', {
            startDate,
            endDate,
            actor: actor.id,
            filter
        });

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

            log.info('events in date range retrieved successfully', 'getByDateRange', {
                count: eventsInRange.length
            });
            return eventsInRange;
        } catch (error) {
            log.error('failed to get events by date range', 'getByDateRange', error, {
                startDate,
                endDate,
                actor: actor.id
            });
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
        log.info('publishing event', 'publish', { eventId: id, actor: actor.id });

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            const changes: UpdateEventData = {
                visibility: 'PUBLIC',
                updatedById: actor.id
            };
            const updatedEvent = await EventModel.updateEvent(existingEvent.id, changes);
            log.info('event published successfully', 'publish', { eventId: updatedEvent.id });
            return updatedEvent;
        } catch (error) {
            log.error('failed to publish event', 'publish', error, {
                eventId: id,
                actor: actor.id
            });
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
        log.info('unpublishing event', 'unpublish', { eventId: id, actor: actor.id });

        const existingEvent = await this.getById(id, actor);

        // Check if actor is author or admin
        EventService.assertAuthorOrAdmin(existingEvent.authorId, actor);

        try {
            const changes: UpdateEventData = {
                visibility: 'DRAFT',
                updatedById: actor.id
            };
            const updatedEvent = await EventModel.updateEvent(existingEvent.id, changes);
            log.info('event unpublished successfully', 'unpublish', { eventId: updatedEvent.id });
            return updatedEvent;
        } catch (error) {
            log.error('failed to unpublish event', 'unpublish', error, {
                eventId: id,
                actor: actor.id
            });
            throw error;
        }
    }
}
