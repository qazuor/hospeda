import type { EventType, PublicUserType, UpdateEventInputType, UserType } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
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
import {
    assertNotArchived,
    buildRestoreUpdate,
    buildSoftDeleteUpdate,
    canViewEvent,
    normalizeCreateInput
} from './event.helper';
import {
    type CreateEventInput,
    type CreateEventOutput,
    type GetByCategoryInput,
    type GetByCategoryOutput,
    type GetByIdInput,
    type GetByIdOutput,
    type GetByLocationIdInput,
    type GetByLocationIdOutput,
    type GetByOrganizerIdInput,
    type GetByOrganizerIdOutput,
    type GetBySlugInput,
    type GetBySlugOutput,
    type GetFeaturedInput,
    type GetFeaturedOutput,
    type GetUpcomingInput,
    type GetUpcomingOutput,
    type ListEventsInput,
    type ListEventsOutput,
    type UpdateInput,
    type UpdateOutput,
    createEventInputSchema,
    getByCategoryInputSchema,
    getByIdInputSchema,
    getByLocationIdInputSchema,
    getByOrganizerIdInputSchema,
    getBySlugInputSchema,
    getFeaturedInputSchema,
    getUpcomingInputSchema,
    listEventsInputSchema,
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
 * Soft-deletes (archives) an event by ID.
 * Only the author, admin, or a user with the required permission can delete.
 * Handles edge-cases: public user, disabled user, already archived/deleted, etc.
 *
 * @param input - The input object with the event ID.
 * @param actor - The user or public actor attempting the soft-delete.
 * @returns An object with the deleted (archived) event, or null if not found or not allowed.
 * @throws Error if the actor is not allowed to delete or input is invalid.
 * @example
 * const result = await softDelete({ id: 'event-1' }, user);
 */
export const softDelete = async (
    input: GetByIdInput,
    actor: UserType | PublicUserType
): Promise<{ event: EventType | null }> => {
    logMethodStart(dbLogger, 'delete', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const event = (await EventModel.getById(parsedInput.id)) ?? null;
    if (!event) {
        logMethodEnd(dbLogger, 'delete', { event: null });
        throw new Error('Event not found');
    }
    try {
        assertNotArchived(event);
    } catch (err) {
        logMethodEnd(dbLogger, 'delete', { event: null });
        throw err;
    }
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(dbLogger, safeActor, input, event, 'User disabled', PermissionEnum.EVENT_DELETE);
        logMethodEnd(dbLogger, 'delete', { event: null });
        throw new Error('user disabled');
    }
    // Author, admin, or user with permission can delete
    const isAuthor = 'id' in safeActor && event.authorId === safeActor.id;
    const allowed =
        isAuthor ||
        safeActor.role === RoleEnum.ADMIN ||
        safeActor.role === RoleEnum.SUPER_ADMIN ||
        hasPermission(safeActor, PermissionEnum.EVENT_DELETE);
    if (!allowed) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            event,
            'Permission denied',
            PermissionEnum.EVENT_DELETE
        );
        logMethodEnd(dbLogger, 'delete', { event: null });
        throw new Error('Permission denied: EVENT_DELETE');
    }
    const updateInput = buildSoftDeleteUpdate(safeActor);
    const updatedEvent = await EventModel.update(parsedInput.id, updateInput);
    if (!updatedEvent) {
        logMethodEnd(dbLogger, 'delete', { event: null });
        throw new Error('Event delete failed');
    }
    logMethodEnd(dbLogger, 'delete', { event: updatedEvent });
    return { event: updatedEvent };
};

/**
 * Restores a previously soft-deleted (archived) event by ID.
 * Only admin, superadmin, or a user with permission can restore.
 * Handles edge-cases: disabled user, public user, not archived, no permission, not found, model error.
 *
 * @param input - The input object with the event ID.
 * @param actor - The user or public actor attempting the restore.
 * @returns An object with the restored event, or null if not found or not allowed.
 * @throws Error if not allowed or fails.
 * @example
 * const result = await restore({ id: 'event-1' }, admin);
 */
export const restore = async (
    input: { id: string },
    actor: UserType | PublicUserType
): Promise<{ event: EventType | null }> => {
    logMethodStart(dbLogger, 'restore', input, actor);
    const safeActor = getSafeActor(actor);
    // Disabled user
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'User disabled',
            PermissionEnum.EVENT_RESTORE
        );
        logMethodEnd(dbLogger, 'restore', { event: null });
        throw new Error('Forbidden: user disabled');
    }
    // Public user (GUEST)
    if (safeActor.role === RoleEnum.GUEST) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'Permission denied',
            PermissionEnum.EVENT_RESTORE
        );
        logMethodEnd(dbLogger, 'restore', { event: null });
        throw new Error('Forbidden: public user cannot restore events');
    }
    // Only admin, superadmin, or user with permission
    const allowed =
        safeActor.role === RoleEnum.ADMIN ||
        safeActor.role === RoleEnum.SUPER_ADMIN ||
        hasPermission(safeActor, PermissionEnum.EVENT_RESTORE);
    if (!allowed) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'Permission denied',
            PermissionEnum.EVENT_RESTORE
        );
        logMethodEnd(dbLogger, 'restore', { event: null });
        throw new Error('Forbidden: user does not have permission to restore event');
    }
    // Find event
    const event = await EventModel.getById(input.id);
    if (!event) {
        logMethodEnd(dbLogger, 'restore', { event: null });
        throw new Error('Event not found');
    }
    // Only archived events can be restored
    if (event.lifecycleState === LifecycleStatusEnum.ACTIVE) {
        logMethodEnd(dbLogger, 'restore', { event: null });
        throw new Error('Event is not archived');
    }
    // Execute restore
    const updateInput = buildRestoreUpdate(safeActor);
    let updatedEvent: EventType | null = null;
    try {
        const result = await EventModel.update(input.id, updateInput);
        updatedEvent = result ?? null;
    } catch (_err) {
        logMethodEnd(dbLogger, 'restore', { event: null });
        throw new Error('Event restore failed');
    }
    logMethodEnd(dbLogger, 'restore', { event: updatedEvent });
    return { event: updatedEvent };
};

/**
 * Hard-deletes (permanently deletes) an event by ID.
 * Only admin, superadmin, or a user with permission can hard-delete.
 * Handles edge-cases: disabled user, public user, no permission, not found, model error.
 *
 * @param input - The input object with the event ID.
 * @param actor - The user or public actor attempting the hard-delete.
 * @returns An object with { success: boolean }.
 * @throws Error if not allowed or fails.
 * @example
 * const result = await hardDelete({ id: 'event-1' }, admin);
 */
export const hardDelete = async (
    input: { id: string },
    actor: UserType | PublicUserType
): Promise<{ success: boolean }> => {
    logMethodStart(dbLogger, 'hardDelete', input, actor);
    const safeActor = getSafeActor(actor);
    // Disabled user
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'User disabled',
            PermissionEnum.EVENT_HARD_DELETE
        );
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: user disabled');
    }
    // Public user (GUEST)
    if (safeActor.role === RoleEnum.GUEST) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'Permission denied',
            PermissionEnum.EVENT_HARD_DELETE
        );
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: public user cannot hard-delete events');
    }
    // Only admin, superadmin, or user with permission
    const allowed =
        safeActor.role === RoleEnum.ADMIN ||
        safeActor.role === RoleEnum.SUPER_ADMIN ||
        hasPermission(safeActor, PermissionEnum.EVENT_HARD_DELETE);
    if (!allowed) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: VisibilityEnum.PUBLIC },
            'Permission denied',
            PermissionEnum.EVENT_HARD_DELETE
        );
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: user does not have permission to hard-delete event');
    }
    // Find event
    const event = await EventModel.getById(input.id);
    if (!event) {
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Event not found');
    }
    // Execute hard delete
    let deleted = false;
    try {
        deleted = await EventModel.hardDelete(input.id);
    } catch (_err) {
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Event hard delete failed');
    }
    logMethodEnd(dbLogger, 'hardDelete', { success: deleted });
    return { success: deleted };
};

/**
 * Lists events with optional filters and pagination, applying permission checks and logging.
 * - Admins can view all events.
 * - Regular users can view public/active events, or private if they have permission.
 * - Disabled users cannot view any event.
 *
 * @param input - Object with optional limit, offset, and filters.
 * @param actor - The user or public actor requesting the events.
 * @returns An object with the events array (may be empty).
 * @example
 *   const { events } = await list({ limit: 10, offset: 0 }, user);
 */
export const list = async (input: ListEventsInput, actor: unknown): Promise<ListEventsOutput> => {
    logMethodStart(dbLogger, 'list', input, actor as object);
    const parsedInput = listEventsInputSchema.parse(input);
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            { visibility: parsedInput.filters?.visibility || VisibilityEnum.PUBLIC },
            'User disabled',
            undefined
        );
        logMethodEnd(dbLogger, 'list', { events: [] });
        return { events: [] };
    }
    // Retrieve events with filters and pagination
    const allEvents = await EventModel.search({
        ...parsedInput.filters,
        limit: parsedInput.limit ?? 20,
        offset: parsedInput.offset ?? 0
    });
    // Filter by permissions and visibility rules
    const isAdmin = safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
    const canViewPrivate = isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
    const filtered = allEvents.filter((event) => {
        if (isAdmin) {
            // Admins see all
            return true;
        }
        if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
            // Only admins see archived/deleted
            return false;
        }
        if (event.visibility === VisibilityEnum.PUBLIC) {
            return true;
        }
        if (event.visibility === VisibilityEnum.PRIVATE && canViewPrivate) {
            return true;
        }
        return false;
    });
    logMethodEnd(dbLogger, 'list', { events: filtered });
    return { events: filtered };
};

/**
 * Gets events by organizer ID, applying permission checks, filters, and logging.
 * - Admins can view all events for the organizer.
 * - Regular users can view public/active events, or private if they have permission.
 * - Disabled users cannot view any event.
 *
 * @param input - Object with organizerId, optional limit and offset.
 * @param actor - The user or public actor requesting the events.
 * @returns An object with the events array (may be empty).
 * @example
 *   const { events } = await getByOrganizerId({ organizerId: 'org-1', limit: 10 }, user);
 */
export const getByOrganizerId = async (
    input: GetByOrganizerIdInput,
    actor: unknown
): Promise<GetByOrganizerIdOutput> => {
    logMethodStart(dbLogger, 'getByOrganizerId', input, actor as object);
    const parsedInput = getByOrganizerIdInputSchema.parse(input);
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
        logMethodEnd(dbLogger, 'getByOrganizerId', { events: [] });
        return { events: [] };
    }
    // Retrieve events by organizerId with pagination
    const allEvents = await EventModel.search({
        organizerId: parsedInput.organizerId,
        limit: parsedInput.limit ?? 20,
        offset: parsedInput.offset ?? 0
    });
    // Filter by permissions and visibility rules (same as list)
    const isAdmin = safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
    const canViewPrivate = isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
    const filtered = allEvents.filter((event) => {
        if (isAdmin) {
            return true;
        }
        if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
            return false;
        }
        if (event.visibility === VisibilityEnum.PUBLIC) {
            return true;
        }
        if (event.visibility === VisibilityEnum.PRIVATE && canViewPrivate) {
            return true;
        }
        return false;
    });
    logMethodEnd(dbLogger, 'getByOrganizerId', { events: filtered });
    return { events: filtered };
};

/**
 * Gets events by category, applying permission checks, filters, and logging.
 * - Admins can view all events for the category.
 * - Regular users can view public/active events, or private if they have permission.
 * - Disabled users cannot view any event.
 *
 * @param input - Object with category, optional limit and offset.
 * @param actor - The user or public actor requesting the events.
 * @returns An object with the events array (may be empty).
 * @example
 *   const { events } = await getByCategory({ category: 'FESTIVAL', limit: 10 }, user);
 */
export const getByCategory = async (
    input: GetByCategoryInput,
    actor: unknown
): Promise<GetByCategoryOutput> => {
    logMethodStart(dbLogger, 'getByCategory', input, actor as object);
    const parsedInput = getByCategoryInputSchema.parse(input);
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
        logMethodEnd(dbLogger, 'getByCategory', { events: [] });
        return { events: [] };
    }
    // Retrieve events by category with pagination
    const allEvents = await EventModel.search({
        category: parsedInput.category,
        limit: parsedInput.limit ?? 20,
        offset: parsedInput.offset ?? 0
    });
    // Filter by permissions and visibility rules (same as list)
    const isAdmin = safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
    const canViewPrivate = isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
    const filtered = allEvents.filter((event) => {
        if (isAdmin) {
            return true;
        }
        if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
            return false;
        }
        if (event.visibility === VisibilityEnum.PUBLIC) {
            return true;
        }
        if (event.visibility === VisibilityEnum.PRIVATE && canViewPrivate) {
            return true;
        }
        return false;
    });
    logMethodEnd(dbLogger, 'getByCategory', { events: filtered });
    return { events: filtered };
};

/**
 * Gets featured events, applying permission checks, filters, and logging.
 * - Admins can view all featured events.
 * - Regular users can view public/active featured events, or private if they have permission.
 * - Disabled users cannot view any event.
 *
 * @param input - Object with optional limit and offset.
 * @param actor - The user or public actor requesting the events.
 * @returns An object with the featured events array (may be empty).
 * @example
 *   const { events } = await getFeatured({ limit: 10 }, user);
 */
export const getFeatured = async (
    input: GetFeaturedInput,
    actor: unknown
): Promise<GetFeaturedOutput> => {
    logMethodStart(dbLogger, 'getFeatured', input, actor as object);
    const parsedInput = getFeaturedInputSchema.parse(input);
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
        logMethodEnd(dbLogger, 'getFeatured', { events: [] });
        return { events: [] };
    }
    // Retrieve featured events with pagination
    const allEvents = await EventModel.search({
        isFeatured: true,
        limit: parsedInput.limit ?? 20,
        offset: parsedInput.offset ?? 0
    });
    // Filter by permissions and visibility rules (same as list)
    const isAdmin = safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
    const canViewPrivate = isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
    const filtered = allEvents.filter((event) => {
        if (isAdmin) {
            return true;
        }
        if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
            return false;
        }
        if (event.visibility === VisibilityEnum.PUBLIC) {
            return true;
        }
        if (event.visibility === VisibilityEnum.PRIVATE && canViewPrivate) {
            return true;
        }
        return false;
    });
    logMethodEnd(dbLogger, 'getFeatured', { events: filtered });
    return { events: filtered };
};

/**
 * Gets upcoming events (start date >= now), applying permission checks, filters, and logging.
 * - Admins can view all upcoming events.
 * - Regular users can view public/active upcoming events, or private if they have permission.
 * - Disabled users cannot view any event.
 *
 * @param input - Object with optional limit and offset.
 * @param actor - The user or public actor requesting the events.
 * @returns An object with the upcoming events array (may be empty).
 * @example
 *   const { events } = await getUpcoming({ limit: 10 }, user);
 */
export const getUpcoming = async (
    input: GetUpcomingInput,
    actor: unknown
): Promise<GetUpcomingOutput> => {
    logMethodStart(dbLogger, 'getUpcoming', input, actor as object);
    const parsedInput = getUpcomingInputSchema.parse(input);
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
        logMethodEnd(dbLogger, 'getUpcoming', { events: [] });
        return { events: [] };
    }
    // Retrieve upcoming events with pagination (start date >= now)
    // TODO: Add support for filtering by start date >= now in EventModel.search
    const allEvents = await EventModel.search({
        limit: parsedInput.limit ?? 20,
        offset: parsedInput.offset ?? 0
    });
    // Filter by permissions and visibility rules (same as list)
    const isAdmin = safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
    const canViewPrivate = isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
    const filtered = allEvents.filter((event) => {
        if (isAdmin) {
            return true;
        }
        if (event.lifecycleState !== LifecycleStatusEnum.ACTIVE) {
            return false;
        }
        if (event.visibility === VisibilityEnum.PUBLIC) {
            return true;
        }
        if (event.visibility === VisibilityEnum.PRIVATE && canViewPrivate) {
            return true;
        }
        return false;
    });
    logMethodEnd(dbLogger, 'getUpcoming', { events: filtered });
    return { events: filtered };
};

/**
 * Gets events within a date range.
 * @throws Error (not implemented).
 */
export const getByDateRange = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

// --- FUTURE METHODS (stubs) ---

/**
 * Gets events by author ID.
 * @throws Error (not implemented).
 */
export const getByAuthorId = async (_input: unknown, _actor: unknown): Promise<never> => {
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
 * Searches for events based on advanced filters.
 * @throws Error (not implemented).
 */
export const search = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};
