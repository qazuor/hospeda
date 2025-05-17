import { logger } from '@repo/logger';
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

const log = logger.createLogger('EventLocationService');

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
            log.warn('Admin access required', 'assertAdmin', { actorId: actor.id });
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
        log.info('creating event location', 'create', { actor: actor.id });

        // Only admins can create locations
        EventLocationService.assertAdmin(actor);

        try {
            const dataWithAudit: InsertEventLocation = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdLocation = await EventLocationModel.createLocation(dataWithAudit);
            log.info('event location created successfully', 'create', {
                locationId: createdLocation.id
            });
            return createdLocation;
        } catch (error) {
            log.error('failed to create event location', 'create', error, { actor: actor.id });
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
        log.info('fetching location by id', 'getById', {
            locationId: id,
            actor: actor.id
        });

        try {
            const location = await EventLocationModel.getLocationById(id);
            const existingLocation = assertExists(location, `Location ${id} not found`);

            log.info('location fetched successfully', 'getById', {
                locationId: existingLocation.id
            });
            return existingLocation;
        } catch (error) {
            log.error('failed to fetch location by id', 'getById', error, {
                locationId: id,
                actor: actor.id
            });
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
        log.info('listing locations', 'list', { filter, actor: actor.id });

        try {
            const locations = await EventLocationModel.listLocations(filter);
            log.info('locations listed successfully', 'list', {
                count: locations.length,
                filter
            });
            return locations;
        } catch (error) {
            log.error('failed to list locations', 'list', error, {
                filter,
                actor: actor.id
            });
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
        log.info('updating location', 'update', { locationId: id, actor: actor.id });

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
            log.info('location updated successfully', 'update', {
                locationId: updatedLocation.id
            });
            return updatedLocation;
        } catch (error) {
            log.error('failed to update location', 'update', error, {
                locationId: id,
                actor: actor.id
            });
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
        log.info('soft deleting location', 'delete', { locationId: id, actor: actor.id });

        // Only admins can delete locations
        EventLocationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventLocationModel.softDeleteLocation(id);
            log.info('location soft deleted successfully', 'delete', { locationId: id });
        } catch (error) {
            log.error('failed to soft delete location', 'delete', error, {
                locationId: id,
                actor: actor.id
            });
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
        log.info('restoring location', 'restore', { locationId: id, actor: actor.id });

        // Only admins can restore locations
        EventLocationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventLocationModel.restoreLocation(id);
            log.info('location restored successfully', 'restore', { locationId: id });
        } catch (error) {
            log.error('failed to restore location', 'restore', error, {
                locationId: id,
                actor: actor.id
            });
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
        log.info('hard deleting location', 'hardDelete', { locationId: id, actor: actor.id });

        // Only admins can hard delete
        EventLocationService.assertAdmin(actor);

        await this.getById(id, actor);

        try {
            await EventLocationModel.hardDeleteLocation(id);
            log.info('location hard deleted successfully', 'hardDelete', { locationId: id });
        } catch (error) {
            log.error('failed to hard delete location', 'hardDelete', error, {
                locationId: id,
                actor: actor.id
            });
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
        log.info('listing events by location', 'listEvents', {
            locationId,
            actor: actor.id,
            filter
        });

        try {
            // Verify location exists
            const location = await this.getById(locationId, actor);

            const eventFilter: SelectEventFilter = {
                locationId: location.id,
                ...filter,
                includeDeleted: false
            };

            const events = await EventModel.listEvents(eventFilter);
            log.info('events by location listed successfully', 'listEvents', {
                locationId,
                count: events.length
            });
            return events;
        } catch (error) {
            log.error('failed to list events by location', 'listEvents', error, {
                locationId,
                actor: actor.id
            });
            throw error;
        }
    }
}
