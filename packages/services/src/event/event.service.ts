import { EventModel } from '@repo/db';
import type { EventType, PublicUserType, UpdateEventInputType, UserType } from '@repo/types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
import { hasPermission } from '../utils';
import { logDenied, logGrant } from '../utils/permission-logger';
import {
    CanViewReasonEnum,
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../utils/service-helper';
import { serviceLogger } from '../utils/service-logger';
import {
    canViewEvent,
    eventAssertNotArchived,
    eventBuildRestoreUpdate,
    eventBuildSoftDeleteUpdate,
    eventNormalizeCreateInput
} from './event.helper';
import {
    type EventCreateInput,
    EventCreateInputSchema,
    type EventCreateOutput,
    type EventGetByCategoryInput,
    EventGetByCategoryInputSchema,
    type EventGetByCategoryOutput,
    type EventGetByDateRangeInput,
    EventGetByDateRangeInputSchema,
    type EventGetByDateRangeOutput,
    type EventGetByIdInput,
    EventGetByIdInputSchema,
    type EventGetByIdOutput,
    type EventGetByLocationIdInput,
    EventGetByLocationIdInputSchema,
    type EventGetByLocationIdOutput,
    type EventGetByOrganizerIdInput,
    EventGetByOrganizerIdInputSchema,
    type EventGetByOrganizerIdOutput,
    type EventGetBySlugInput,
    EventGetBySlugInputSchema,
    type EventGetBySlugOutput,
    type EventGetFeaturedInput,
    EventGetFeaturedInputSchema,
    type EventGetFeaturedOutput,
    type EventGetUpcomingInput,
    EventGetUpcomingInputSchema,
    type EventGetUpcomingOutput,
    type EventListInput,
    EventListInputSchema,
    type EventListOutput,
    type EventUpdateInput,
    EventUpdateInputSchema,
    type EventUpdateOutput
} from './event.schemas';

export const EventService = {
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
     *   const { event } = await EventService.getById({ id: 'event-123' }, adminUser);
     */
    async getById(input: EventGetByIdInput, actor: unknown): Promise<EventGetByIdOutput> {
        logMethodStart(serviceLogger, 'getById', input, actor as object);
        const parsedInput = EventGetByIdInputSchema.parse(input);
        const event = (await EventModel.getById(parsedInput.id)) ?? null;
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getById', { event: null });
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
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(serviceLogger, 'getById', { event: null });
            throw new Error(`Unknown event visibility: ${event ? event.visibility : 'null'}`);
        }
        if (reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(serviceLogger, 'getById', { event: null });
            return { event: null };
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                hasPermission(safeActor, checkedPermission);
                if (event && event.visibility !== VisibilityEnum.PUBLIC) {
                    logGrant(serviceLogger, safeActor, input, event, checkedPermission, reason);
                }
                logMethodEnd(serviceLogger, 'getById', { event });
                return { event };
            } catch {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    event ?? { visibility: VisibilityEnum.PUBLIC },
                    reason,
                    checkedPermission
                );
                logMethodEnd(serviceLogger, 'getById', { event: null });
                return { event: null };
            }
        }
        if (!canView) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(serviceLogger, 'getById', { event: null });
            return { event: null };
        }
        if (event && event.visibility !== VisibilityEnum.PUBLIC) {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                event,
                checkedPermission ?? PermissionEnum.EVENT_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getById', { event });
        return { event };
    },
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
     *   const { event } = await EventService.getBySlug({ slug: 'event-slug' }, adminUser);
     */
    async getBySlug(input: EventGetBySlugInput, actor: unknown): Promise<EventGetBySlugOutput> {
        logMethodStart(serviceLogger, 'getBySlug', input, actor as object);
        const parsedInput = EventGetBySlugInputSchema.parse(input);
        const event = (await EventModel.getBySlug(parsedInput.slug)) ?? null;
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getBySlug', { event: null });
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
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(serviceLogger, 'getBySlug', { event: null });
            throw new Error(`Unknown event visibility: ${event ? event.visibility : 'null'}`);
        }
        if (reason === CanViewReasonEnum.PUBLIC_ACTOR_DENIED) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(serviceLogger, 'getBySlug', { event: null });
            return { event: null };
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                hasPermission(safeActor, checkedPermission);
                if (event && event.visibility !== VisibilityEnum.PUBLIC) {
                    logGrant(serviceLogger, safeActor, input, event, checkedPermission, reason);
                }
                logMethodEnd(serviceLogger, 'getBySlug', { event });
                return { event };
            } catch {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    event ?? { visibility: VisibilityEnum.PUBLIC },
                    reason,
                    checkedPermission
                );
                logMethodEnd(serviceLogger, 'getBySlug', { event: null });
                return { event: null };
            }
        }
        if (!canView) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event ?? { visibility: VisibilityEnum.PUBLIC },
                reason,
                checkedPermission
            );
            logMethodEnd(serviceLogger, 'getBySlug', { event: null });
            return { event: null };
        }
        if (event && event.visibility !== VisibilityEnum.PUBLIC) {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                event,
                checkedPermission ?? PermissionEnum.EVENT_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getBySlug', { event });
        return { event };
    },
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
     *   const { events } = await EventService.getByLocationId({ locationId: 'loc-1' }, user);
     */
    async getByLocationId(
        input: EventGetByLocationIdInput,
        actor: unknown
    ): Promise<EventGetByLocationIdOutput> {
        logMethodStart(serviceLogger, 'getByLocationId', input, actor as object);
        const parsedInput = EventGetByLocationIdInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getByLocationId', { events: [] });
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
            serviceLogger,
            safeActor,
            input,
            { visibility: filtered[0]?.visibility || VisibilityEnum.PUBLIC },
            PermissionEnum.EVENT_VIEW_PRIVATE,
            'Events by locationId'
        );
        logMethodEnd(serviceLogger, 'getByLocationId', { events: filtered });
        return { events: filtered };
    },
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
     *   const { event } = await EventService.create({ ... }, user);
     */
    async create(input: EventCreateInput, actor: unknown): Promise<EventCreateOutput> {
        logMethodStart(serviceLogger, 'create', input, actor as object);
        const parsedInput = EventCreateInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'create', { event: null });
            throw new Error('User is disabled');
        }
        // Permiso: EVENT_CREATE
        const allowed =
            safeActor.role === 'ADMIN' ||
            safeActor.role === 'SUPER_ADMIN' ||
            hasPermission(safeActor, PermissionEnum.EVENT_CREATE);
        if (!allowed) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility },
                'Permission denied',
                PermissionEnum.EVENT_CREATE
            );
            logMethodEnd(serviceLogger, 'create', { event: null });
            throw new Error('Permission denied: EVENT_CREATE');
        }
        // Unicidad de slug
        const existing = await EventModel.getBySlug(parsedInput.slug);
        if (existing) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility },
                'Slug already exists',
                undefined
            );
            logMethodEnd(serviceLogger, 'create', { event: null });
            throw new Error('Slug already exists');
        }
        // Normaliza el input como en los otros servicios
        const normalizedInput = eventNormalizeCreateInput(parsedInput);
        // Crear evento
        const event = await EventModel.create({
            ...normalizedInput,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.PENDING_REVIEW
        });
        logGrant(
            serviceLogger,
            safeActor,
            input,
            event,
            PermissionEnum.EVENT_CREATE,
            'Event created'
        );
        logMethodEnd(serviceLogger, 'create', { event });
        return { event };
    },
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
     *   const { event } = await EventService.update({ id: 'event-1', summary: 'Updated' }, user);
     */
    async update(input: EventUpdateInput, actor: unknown): Promise<EventUpdateOutput> {
        logMethodStart(serviceLogger, 'update', input, actor as object);
        const parsedInput = EventUpdateInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility || '' },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'update', { event: null });
            throw new Error('User is disabled');
        }
        // Permission: EVENT_UPDATE
        const allowed =
            safeActor.role === 'ADMIN' ||
            safeActor.role === 'SUPER_ADMIN' ||
            hasPermission(safeActor, PermissionEnum.EVENT_UPDATE);
        if (!allowed) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility || '' },
                'Permission denied',
                PermissionEnum.EVENT_UPDATE
            );
            logMethodEnd(serviceLogger, 'update', { event: null });
            throw new Error('Permission denied: EVENT_UPDATE');
        }
        // Find existing event
        const existing = await EventModel.getById(parsedInput.id);
        if (!existing) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility || '' },
                'Event not found',
                undefined
            );
            logMethodEnd(serviceLogger, 'update', { event: null });
            throw new Error('Event not found');
        }
        // If updating slug, check uniqueness
        if (parsedInput.slug && parsedInput.slug !== existing.slug) {
            const slugExists = await EventModel.getBySlug(parsedInput.slug);
            if (slugExists) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    { visibility: parsedInput.visibility || '' },
                    'Slug already exists',
                    undefined
                );
                logMethodEnd(serviceLogger, 'update', { event: null });
                throw new Error('Slug already exists');
            }
        }
        // Normalize input (same as in create)
        const normalizedInput = { ...parsedInput } as UpdateEventInputType;
        // Update event
        const updated = await EventModel.update(parsedInput.id, normalizedInput);
        if (!updated) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.visibility || '' },
                'Update failed',
                undefined
            );
            logMethodEnd(serviceLogger, 'update', { event: null });
            throw new Error('Event update failed');
        }
        logGrant(
            serviceLogger,
            safeActor,
            input,
            updated,
            PermissionEnum.EVENT_UPDATE,
            'Event updated'
        );
        logMethodEnd(serviceLogger, 'update', { event: updated });
        return { event: updated };
    },
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
     * const result = await EventService.softDelete({ id: 'event-1' }, user);
     */
    async softDelete(
        input: EventGetByIdInput,
        actor: UserType | PublicUserType
    ): Promise<{ event: EventType | null }> {
        logMethodStart(serviceLogger, 'delete', input, actor);
        const parsedInput = EventGetByIdInputSchema.parse(input);
        const event = (await EventModel.getById(parsedInput.id)) ?? null;
        if (!event) {
            logMethodEnd(serviceLogger, 'delete', { event: null });
            throw new Error('Event not found');
        }
        try {
            eventAssertNotArchived(event);
        } catch (err) {
            logMethodEnd(serviceLogger, 'delete', { event: null });
            throw err;
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                event,
                'User disabled',
                PermissionEnum.EVENT_DELETE
            );
            logMethodEnd(serviceLogger, 'delete', { event: null });
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
                serviceLogger,
                safeActor,
                input,
                event,
                'Permission denied',
                PermissionEnum.EVENT_DELETE
            );
            logMethodEnd(serviceLogger, 'delete', { event: null });
            throw new Error('Permission denied: EVENT_DELETE');
        }
        const updateInput = eventBuildSoftDeleteUpdate(safeActor);
        const updatedEvent = await EventModel.update(parsedInput.id, updateInput);
        if (!updatedEvent) {
            logMethodEnd(serviceLogger, 'delete', { event: null });
            throw new Error('Event delete failed');
        }
        logMethodEnd(serviceLogger, 'delete', { event: updatedEvent });
        return { event: updatedEvent };
    },
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
     * const result = await EventService.restore({ id: 'event-1' }, admin);
     */
    async restore(
        input: { id: string },
        actor: UserType | PublicUserType
    ): Promise<{ event: EventType | null }> {
        logMethodStart(serviceLogger, 'restore', input, actor);
        const safeActor = getSafeActor(actor);
        // Disabled user
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                PermissionEnum.EVENT_RESTORE
            );
            logMethodEnd(serviceLogger, 'restore', { event: null });
            throw new Error('Forbidden: user disabled');
        }
        // Public user (GUEST)
        if (safeActor.role === RoleEnum.GUEST) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'Permission denied',
                PermissionEnum.EVENT_RESTORE
            );
            logMethodEnd(serviceLogger, 'restore', { event: null });
            throw new Error('Forbidden: public user cannot restore events');
        }
        // Only admin, superadmin, or user with permission
        const allowed =
            safeActor.role === RoleEnum.ADMIN ||
            safeActor.role === RoleEnum.SUPER_ADMIN ||
            hasPermission(safeActor, PermissionEnum.EVENT_RESTORE);
        if (!allowed) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'Permission denied',
                PermissionEnum.EVENT_RESTORE
            );
            logMethodEnd(serviceLogger, 'restore', { event: null });
            throw new Error('Forbidden: user does not have permission to restore event');
        }
        // Find event
        const event = await EventModel.getById(input.id);
        if (!event) {
            logMethodEnd(serviceLogger, 'restore', { event: null });
            throw new Error('Event not found');
        }
        // Only archived events can be restored
        if (event.lifecycleState === LifecycleStatusEnum.ACTIVE) {
            logMethodEnd(serviceLogger, 'restore', { event: null });
            throw new Error('Event is not archived');
        }
        // Execute restore
        const updateInput = eventBuildRestoreUpdate(safeActor);
        let updatedEvent: EventType | null = null;
        try {
            const result = await EventModel.update(input.id, updateInput);
            updatedEvent = result ?? null;
        } catch (_err) {
            logMethodEnd(serviceLogger, 'restore', { event: null });
            throw new Error('Event restore failed');
        }
        logMethodEnd(serviceLogger, 'restore', { event: updatedEvent });
        return { event: updatedEvent };
    },
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
     * const result = await EventService.hardDelete({ id: 'event-1' }, admin);
     */
    async hardDelete(
        input: { id: string },
        actor: UserType | PublicUserType
    ): Promise<{ success: boolean }> {
        logMethodStart(serviceLogger, 'hardDelete', input, actor);
        const safeActor = getSafeActor(actor);
        // Disabled user
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                PermissionEnum.EVENT_HARD_DELETE
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: user disabled');
        }
        // Public user (GUEST)
        if (safeActor.role === RoleEnum.GUEST) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'Permission denied',
                PermissionEnum.EVENT_HARD_DELETE
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: public user cannot hard-delete events');
        }
        // Only admin, superadmin, or user with permission
        const allowed =
            safeActor.role === RoleEnum.ADMIN ||
            safeActor.role === RoleEnum.SUPER_ADMIN ||
            hasPermission(safeActor, PermissionEnum.EVENT_HARD_DELETE);
        if (!allowed) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'Permission denied',
                PermissionEnum.EVENT_HARD_DELETE
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: user does not have permission to hard-delete event');
        }
        // Find event
        const event = await EventModel.getById(input.id);
        if (!event) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Event not found');
        }
        // Execute hard delete
        let deleted = false;
        try {
            deleted = await EventModel.hardDelete(input.id);
        } catch (_err) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Event hard delete failed');
        }
        logMethodEnd(serviceLogger, 'hardDelete', { success: deleted });
        return { success: deleted };
    },
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
     *   const { events } = await EventService.list({ limit: 10, offset: 0 }, user);
     */
    async list(input: EventListInput, actor: unknown): Promise<EventListOutput> {
        logMethodStart(serviceLogger, 'list', input, actor as object);
        const parsedInput = EventListInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: parsedInput.filters?.visibility || VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'list', { events: [] });
            return { events: [] };
        }
        // Retrieve events with filters and pagination
        const allEvents = await EventModel.search({
            ...parsedInput.filters,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            minDate: parsedInput.minDate,
            maxDate: parsedInput.maxDate
        });
        // Filter by permissions and visibility rules
        const isAdmin =
            safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
        const canViewPrivate =
            isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
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
        logMethodEnd(serviceLogger, 'list', { events: filtered });
        return { events: filtered };
    },
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
     *   const { events } = await EventService.getByOrganizerId({ organizerId: 'org-1', limit: 10 }, user);
     */
    async getByOrganizerId(
        input: EventGetByOrganizerIdInput,
        actor: unknown
    ): Promise<EventGetByOrganizerIdOutput> {
        logMethodStart(serviceLogger, 'getByOrganizerId', input, actor as object);
        const parsedInput = EventGetByOrganizerIdInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getByOrganizerId', { events: [] });
            return { events: [] };
        }
        // Retrieve events by organizerId with pagination
        const allEvents = await EventModel.search({
            organizerId: parsedInput.organizerId,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            minDate: parsedInput.minDate,
            maxDate: parsedInput.maxDate
        });
        // Filter by permissions and visibility rules (same as list)
        const isAdmin =
            safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
        const canViewPrivate =
            isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
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
        logMethodEnd(serviceLogger, 'getByOrganizerId', { events: filtered });
        return { events: filtered };
    },
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
     *   const { events } = await EventService.getByCategory({ category: 'FESTIVAL', limit: 10 }, user);
     */
    async getByCategory(
        input: EventGetByCategoryInput,
        actor: unknown
    ): Promise<EventGetByCategoryOutput> {
        logMethodStart(serviceLogger, 'getByCategory', input, actor as object);
        const parsedInput = EventGetByCategoryInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getByCategory', { events: [] });
            return { events: [] };
        }
        // Retrieve events by category with pagination
        const allEvents = await EventModel.search({
            category: parsedInput.category,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            minDate: parsedInput.minDate,
            maxDate: parsedInput.maxDate
        });
        // Filter by permissions and visibility rules (same as list)
        const isAdmin =
            safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
        const canViewPrivate =
            isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
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
        logMethodEnd(serviceLogger, 'getByCategory', { events: filtered });
        return { events: filtered };
    },
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
     *   const { events } = await EventService.getFeatured({ limit: 10 }, user);
     */
    async getFeatured(
        input: EventGetFeaturedInput,
        actor: unknown
    ): Promise<EventGetFeaturedOutput> {
        logMethodStart(serviceLogger, 'getFeatured', input, actor as object);
        const parsedInput = EventGetFeaturedInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getFeatured', { events: [] });
            return { events: [] };
        }
        // Retrieve featured events with pagination
        const allEvents = await EventModel.search({
            isFeatured: true,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0
        });
        // Filter by permissions and visibility rules (same as list)
        const isAdmin =
            safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
        const canViewPrivate =
            isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
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
        logMethodEnd(serviceLogger, 'getFeatured', { events: filtered });
        return { events: filtered };
    },
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
     *   const { events } = await EventService.getUpcoming({ limit: 10 }, user);
     */
    async getUpcoming(
        input: EventGetUpcomingInput,
        actor: unknown
    ): Promise<EventGetUpcomingOutput> {
        logMethodStart(serviceLogger, 'getUpcoming', input, actor as object);
        const parsedInput = EventGetUpcomingInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getUpcoming', { events: [] });
            return { events: [] };
        }
        // Retrieve upcoming events with pagination (start date >= now, or custom minDate/maxDate)
        const now = new Date();
        const allEvents = await EventModel.search({
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            minDate: parsedInput.minDate ?? now,
            maxDate: parsedInput.maxDate
        });
        // Filter by permissions and visibility rules (same as list)
        const isAdmin =
            safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
        const canViewPrivate =
            isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
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
        logMethodEnd(serviceLogger, 'getUpcoming', { events: filtered });
        return { events: filtered };
    },
    /**
     * Gets events within a date range (date.start >= minDate && date.start <= maxDate), applying permission checks, filters, and logging.
     * - Admins can view all events in the range.
     * - Regular users can view public/active events, or private if they have permission.
     * - Disabled users cannot view any event.
     *
     * @param input - Object with minDate, maxDate, optional limit and offset.
     * @param actor - The user or public actor requesting the events.
     * @returns An object with the events array (may be empty).
     * @example
     *   const { events } = await EventService.getByDateRange({ minDate, maxDate, limit: 10 }, user);
     */
    async getByDateRange(
        input: EventGetByDateRangeInput,
        actor: unknown
    ): Promise<EventGetByDateRangeOutput> {
        logMethodStart(serviceLogger, 'getByDateRange', input, actor as object);
        const parsedInput = EventGetByDateRangeInputSchema.parse(input);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: VisibilityEnum.PUBLIC },
                'User disabled',
                undefined
            );
            logMethodEnd(serviceLogger, 'getByDateRange', { events: [] });
            return { events: [] };
        }
        // Retrieve events within the date range
        const allEvents = await EventModel.search({
            minDate: parsedInput.minDate,
            maxDate: parsedInput.maxDate,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0
        });
        // Filter by permissions and visibility rules (same as list)
        const isAdmin =
            safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN;
        const canViewPrivate =
            isAdmin || hasPermission(safeActor, PermissionEnum.EVENT_VIEW_PRIVATE);
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
        logMethodEnd(serviceLogger, 'getByDateRange', { events: filtered });
        return { events: filtered };
    },
    /**
     * Gets events by author ID.
     * @throws Error (not implemented).
     */
    async getByAuthorId(): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets past events.
     * @throws Error (not implemented).
     */
    async getPast(): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Searches for events based on advanced filters.
     * @throws Error (not implemented).
     */
    async search(): Promise<never> {
        throw new Error('Not implemented yet');
    }
};
