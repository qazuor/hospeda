import type { UpdateEventInputType } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/types';
import { EventModel } from '../../models/event/event.model';
import { hasPermission } from '../../utils';
import { dbLogger } from '../../utils/logger';
import { logDenied, logGrant } from '../../utils/permission-logger';
import {
    CanViewReasonEnum,
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../../utils/service-helper';
import { canViewEvent, normalizeCreateInput } from './event.helper';
import {
    type CreateEventInput,
    type CreateEventOutput,
    type GetByIdInput,
    type GetByIdOutput,
    type GetByLocationIdInput,
    type GetByLocationIdOutput,
    type GetBySlugInput,
    type GetBySlugOutput,
    type UpdateInput,
    type UpdateOutput,
    createEventInputSchema,
    getByIdInputSchema,
    getByLocationIdInputSchema,
    getBySlugInputSchema,
    updateInputSchema
} from './event.schemas';

/**
 * Retrieves an event by its unique ID, applying robust permission checks, logging, and edge-case handling.
 * - Admins can view any event.
 * - The author can view their own event.
 * - Others require explicit permission for private/draft events.
 * - Only admins can view non-active (soft-deleted, archived, etc.) events.
 * - Disabled users cannot view any event.
 *
 * @param input - Object containing the event ID ({ id: EventId }).
 * @param actor - The user or public actor requesting the event.
 * @returns An object with the event if accessible, or null otherwise.
 * @throws Error if the event has unknown visibility (should not occur in current logic).
 * @example
 *   const { event } = await getById({ id: 'event-123' }, adminUser);
 */
export const getById = async (input: GetByIdInput, actor: unknown): Promise<GetByIdOutput> => {
    logMethodStart(dbLogger, 'getById', input, actor as object);
    const parsedInput = getByIdInputSchema.parse(input);
    const event = (await EventModel.getById(parsedInput.id)) ?? null;
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            'User disabled',
            undefined
        );
        logMethodEnd(dbLogger, 'getById', { event: null });
        return { event: null };
    }
    const { canView, reason, checkedPermission } = canViewEvent(
        safeActor,
        event ?? {
            visibility: VisibilityEnum.PUBLIC,
            authorId: '',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        }
    );
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            reason,
            checkedPermission
        );
        logMethodEnd(dbLogger, 'getById', { event: null });
        throw new Error(`Unknown event visibility: ${event ? event.visibility : 'null'}`);
    }
    if (reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            reason,
            checkedPermission
        );
        logMethodEnd(dbLogger, 'getById', { event: null });
        return { event: null };
    }
    if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
        try {
            hasPermission(safeActor, checkedPermission);
            if (event && event.visibility !== VisibilityEnum.PUBLIC) {
                logGrant(dbLogger, safeActor, input, event, checkedPermission, reason);
            }
            logMethodEnd(dbLogger, 'getById', { event });
            return { event };
        } catch {
            logDenied(
                dbLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(dbLogger, 'getById', { event: null });
            return { event: null };
        }
    }
    if (!canView) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            reason,
            checkedPermission
        );
        logMethodEnd(dbLogger, 'getById', { event: null });
        return { event: null };
    }
    if (event && event.visibility !== VisibilityEnum.PUBLIC) {
        logGrant(
            dbLogger,
            safeActor,
            input,
            event,
            checkedPermission ?? PermissionEnum.EVENT_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getById', { event });
    return { event };
};

/**
 * Retrieves an event by its unique slug, applying robust permission checks, logging, and edge-case handling.
 * - Admins can view any event.
 * - The author can view their own event.
 * - Others require explicit permission for private/draft events.
 * - Only admins can view non-active (soft-deleted, archived, etc.) events.
 * - Disabled users cannot view any event.
 *
 * @param input - Object containing the event slug ({ slug: string }).
 * @param actor - The user or public actor requesting the event.
 * @returns An object with the event if accessible, or null otherwise.
 * @throws Error if the event has unknown visibility (should not occur in current logic).
 * @example
 *   const { event } = await getBySlug({ slug: 'event-slug' }, adminUser);
 */
export const getBySlug = async (
    input: GetBySlugInput,
    actor: unknown
): Promise<GetBySlugOutput> => {
    logMethodStart(dbLogger, 'getBySlug', input, actor as object);
    const parsedInput = getBySlugInputSchema.parse(input);
    const event = (await EventModel.getBySlug(parsedInput.slug)) ?? null;
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            'User disabled',
            undefined
        );
        logMethodEnd(dbLogger, 'getBySlug', { event: null });
        return { event: null };
    }
    const { canView, reason, checkedPermission } = canViewEvent(
        safeActor,
        event ?? {
            visibility: VisibilityEnum.PUBLIC,
            authorId: '',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        }
    );
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            reason,
            checkedPermission
        );
        logMethodEnd(dbLogger, 'getBySlug', { event: null });
        throw new Error(`Unknown event visibility: ${event ? event.visibility : 'null'}`);
    }
    if (reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            reason,
            checkedPermission
        );
        logMethodEnd(dbLogger, 'getBySlug', { event: null });
        return { event: null };
    }
    if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
        try {
            hasPermission(safeActor, checkedPermission);
            if (event && event.visibility !== VisibilityEnum.PUBLIC) {
                logGrant(dbLogger, safeActor, input, event, checkedPermission, reason);
            }
            logMethodEnd(dbLogger, 'getBySlug', { event });
            return { event };
        } catch {
            logDenied(
                dbLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(dbLogger, 'getBySlug', { event: null });
            return { event: null };
        }
    }
    if (!canView) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event ?? { visibility: VisibilityEnum.PUBLIC },
            reason,
            checkedPermission
        );
        logMethodEnd(dbLogger, 'getBySlug', { event: null });
        return { event: null };
    }
    if (event && event.visibility !== VisibilityEnum.PUBLIC) {
        logGrant(
            dbLogger,
            safeActor,
            input,
            event,
            checkedPermission ?? PermissionEnum.EVENT_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getBySlug', { event });
    return { event };
};

/**
 * Gets events by author ID.
 * @throws Error (not implemented).
 */
export const getByAuthorId = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Retrieves events by locationId, applying permission checks, logging, and edge-case handling.
 * - Admins can view all events for the location.
 * - Regular users can view public/active events, or private if they have permission.
 * - Disabled users cannot view any event.
 *
 * @param input - Object containing the locationId ({ locationId: string }).
 * @param actor - The user or public actor requesting the events.
 * @returns An object with the events array (may be empty).
 * @example
 *   const { events } = await getByLocationId({ locationId: 'loc-1' }, user);
 */
export const getByLocationId = async (
    input: GetByLocationIdInput,
    actor: unknown
): Promise<GetByLocationIdOutput> => {
    logMethodStart(dbLogger, 'getByLocationId', input, actor as object);
    const parsedInput = getByLocationIdInputSchema.parse(input);
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'User disabled',
            undefined
        );
        logMethodEnd(dbLogger, 'getByLocationId', { events: [] });
        return { events: [] };
    }
    // Retrieve all events for the given location
    const allEvents = await EventModel.search({
        locationId: parsedInput.locationId,
        limit: 100,
        offset: 0
    });
    // Filter events by permissions and visibility
    const filtered = allEvents.filter((event) => {
        const { canView, reason, checkedPermission } = canViewEvent(safeActor, event);
        if (canView) return true;
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            return hasPermission(safeActor, checkedPermission);
        }
        return false;
    });
    // Log using the visibility of the first event (if any) or PUBLIC
    logGrant(
        dbLogger,
        safeActor,
        input,
        { visibility: filtered[0]?.visibility || VisibilityEnum.PUBLIC },
        PermissionEnum.EVENT_VIEW_PRIVATE,
        'Events by locationId'
    );
    logMethodEnd(dbLogger, 'getByLocationId', { events: filtered });
    return { events: filtered };
};

/**
 * Gets events by organizer ID.
 * @throws Error (not implemented).
 */
export const getByOrganizerId = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets events by category.
 * @throws Error (not implemented).
 */
export const getByCategory = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets featured events.
 * @throws Error (not implemented).
 */
export const getFeatured = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets upcoming events.
 * @throws Error (not implemented).
 */
export const getUpcoming = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets past events.
 * @throws Error (not implemented).
 */
export const getPast = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets events within a date range.
 * @throws Error (not implemented).
 */
export const getByDateRange = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Creates a new event, applying permission checks, validation, and logging.
 * - Only users with EVENT_CREATE permission (or admin/superadmin) can create events.
 * - Validates input with Zod schema.
 * - Handles slug uniqueness and business rules.
 * - Logs all actions and denials.
 *
 * @param input - Object with event creation data.
 * @param actor - The user requesting the creation.
 * @returns The created event.
 * @throws Error if permission denied, validation fails, or slug is not unique.
 * @example
 *   const { event } = await create({ ... }, user);
 */
export const create = async (
    input: CreateEventInput,
    actor: unknown
): Promise<CreateEventOutput> => {
    logMethodStart(dbLogger, 'create', input, actor as object);
    const parsedInput = createEventInputSchema.parse(input);
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility },
            'User disabled',
            undefined
        );
        logMethodEnd(dbLogger, 'create', { event: null });
        throw new Error('User is disabled');
    }
    // Permiso: EVENT_CREATE
    const allowed =
        safeActor.role === 'ADMIN' ||
        safeActor.role === 'SUPER_ADMIN' ||
        hasPermission(safeActor, PermissionEnum.EVENT_CREATE);
    if (!allowed) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility },
            'Permission denied',
            PermissionEnum.EVENT_CREATE
        );
        logMethodEnd(dbLogger, 'create', { event: null });
        throw new Error('Permission denied: EVENT_CREATE');
    }
    // Unicidad de slug
    const existing = await EventModel.getBySlug(parsedInput.slug);
    if (existing) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility },
            'Slug already exists',
            undefined
        );
        logMethodEnd(dbLogger, 'create', { event: null });
        throw new Error('Slug already exists');
    }
    // Normaliza el input como en los otros servicios
    const normalizedInput = normalizeCreateInput(parsedInput);
    // Crear evento
    const event = await EventModel.create({
        ...normalizedInput,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.PENDING_REVIEW
    });
    logGrant(dbLogger, safeActor, input, event, PermissionEnum.EVENT_CREATE, 'Event created');
    logMethodEnd(dbLogger, 'create', { event });
    return { event };
};

/**
 * Updates an existing event, applying permission checks, validation, and logging.
 * - Only users with EVENT_UPDATE permission (or admin/superadmin) can update events.
 * - Validates input with Zod schema.
 * - Checks event existence and slug uniqueness.
 * - Logs all actions and denials.
 *
 * @param input - Object with event update data (must include id).
 * @param actor - The user requesting the update.
 * @returns The updated event.
 * @throws Error if permission denied, validation fails, event not found, or slug is not unique.
 * @example
 *   const { event } = await update({ id: 'event-1', summary: 'Updated' }, user);
 */
export const update = async (input: UpdateInput, actor: unknown): Promise<UpdateOutput> => {
    logMethodStart(dbLogger, 'update', input, actor as object);
    const parsedInput = updateInputSchema.parse(input);
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility || '' },
            'User disabled',
            undefined
        );
        logMethodEnd(dbLogger, 'update', { event: null });
        throw new Error('User is disabled');
    }
    // Permission: EVENT_UPDATE
    const allowed =
        safeActor.role === 'ADMIN' ||
        safeActor.role === 'SUPER_ADMIN' ||
        hasPermission(safeActor, PermissionEnum.EVENT_UPDATE);
    if (!allowed) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility || '' },
            'Permission denied',
            PermissionEnum.EVENT_UPDATE
        );
        logMethodEnd(dbLogger, 'update', { event: null });
        throw new Error('Permission denied: EVENT_UPDATE');
    }
    // Find existing event
    const existing = await EventModel.getById(parsedInput.id);
    if (!existing) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility || '' },
            'Event not found',
            undefined
        );
        logMethodEnd(dbLogger, 'update', { event: null });
        throw new Error('Event not found');
    }
    // If updating slug, check uniqueness
    if (parsedInput.slug && parsedInput.slug !== existing.slug) {
        const slugExists = await EventModel.getBySlug(parsedInput.slug);
        if (slugExists) {
            logDenied(
                dbLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility || '' },
                'Slug already exists',
                undefined
            );
            logMethodEnd(dbLogger, 'update', { event: null });
            throw new Error('Slug already exists');
        }
    }
    // Normalize input (same as in create)
    const normalizedInput = { ...parsedInput } as UpdateEventInputType;
    // Update event
    const updated = await EventModel.update(parsedInput.id, normalizedInput);
    if (!updated) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.visibility || '' },
            'Update failed',
            undefined
        );
        logMethodEnd(dbLogger, 'update', { event: null });
        throw new Error('Event update failed');
    }
    logGrant(dbLogger, safeActor, input, updated, PermissionEnum.EVENT_UPDATE, 'Event updated');
    logMethodEnd(dbLogger, 'update', { event: updated });
    return { event: updated };
};

/**
 * Soft-deletes (disables) an event.
 * @throws Error (not implemented).
 */
export const softDelete = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Restores a previously soft-deleted event.
 * @throws Error (not implemented).
 */
export const restore = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Hard-deletes (permanently deletes) an event.
 * @throws Error (not implemented).
 */
export const hardDelete = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Searches for events based on advanced filters.
 * @throws Error (not implemented).
 */
export const search = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Lists events with basic filters and pagination.
 * @throws Error (not implemented).
 */
export const list = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};
