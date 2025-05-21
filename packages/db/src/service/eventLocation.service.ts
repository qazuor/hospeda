import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    EventLocationModel,
    type EventLocationRecord,
    EventModel,
    type EventRecord
} from '../model/index.js';
import type {
    InsertEventLocation,
    PaginationParams,
    SelectEventFilter,
    SelectEventLocationFilter,
    UpdateEventLocationData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing event location operations.
 * Handles business logic, authorization, and interacts with the EventLocationModel and EventModel.
 */
export class EventLocationService {
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
        if (!EventLocationService.isAdmin(actor)) {
            dbLogger.warn({ actorId: actor.id }, 'Admin access required');
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new event location.
     * @param data - The data for the new location.
     * @param actor - The user creating the location (must be an admin).
     * @returns The created location record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertEventLocation, actor: UserType): Promise<EventLocationRecord> {
        dbLogger.info({ actor: actor.id }, 'creating event location');

        // Only admins can create locations
        EventLocationService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertEventLocation = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdLocation = await EventLocationModel.createLocation(dataWithAudit);
            dbLogger.info(
                {
                    locationId: createdLocation.id
                },
                'event location created successfully'
            );
            return createdLocation;
        } catch (error) {
            dbLogger.error(error, 'failed to create event location');
            throw error;
        }
    }

    /**
     * Get a single location by ID.
     * @param id - The ID of the location to fetch.
     * @param actor - The user performing the action.
     * @returns The location record.
     * @throws Error if location is not found.
     */
    async getById(id: string, actor: UserType): Promise<EventLocationRecord> {
        dbLogger.info(
            {
                locationId: id,
                actor: actor.id
            },
            'fetching location by id'
        );

        try {
            const location = await EventLocationModel.getLocationById(id);
            const existingLocation = assertExists(location, `Location ${id} not found`);

            dbLogger.info(
                {
                    locationId: existingLocation.id
                },
                'location fetched successfully'
            );
            return existingLocation;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch location by id');
            throw error;
        }
    }

    /**
     * List locations with optional filters, pagination, and search.
     * @param filter - Filtering and pagination options.
     * @param actor - The user performing the action.
     * @returns Array of location records.
     * @throws Error if listing fails.
     */
    async list(filter: SelectEventLocationFilter, actor: UserType): Promise<EventLocationRecord[]> {
        dbLogger.info({ filter, actor: actor.id }, 'listing locations');

        try {
            const locations = await EventLocationModel.listLocations(filter);
            dbLogger.info(
                {
                    count: locations.length,
                    filter
                },
                'locations listed successfully'
            );
            return locations;
        } catch (error) {
            dbLogger.error(error, 'failed to list locations');
            throw error;
        }
    }

    /**
     * Update fields on an existing location.
     * @param id - The ID of the location to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action (must be an admin).
     * @returns The updated location record.
     * @throws Error if location is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateEventLocationData,
        actor: UserType
    ): Promise<EventLocationRecord> {
        dbLogger.info({ locationId: id, actor: actor.id }, 'updating location');

        // Only admins can update locations
        EventLocationService.assertAdmin(actor);

        const existingLocation = await this.getById(id, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateEventLocationData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedLocation = await EventLocationModel.updateLocation(
                existingLocation.id,
                dataWithAudit
            );
            dbLogger.info(
                {
                    locationId: updatedLocation.id
                },
                'location updated successfully'
            );
            return updatedLocation;
        } catch (error) {
            dbLogger.error(error, 'failed to update location');
            throw error;
        }
    }

    /**
     * Soft-delete a location by setting the deletedAt timestamp.
     * @param id - The ID of the location to delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if location is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ locationId: id, actor: actor.id }, 'soft deleting location');

        // Only admins can delete locations
        EventLocationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventLocationModel.softDeleteLocation(id);
            dbLogger.info({ locationId: id }, 'location soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete location');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted location by clearing the deletedAt timestamp.
     * @param id - The ID of the location to restore.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if location is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ locationId: id, actor: actor.id }, 'restoring location');

        // Only admins can restore locations
        EventLocationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventLocationModel.restoreLocation(id);
            dbLogger.info({ locationId: id }, 'location restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore location');
            throw error;
        }
    }

    /**
     * Permanently delete a location record from the database.
     * @param id - The ID of the location to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if location is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ locationId: id, actor: actor.id }, 'hard deleting location');

        // Only admins can hard delete
        EventLocationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventLocationModel.hardDeleteLocation(id);
            dbLogger.info({ locationId: id }, 'location hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete location');
            throw error;
        }
    }

    /**
     * List events for a specific location.
     * @param locationId - The ID of the location.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of event records at the specified location.
     * @throws Error if location is not found or listing fails.
     */
    async listEvents(
        locationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<EventRecord[]> {
        dbLogger.info(
            {
                locationId,
                actor: actor.id,
                filter
            },
            'listing events by location'
        );

        try {
            // Verify location exists
            const location = await this.getById(locationId, actor);

            const eventFilter: SelectEventFilter = {
                locationId: location.id,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            dbLogger.info(
                {
                    locationId,
                    count: events.length
                },
                'events by location listed successfully'
            );
            return events;
        } catch (error) {
            dbLogger.error(error, 'failed to list events by location');
            throw error;
        }
    }
}
