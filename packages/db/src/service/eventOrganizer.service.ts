import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    EventModel,
    EventOrganizerModel,
    type EventOrganizerRecord,
    type EventRecord
} from '../model';
import type {
    InsertEventOrganizer,
    PaginationParams,
    SelectEventFilter,
    SelectEventOrganizerFilter,
    UpdateEventData,
    UpdateEventOrganizerData
} from '../types/db-types';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils';

const log = logger.createLogger('EventOrganizerService');

/**
 * Service layer for managing event organizer operations.
 * Handles business logic, authorization, and interacts with the EventOrganizerModel and EventModel.
 */
export class EventOrganizerService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is an admin.
     * @param actor - The user performing the action.
     * @throws Error if the actor is not an admin.
     */
    private static assertAdmin(actor: UserType): void {
        if (!EventOrganizerService.isAdmin(actor)) {
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new event organizer.
     * @param data - The data for the new organizer.
     * @param actor - The user creating the organizer (must be an admin).
     * @returns The created organizer record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertEventOrganizer, actor: UserType): Promise<EventOrganizerRecord> {
        log.info('creating event organizer', 'create', { actor: actor.id });

        // Only admins can create organizers
        EventOrganizerService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertEventOrganizer = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdOrganizer = await EventOrganizerModel.createOrganizer(dataWithAudit);
            log.info('event organizer created successfully', 'create', {
                organizerId: createdOrganizer.id
            });
            return createdOrganizer;
        } catch (error) {
            log.error('failed to create event organizer', 'create', error, { actor: actor.id });
            throw error;
        }
    }

    /**
     * Get a single organizer by ID.
     * @param id - The ID of the organizer to fetch.
     * @param actor - The user performing the action.
     * @returns The organizer record.
     * @throws Error if organizer is not found.
     */
    async getById(id: string, actor: UserType): Promise<EventOrganizerRecord> {
        log.info('fetching organizer by id', 'getById', {
            organizerId: id,
            actor: actor.id
        });

        try {
            const organizer = await EventOrganizerModel.getOrganizerById(id);
            const existingOrganizer = assertExists(organizer, `Organizer ${id} not found`);

            log.info('organizer fetched successfully', 'getById', {
                organizerId: existingOrganizer.id
            });
            return existingOrganizer;
        } catch (error) {
            log.error('failed to fetch organizer by id', 'getById', error, {
                organizerId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List organizers with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of organizer records.
     * @throws Error if listing fails.
     */
    async list(
        filter: SelectEventOrganizerFilter,
        actor: UserType
    ): Promise<EventOrganizerRecord[]> {
        log.info('listing organizers', 'list', { filter, actor: actor.id });

        try {
            const organizers = await EventOrganizerModel.listOrganizers(filter);
            log.info('organizers listed successfully', 'list', {
                count: organizers.length,
                filter
            });
            return organizers;
        } catch (error) {
            log.error('failed to list organizers', 'list', error, {
                filter,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Update fields on an existing organizer.
     * @param id - The ID of the organizer to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated organizer record.
     * @throws Error if organizer is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateEventOrganizerData,
        actor: UserType
    ): Promise<EventOrganizerRecord> {
        log.info('updating organizer', 'update', { organizerId: id, actor: actor.id });

        // Only admins can update organizers
        EventOrganizerService.assertAdmin(actor);

        const existingOrganizer = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateEventOrganizerData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedOrganizer = await EventOrganizerModel.updateOrganizer(
                existingOrganizer.id,
                dataWithAudit
            );
            log.info('organizer updated successfully', 'update', {
                organizerId: updatedOrganizer.id
            });
            return updatedOrganizer;
        } catch (error) {
            log.error('failed to update organizer', 'update', error, {
                organizerId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Soft-delete an organizer by setting the deletedAt timestamp.
     * @param id - The ID of the organizer to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if organizer is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        log.info('soft deleting organizer', 'delete', { organizerId: id, actor: actor.id });

        // Only admins can delete organizers
        EventOrganizerService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventOrganizerModel.softDeleteOrganizer(id);
            log.info('organizer soft deleted successfully', 'delete', { organizerId: id });
        } catch (error) {
            log.error('failed to soft delete organizer', 'delete', error, {
                organizerId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Restore a soft-deleted organizer by clearing the deletedAt timestamp.
     * @param id - The ID of the organizer to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if organizer is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        log.info('restoring organizer', 'restore', { organizerId: id, actor: actor.id });

        // Only admins can restore organizers
        EventOrganizerService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventOrganizerModel.restoreOrganizer(id);
            log.info('organizer restored successfully', 'restore', { organizerId: id });
        } catch (error) {
            log.error('failed to restore organizer', 'restore', error, {
                organizerId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Permanently delete an organizer record from the database.
     * @param id - The ID of the organizer to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if organizer is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        log.info('hard deleting organizer', 'hardDelete', { organizerId: id, actor: actor.id });

        // Only admins can hard delete
        EventOrganizerService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventOrganizerModel.hardDeleteOrganizer(id);
            log.info('organizer hard deleted successfully', 'hardDelete', { organizerId: id });
        } catch (error) {
            log.error('failed to hard delete organizer', 'hardDelete', error, {
                organizerId: id,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * Assign an organizer to an event.
     * @param eventId - The ID of the event.
     * @param organizerId - The ID of the organizer.
     * @param actor - The user performing the action (must be an admin or event author).
     * @returns The updated event record.
     * @throws Error if event or organizer is not found, actor is not authorized, or update fails.
     */
    async assignToEvent(
        eventId: string,
        organizerId: string,
        actor: UserType
    ): Promise<EventRecord> {
        log.info('assigning organizer to event', 'assignToEvent', {
            eventId,
            organizerId,
            actor: actor.id
        });

        try {
            // Check if event exists
            const event = await EventModel.getEventById(eventId);
            if (!event) {
                throw new Error(`Event ${eventId} not found`);
            }

            // Check if actor is admin or event author
            if (!EventOrganizerService.isAdmin(actor) && event.authorId !== actor.id) {
                throw new Error('Forbidden: Only admins or event authors can assign organizers');
            }

            // Check if organizer exists
            const organizer = await this.getById(organizerId, actor);

            // Update the event with the organizer ID
            const changes: UpdateEventData = {
                organizerId: organizer.id,
                updatedById: actor.id
            };

            const updatedEvent = await EventModel.updateEvent(eventId, changes);
            log.info('organizer assigned to event successfully', 'assignToEvent', {
                eventId,
                organizerId
            });
            return updatedEvent;
        } catch (error) {
            log.error('failed to assign organizer to event', 'assignToEvent', error, {
                eventId,
                organizerId,
                actor: actor.id
            });
            throw error;
        }
    }

    /**
     * List events for a specific organizer.
     * @param organizerId - The ID of the organizer.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records organized by the specified organizer.
     * @throws Error if organizer is not found or listing fails.
     */
    async listEvents(
        organizerId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EventRecord[]> {
        log.info('listing events by organizer', 'listEvents', {
            organizerId,
            actor: actor.id,
            filter
        });

        try {
            // Verify organizer exists
            await this.getById(organizerId, actor);

            const eventFilter: SelectEventFilter = {
                organizerId,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            log.info('events by organizer listed successfully', 'listEvents', {
                organizerId,
                count: events.length
            });
            return events;
        } catch (error) {
            log.error('failed to list events by organizer', 'listEvents', error, {
                organizerId,
                actor: actor.id
            });
            throw error;
        }
    }
}
