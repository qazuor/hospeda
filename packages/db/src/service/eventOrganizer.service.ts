import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    EventModel,
    EventOrganizerModel,
    type EventOrganizerRecord,
    type EventRecord
} from '../model/index.js';
import type {
    InsertEventOrganizer,
    PaginationParams,
    SelectEventFilter,
    SelectEventOrganizerFilter,
    UpdateEventData,
    UpdateEventOrganizerData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

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
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
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
        dbLogger.info({ actor: actor.id }, 'creating event organizer');

        // Only admins can create organizers
        EventOrganizerService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertEventOrganizer = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdOrganizer = await EventOrganizerModel.createOrganizer(dataWithAudit);
            dbLogger.info(
                {
                    organizerId: createdOrganizer.id
                },
                'event organizer created successfully'
            );
            return createdOrganizer;
        } catch (error) {
            dbLogger.error(error, 'failed to create event organizer');
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
        dbLogger.info(
            {
                organizerId: id,
                actor: actor.id
            },
            'fetching organizer by id'
        );

        try {
            const organizer = await EventOrganizerModel.getOrganizerById(id);
            const existingOrganizer = assertExists(organizer, `Organizer ${id} not found`);

            dbLogger.info(
                {
                    organizerId: existingOrganizer.id
                },
                'organizer fetched successfully'
            );
            return existingOrganizer;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch organizer by id');
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
        dbLogger.info({ filter, actor: actor.id }, 'listing organizers');

        try {
            const organizers = await EventOrganizerModel.listOrganizers(filter);
            dbLogger.info(
                {
                    count: organizers.length,
                    filter
                },
                'organizers listed successfully'
            );
            return organizers;
        } catch (error) {
            dbLogger.error(error, 'failed to list organizers');
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
        dbLogger.info({ organizerId: id, actor: actor.id }, 'updating organizer');

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
            dbLogger.info(
                {
                    organizerId: updatedOrganizer.id
                },
                'organizer updated successfully'
            );
            return updatedOrganizer;
        } catch (error) {
            dbLogger.error(error, 'failed to update organizer');
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
        dbLogger.info({ organizerId: id, actor: actor.id }, 'soft deleting organizer');

        // Only admins can delete organizers
        EventOrganizerService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventOrganizerModel.softDeleteOrganizer(id);
            dbLogger.info({ organizerId: id }, 'organizer soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete organizer');
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
        dbLogger.info({ organizerId: id, actor: actor.id }, 'restoring organizer');

        // Only admins can restore organizers
        EventOrganizerService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventOrganizerModel.restoreOrganizer(id);
            dbLogger.info({ organizerId: id }, 'organizer restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore organizer');
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
        dbLogger.info(
            {
                organizerId: id,
                actor: actor.id
            },
            'hard deleting organizer'
        );

        // Only admins can hard delete
        EventOrganizerService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventOrganizerModel.hardDeleteOrganizer(id);
            dbLogger.info({ organizerId: id }, 'organizer hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete organizer');
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
        dbLogger.info(
            {
                eventId,
                organizerId,
                actor: actor.id
            },
            'assigning organizer to event'
        );

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
            dbLogger.info(
                {
                    eventId,
                    organizerId
                },
                'organizer assigned to event successfully'
            );
            return updatedEvent;
        } catch (error) {
            dbLogger.error(error, 'failed to assign organizer to event');
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
        dbLogger.info(
            {
                organizerId,
                actor: actor.id,
                filter
            },
            'listing events by organizer'
        );

        try {
            // Verify organizer exists
            await this.getById(organizerId, actor);

            const eventFilter: SelectEventFilter = {
                organizerId,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            dbLogger.info(
                {
                    organizerId,
                    count: events.length
                },
                'events by organizer listed successfully'
            );
            return events;
        } catch (error) {
            dbLogger.error(error, 'failed to list events by organizer');
            throw error;
        }
    }
}
