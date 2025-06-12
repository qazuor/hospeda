// Destination Service - MVP and Future Methods (stubs)
// All methods use RO-RO pattern and throw 'Not implemented yet' for now.

import { DestinationModel, DestinationReviewModel } from '@repo/db';
import type { UserId } from '@repo/types';
import { PermissionEnum, RoleEnum } from '@repo/types';
import { logDenied, logGrant, logUserDisabled } from '../utils/permission-logger';
import { hasPermission } from '../utils/permission-manager';
import {
    CanViewReasonEnum,
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../utils/service-helper';
import { serviceLogger } from '../utils/service-logger';
import {
    canViewDestination,
    destinationAssertNotActive,
    destinationAssertNotArchived,
    destinationBuildRestoreUpdate,
    destinationBuildSoftDeleteUpdate,
    destinationNormalizeCreateInput,
    destinationNormalizeUpdateInput
} from './destination.helper';
import {
    type DestinationCreateInput,
    DestinationCreateInputSchema,
    type DestinationCreateOutput,
    type DestinationGetByIdInput,
    DestinationGetByIdInputSchema,
    type DestinationGetByIdOutput,
    type DestinationGetByNameInput,
    DestinationGetByNameInputSchema,
    type DestinationGetByNameOutput,
    type DestinationGetBySlugInput,
    DestinationGetBySlugInputSchema,
    type DestinationGetBySlugOutput,
    type DestinationGetReviewsInput,
    DestinationGetReviewsInputSchema,
    type DestinationGetReviewsOutput,
    type DestinationListInput,
    DestinationListInputSchema,
    type DestinationListOutput,
    type DestinationSearchInput,
    DestinationSearchInputSchema,
    type DestinationSearchOutput,
    type DestinationUpdateInput,
    DestinationUpdateInputSchema,
    type DestinationUpdateOutput
} from './destination.schemas';

export const DestinationService = {
    /**
     * Gets a destination by its ID. (MVP)
     * Handles edge-cases: public user, disabled user, unknown visibility.
     * Always uses RO-RO pattern for input/output.
     *
     * Why: Centralizes access and logging logic, prevents information leaks, and ensures traceability.
     *
     * @param input - The input object containing the destination ID.
     * @param actor - The user or public actor requesting the destination.
     * @returns An object with the destination or null if not accessible.
     * @throws Error if the destination has unknown visibility.
     */
    async getById(
        input: DestinationGetByIdInput,
        actor: unknown
    ): Promise<DestinationGetByIdOutput> {
        logMethodStart(serviceLogger, 'getById', input, actor as object);
        const parsedInput = DestinationGetByIdInputSchema.parse(input);
        const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'getById', { destination: null });
            return { destination: null };
        }
        const safeActor = getSafeActor(actor);
        let checkedPermission: import('@repo/types').PermissionEnum | undefined;
        const {
            canView,
            reason,
            checkedPermission: checkedPerm
        } = canViewDestination(safeActor, destination);
        checkedPermission = checkedPerm;
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
            );
            logMethodEnd(serviceLogger, 'getById', { destination: null });
            return { destination: null };
        }
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getById', { destination: null });
            throw new Error(`Unknown destination visibility: ${destination.visibility}`);
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                const allowed = hasPermission(safeActor, checkedPermission);
                if (!allowed) throw new Error('Permission denied');
            } catch (_err) {
                logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
                logMethodEnd(serviceLogger, 'getById', { destination: null });
                return { destination: null };
            }
            if (destination.visibility !== 'PUBLIC') {
                logGrant(serviceLogger, safeActor, input, destination, checkedPermission, reason);
            }
            logMethodEnd(serviceLogger, 'getById', { destination });
            return { destination };
        }
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getById', { destination: null });
            return { destination: null };
        }
        if (destination.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getById', { destination });
        return { destination };
    },

    /**
     * Gets a destination by its slug.
     * Handles edge-cases: public user, disabled user, unknown visibility.
     * Always uses RO-RO pattern for input/output.
     *
     * Why: Allows safe and auditable search by slug, with the same robustness as getById.
     *
     * @param input - The input object containing the destination slug.
     * @param actor - The user or public actor requesting the destination.
     * @returns An object with the destination or null if not accessible.
     * @throws Error if the destination has unknown visibility.
     * @example
     * const result = await getBySlug({ slug: 'uruguay-destination' }, user);
     */
    async getBySlug(
        input: DestinationGetBySlugInput,
        actor: unknown
    ): Promise<DestinationGetBySlugOutput> {
        logMethodStart(serviceLogger, 'getBySlug', input, actor as object);
        const parsedInput = DestinationGetBySlugInputSchema.parse(input);
        const destination = (await DestinationModel.getBySlug(parsedInput.slug)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'getBySlug', { destination: null });
            return { destination: null };
        }
        const safeActor = getSafeActor(actor);
        let checkedPermission: import('@repo/types').PermissionEnum | undefined;
        const {
            canView,
            reason,
            checkedPermission: checkedPerm
        } = canViewDestination(safeActor, destination);
        checkedPermission = checkedPerm;
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
            );
            logMethodEnd(serviceLogger, 'getBySlug', { destination: null });
            return { destination: null };
        }
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getBySlug', { destination: null });
            throw new Error(`Unknown destination visibility: ${destination.visibility}`);
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                const allowed = hasPermission(safeActor, checkedPermission);
                if (!allowed) throw new Error('Permission denied');
            } catch (_err) {
                logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
                logMethodEnd(serviceLogger, 'getBySlug', { destination: null });
                return { destination: null };
            }
            if (destination.visibility !== 'PUBLIC') {
                logGrant(serviceLogger, safeActor, input, destination, checkedPermission, reason);
            }
            logMethodEnd(serviceLogger, 'getBySlug', { destination });
            return { destination };
        }
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getBySlug', { destination: null });
            return { destination: null };
        }
        if (destination.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getBySlug', { destination });
        return { destination };
    },

    /**
     * Gets a destination by its name.
     * Handles edge-cases: public user, disabled user, unknown visibility.
     * RO-RO pattern.
     *
     * @param input - Object with the destination name.
     * @param actor - User or public actor.
     * @returns Object with the destination or null if not accessible.
     * @throws Error if the visibility is unknown.
     */
    async getByName(
        input: DestinationGetByNameInput,
        actor: unknown
    ): Promise<DestinationGetByNameOutput> {
        logMethodStart(serviceLogger, 'getByName', input, actor as object);
        const parsedInput = DestinationGetByNameInputSchema.parse(input);
        const destination = (await DestinationModel.getByName(parsedInput.name)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'getByName', { destination: null });
            return { destination: null };
        }
        const safeActor = getSafeActor(actor);
        let checkedPermission: import('@repo/types').PermissionEnum | undefined;
        const {
            canView,
            reason,
            checkedPermission: checkedPerm
        } = canViewDestination(safeActor, destination);
        checkedPermission = checkedPerm;
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
            );
            logMethodEnd(serviceLogger, 'getByName', { destination: null });
            return { destination: null };
        }
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getByName', { destination: null });
            throw new Error(`Unknown destination visibility: ${destination.visibility}`);
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                const allowed = hasPermission(safeActor, checkedPermission);
                if (!allowed) throw new Error('Permission denied');
            } catch (_err) {
                logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
                logMethodEnd(serviceLogger, 'getByName', { destination: null });
                return { destination: null };
            }
            if (destination.visibility !== 'PUBLIC') {
                logGrant(serviceLogger, safeActor, input, destination, checkedPermission, reason);
            }
            logMethodEnd(serviceLogger, 'getByName', { destination });
            return { destination };
        }
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getByName', { destination: null });
            return { destination: null };
        }
        if (destination.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getByName', { destination });
        return { destination };
    },

    /**
     * Lists destinations with filters, pagination and ordering.
     * Aplies visibility/permissions logic according to the actor.
     * RO-RO pattern, logging, edge-cases.
     *
     * @param input - Pagination, filters and ordering parameters.
     * @param actor - User or public actor.
     * @returns Object with the accessible destinations array.
     * @example
     * const { destinations } = await list({ limit: 10, offset: 0, visibility: 'PUBLIC' }, user);
     */
    async list(input: DestinationListInput, actor: unknown): Promise<DestinationListOutput> {
        logMethodStart(serviceLogger, 'list', input, actor as object);
        const parsedInput = DestinationListInputSchema.parse(input);
        const allDestinations = await DestinationModel.list(parsedInput);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(serviceLogger, 'list', { destinations: [] });
            return { destinations: [] };
        }
        // Filtrar por permisos/visibilidad
        const filtered = allDestinations.filter((destination) => {
            const { canView } = canViewDestination(safeActor, destination);
            return canView;
        });
        logMethodEnd(serviceLogger, 'list', { destinations: filtered });
        return { destinations: filtered };
    },

    /**
     * Creates a new destination.
     * Only authenticated users can create destinations. RO-RO, logging, permissions.
     * @param input - Input to create destination
     * @param actor - User or public actor
     * @returns { destination }
     * @throws Error if the actor is public or does not have permission
     */
    async create(
        input: DestinationCreateInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<DestinationCreateOutput> {
        logMethodStart(serviceLogger, 'create', input, actor);
        const safeActor = getSafeActor(actor);
        if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: 'PRIVATE' },
                CanViewReasonEnum.PUBLIC,
                PermissionEnum.DESTINATION_CREATE
            );
            throw new Error('Forbidden: public user cannot create destinations');
        }
        if ('role' in safeActor && isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                { visibility: 'PRIVATE' },
                PermissionEnum.DESTINATION_CREATE
            );
            throw new Error('Forbidden: user disabled');
        }
        if (!('role' in safeActor)) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                { visibility: 'PRIVATE' },
                CanViewReasonEnum.PUBLIC,
                PermissionEnum.DESTINATION_CREATE
            );
            throw new Error('Forbidden: public user cannot create destinations');
        }
        try {
            hasPermission(safeActor, PermissionEnum.DESTINATION_CREATE);
        } catch (err) {
            serviceLogger.permission({
                permission: PermissionEnum.DESTINATION_CREATE,
                userId: safeActor.id,
                role: safeActor.role,
                extraData: { input, error: (err as Error).message }
            });
            throw new Error('Forbidden: user does not have permission to create destination');
        }
        const parsedInput = DestinationCreateInputSchema.parse(input);
        const normalizedInput = destinationNormalizeCreateInput(parsedInput);
        const destinationInput = {
            ...normalizedInput,
            createdById:
                (normalizedInput as { createdById?: UserId }).createdById ??
                (safeActor.id as UserId)
        } as import('@repo/types').NewDestinationInputType;
        const destination = await DestinationModel.create(destinationInput);
        if (destination.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                destination,
                PermissionEnum.DESTINATION_CREATE,
                'created'
            );
        }
        logMethodEnd(serviceLogger, 'create', { destination });
        return { destination };
    },

    /**
     * Updates an existing destination.
     * Only admin or a user with the required permission can update.
     * Handles edge-cases: public user, disabled user, unknown visibility, etc.
     *
     * @param input - The input object with fields to update (must include id).
     * @param actor - The user or public actor attempting the update.
     * @returns An object with the updated destination.
     * @throws Error if the actor is not allowed to update or input is invalid.
     * @example
     * const result = await update({ id: 'dest-1', name: 'New Name' }, user);
     */
    async update(
        input: DestinationUpdateInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<DestinationUpdateOutput> {
        logMethodStart(serviceLogger, 'update', input, actor);
        const parsedInput = DestinationUpdateInputSchema.parse(input);
        const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'update', { destination: null });
            throw new Error('Destination not found');
        }
        const safeActor = getSafeActor(actor);
        let checkedPermission: import('@repo/types').PermissionEnum | undefined;
        const {
            canView,
            reason,
            checkedPermission: checkedPerm
        } = canViewDestination(safeActor, destination);
        checkedPermission = checkedPerm;
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                PermissionEnum.DESTINATION_UPDATE
            );
            logMethodEnd(serviceLogger, 'update', { destination: null });
            throw new Error('Forbidden: user disabled');
        }
        // Only ADMIN or user with DESTINATION_UPDATE permission can update
        try {
            hasPermission(safeActor, PermissionEnum.DESTINATION_UPDATE);
        } catch (err) {
            serviceLogger.permission({
                permission: PermissionEnum.DESTINATION_UPDATE,
                userId: 'id' in safeActor ? safeActor.id : 'public',
                role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
                extraData: { input, error: (err as Error).message }
            });
            logMethodEnd(serviceLogger, 'update', { destination: null });
            throw new Error('Forbidden: user does not have permission to update destination');
        }
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'update', { destination: null });
            throw new Error('Forbidden: cannot view destination');
        }
        const normalizedUpdateInput = destinationNormalizeUpdateInput(destination, parsedInput);
        const updatedDestination = await DestinationModel.update(
            parsedInput.id,
            normalizedUpdateInput as import('@repo/types').UpdateDestinationInputType
        );
        if (!updatedDestination) {
            logMethodEnd(serviceLogger, 'update', { destination: null });
            throw new Error('Destination update failed');
        }
        logMethodEnd(serviceLogger, 'update', { destination: updatedDestination });
        return { destination: updatedDestination };
    },

    /**
     * Soft-deletes (archives) a destination by ID.
     * Only admin or a user with the required permission can delete.
     * Handles edge-cases: public user, disabled user, already archived/deleted, etc.
     *
     * @param input - The input object with the destination ID.
     * @param actor - The user or public actor attempting the soft-delete.
     * @returns An object with the deleted (archived) destination, or null if not found or not allowed.
     * @throws Error if the actor is not allowed to delete or input is invalid.
     * @example
     * const result = await softDelete({ id: 'dest-1' }, user);
     */
    async softDelete(
        input: DestinationGetByIdInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<{ destination: import('@repo/types').DestinationType | null }> {
        logMethodStart(serviceLogger, 'delete', input, actor);
        const parsedInput = DestinationGetByIdInputSchema.parse(input);
        const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'delete', { destination: null });
            throw new Error('Destination not found');
        }
        try {
            destinationAssertNotArchived(destination);
        } catch (err) {
            logMethodEnd(serviceLogger, 'delete', { destination: null });
            throw err;
        }
        const safeActor = getSafeActor(actor);
        if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                destination,
                'Forbidden: public user cannot delete destinations',
                PermissionEnum.DESTINATION_DELETE
            );
            logMethodEnd(serviceLogger, 'delete', { destination: null });
            throw new Error('Forbidden: public user cannot delete destinations');
        }
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                PermissionEnum.DESTINATION_DELETE
            );
            logMethodEnd(serviceLogger, 'delete', { destination: null });
            throw new Error('Forbidden: user disabled');
        }
        // Only ADMIN or user with DESTINATION_DELETE permission can delete
        try {
            hasPermission(safeActor, PermissionEnum.DESTINATION_DELETE);
        } catch (err) {
            serviceLogger.permission({
                permission: PermissionEnum.DESTINATION_DELETE,
                userId: 'id' in safeActor ? safeActor.id : 'public',
                role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
                extraData: { input, error: (err as Error).message }
            });
            logMethodEnd(serviceLogger, 'delete', { destination: null });
            throw new Error('Forbidden: user does not have permission to delete destination');
        }
        const updateInput = destinationBuildSoftDeleteUpdate(safeActor);
        const updatedDestination = await DestinationModel.update(parsedInput.id, updateInput);
        if (!updatedDestination) {
            logMethodEnd(serviceLogger, 'delete', { destination: null });
            throw new Error('Destination delete failed');
        }
        logMethodEnd(serviceLogger, 'delete', { destination: updatedDestination });
        return { destination: updatedDestination };
    },

    /**
     * Restores a soft-deleted destination. (MVP)
     * Solo admin or user with permission can restore.
     * Handles edge-cases: public user, disabled user, not archived, etc.
     *
     * @param input - The input with the destination ID.
     * @param actor - The user or public actor attempting the restore.
     * @returns Object with the restored destination, or null if not possible.
     * @throws Error if the actor cannot restore or the input is invalid.
     * @example
     * const result = await restore({ id: 'dest-1' }, user);
     */
    async restore(
        input: DestinationGetByIdInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<{ destination: import('@repo/types').DestinationType | null }> {
        logMethodStart(serviceLogger, 'restore', input, actor);
        const parsedInput = DestinationGetByIdInputSchema.parse(input);
        const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'restore', { destination: null });
            throw new Error('Destination not found');
        }
        try {
            destinationAssertNotActive(destination);
        } catch (err) {
            logMethodEnd(serviceLogger, 'restore', { destination: null });
            throw err;
        }
        const safeActor = getSafeActor(actor);
        if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                destination,
                'Forbidden: public user cannot restore destinations',
                PermissionEnum.DESTINATION_RESTORE
            );
            logMethodEnd(serviceLogger, 'restore', { destination: null });
            throw new Error('Forbidden: public user cannot restore destinations');
        }
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                PermissionEnum.DESTINATION_RESTORE
            );
            logMethodEnd(serviceLogger, 'restore', { destination: null });
            throw new Error('Forbidden: user disabled');
        }
        try {
            hasPermission(safeActor, PermissionEnum.DESTINATION_RESTORE);
        } catch (err) {
            serviceLogger.permission({
                permission: PermissionEnum.DESTINATION_RESTORE,
                userId: 'id' in safeActor ? safeActor.id : 'public',
                role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
                extraData: { input, error: (err as Error).message }
            });
            logMethodEnd(serviceLogger, 'restore', { destination: null });
            throw new Error('Forbidden: user does not have permission to restore destination');
        }
        const updateInput = destinationBuildRestoreUpdate(safeActor);
        const updatedDestination = await DestinationModel.update(parsedInput.id, updateInput);
        if (!updatedDestination) {
            logMethodEnd(serviceLogger, 'restore', { destination: null });
            throw new Error('Destination restore failed');
        }
        logMethodEnd(serviceLogger, 'restore', { destination: updatedDestination });
        return { destination: updatedDestination };
    },

    /**
     * Hard-deletes (permanently deletes) a destination by ID. (MVP)
     * Solo admin or user with permission can hard-delete.
     * Handles edge-cases: public user, disabled user, not found, without permissions, delete error.
     *
     * @param input - The input with the destination ID.
     * @param actor - The user or public actor attempting the hard-delete.
     * @returns Object { success: boolean }.
     * @throws Error if the actor cannot delete or the input is invalid.
     * @example
     * const result = await hardDelete({ id: 'dest-1' }, user);
     */
    async hardDelete(
        input: DestinationGetByIdInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<{ success: boolean }> {
        logMethodStart(serviceLogger, 'hardDelete', input, actor);
        const parsedInput = DestinationGetByIdInputSchema.parse(input);
        const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Destination not found');
        }
        const safeActor = getSafeActor(actor);
        if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
            logDenied(
                serviceLogger,
                safeActor,
                input,
                destination,
                'Forbidden: public user cannot hard-delete destinations',
                PermissionEnum.DESTINATION_HARD_DELETE
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: public user cannot hard-delete destinations');
        }
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                PermissionEnum.DESTINATION_HARD_DELETE
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: user disabled');
        }
        try {
            hasPermission(safeActor, PermissionEnum.DESTINATION_HARD_DELETE);
        } catch (err) {
            serviceLogger.permission({
                permission: PermissionEnum.DESTINATION_HARD_DELETE,
                userId: 'id' in safeActor ? safeActor.id : 'public',
                role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
                extraData: { input, error: (err as Error).message }
            });
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: user does not have permission to hard-delete destination');
        }
        let deleted = false;
        try {
            deleted = await DestinationModel.hardDelete(parsedInput.id);
        } catch (_err) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Destination hard delete failed');
        }
        logMethodEnd(serviceLogger, 'hardDelete', { success: deleted });
        return { success: deleted };
    },

    /**
     * Advanced search for destinations.
     * Applies filters and ordering, handles permissions, logging, and pagination.
     *
     * @param input - Search filters and ordering.
     * @param actor - User or public actor.
     * @returns Object with destinations and total count.
     * @example
     * const { destinations, total } = await search({ text: 'playa', limit: 10 }, user);
     */
    async search(
        input: DestinationSearchInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<DestinationSearchOutput> {
        logMethodStart(serviceLogger, 'search', input, actor);
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(serviceLogger, 'search', { destinations: [], total: 0 });
            return { destinations: [], total: 0 };
        }
        const parsedInput = DestinationSearchInputSchema.parse(input);
        // 1. Build DB filters
        const dbFilters: DestinationListInput = {
            limit: (parsedInput.limit ?? 20) * 3, // buffer para filtrar por permisos/texto
            offset: 0
        };
        if (parsedInput.isFeatured !== undefined) dbFilters.isFeatured = parsedInput.isFeatured;
        if (parsedInput.visibility) dbFilters.visibility = parsedInput.visibility;
        if (parsedInput.lifecycle) dbFilters.lifecycle = parsedInput.lifecycle;
        if (parsedInput.moderationState) dbFilters.moderationState = parsedInput.moderationState;
        if (parsedInput.orderBy) {
            dbFilters.orderBy = parsedInput.orderBy;
            dbFilters.order = parsedInput.order ?? 'desc';
        }
        // 2. Query DB
        const all = await DestinationModel.list(dbFilters);
        // 3. In-memory filters
        let filtered = all;
        if (parsedInput.text && parsedInput.text.trim().length > 0) {
            const q = parsedInput.text.trim().toLowerCase();
            filtered = filtered.filter(
                (d) =>
                    d.name.toLowerCase().includes(q) ||
                    d.summary.toLowerCase().includes(q) ||
                    d.description.toLowerCase().includes(q)
            );
        }
        if (typeof parsedInput.averageRatingMin === 'number') {
            const min = parsedInput.averageRatingMin;
            filtered = filtered.filter((d) => (d.averageRating ?? 0) >= min);
        }
        if (typeof parsedInput.averageRatingMax === 'number') {
            const max = parsedInput.averageRatingMax;
            filtered = filtered.filter((d) => (d.averageRating ?? 0) <= max);
        }
        // 4. Permissions/visibility
        const permitted = filtered.filter((destination) => {
            const { canView } = canViewDestination(safeActor, destination);
            return canView;
        });
        // 5. Extra ordering if needed
        if (parsedInput.orderBy) {
            const col = parsedInput.orderBy;
            const dir = parsedInput.order === 'asc' ? 1 : -1;
            permitted.sort((a, b) => {
                if (col === 'name') return a.name.localeCompare(b.name) * dir;
                if (col === 'updatedAt')
                    return (
                        (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir
                    );
                if (col === 'isFeatured')
                    return ((b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)) * dir;
                if (col === 'reviewsCount')
                    return ((b.reviewsCount ?? 0) - (a.reviewsCount ?? 0)) * dir;
                if (col === 'averageRating')
                    return ((b.averageRating ?? 0) - (a.averageRating ?? 0)) * dir;
                if (col === 'accommodationsCount')
                    return ((b.accommodationsCount ?? 0) - (a.accommodationsCount ?? 0)) * dir;
                return 0;
            });
        }
        // 6. Final pagination
        const total = permitted.length;
        const paginated = permitted.slice(
            parsedInput.offset,
            parsedInput.offset + parsedInput.limit
        );
        logMethodEnd(serviceLogger, 'search', { destinations: paginated, total });
        return { destinations: paginated, total };
    },

    /**
     * Gets featured destinations. (MVP)
     * Returns only the featured destinations accessible to the actor.
     * Applies visibility/permissions logic, logging, edge-cases.
     *
     * @param input - Object with pagination (limit, offset).
     * @param actor - User or public actor.
     * @returns Object with the array of featured accessible destinations.
     * @example
     * const { destinations } = await getFeatured({ limit: 10, offset: 0 }, user);
     */
    async getFeatured(
        input: { limit: number; offset: number },
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<{ destinations: import('@repo/types').DestinationType[] }> {
        logMethodStart(serviceLogger, 'getFeatured', input, actor);
        const allFeatured = await DestinationModel.list({
            limit: input.limit,
            offset: input.offset,
            isFeatured: true
        });
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logMethodEnd(serviceLogger, 'getFeatured', { destinations: [] });
            return { destinations: [] };
        }
        // Filtrar por permisos/visibilidad
        const filtered = allFeatured.filter((destination) => {
            const { canView } = canViewDestination(safeActor, destination);
            return canView;
        });
        logMethodEnd(serviceLogger, 'getFeatured', { destinations: filtered });
        return { destinations: filtered };
    },

    /**
     * Gets reviews for a destination.
     * Returns only the reviews accessible to the actor, with pagination and ordering.
     * Applies visibility/permissions logic, logging, edge-cases.
     *
     * @param input - Object with destinationId, limit, offset, order, orderBy.
     * @param actor - User or public actor.
     * @returns Object with the array of accessible reviews.
     * @example
     * const { reviews } = await getReviews({ destinationId: 'dest-1', limit: 10 }, user);
     */
    async getReviews(
        input: DestinationGetReviewsInput,
        actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
    ): Promise<DestinationGetReviewsOutput> {
        logMethodStart(serviceLogger, 'getReviews', input, actor);
        const parsedInput = DestinationGetReviewsInputSchema.parse(input);
        // 1. Get destination (for permission/visibility)
        const destination = (await DestinationModel.getById(parsedInput.destinationId)) ?? null;
        if (!destination) {
            logMethodEnd(serviceLogger, 'getReviews', { reviews: [] });
            return { reviews: [] };
        }
        const safeActor = getSafeActor(actor);
        let checkedPermission: import('@repo/types').PermissionEnum | undefined;
        const {
            canView,
            reason,
            checkedPermission: checkedPerm
        } = canViewDestination(safeActor, destination);
        checkedPermission = checkedPerm;
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
            );
            logMethodEnd(serviceLogger, 'getReviews', { reviews: [] });
            return { reviews: [] };
        }
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getReviews', { reviews: [] });
            throw new Error(`Unknown destination visibility: ${destination.visibility}`);
        }
        if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
            try {
                const allowed = hasPermission(safeActor, checkedPermission);
                if (!allowed) throw new Error('Permission denied');
            } catch (_err) {
                logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
                logMethodEnd(serviceLogger, 'getReviews', { reviews: [] });
                return { reviews: [] };
            }
            if (destination.visibility !== 'PUBLIC') {
                logGrant(serviceLogger, safeActor, input, destination, checkedPermission, reason);
            }
        } else if (!canView) {
            logDenied(serviceLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getReviews', { reviews: [] });
            return { reviews: [] };
        } else if (destination.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                destination,
                checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
                reason
            );
        }
        // 2. Get reviews paginated
        const reviews = await DestinationReviewModel.list({
            limit: parsedInput.limit,
            offset: parsedInput.offset,
            order: parsedInput.order,
            orderBy: parsedInput.orderBy
        });
        // 3. Filter reviews by destinationId (defensive, in case model.list is reused)
        const filtered = reviews.filter((r) => r.destinationId === parsedInput.destinationId);
        logMethodEnd(serviceLogger, 'getReviews', { reviews: filtered });
        return { reviews: filtered };
    },

    // --- FUTURE METHODS (stubs) ---

    /**
     * Adds an attraction to a destination. (Future)
     */
    async addAttraction(): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Removes an attraction from a destination. (Future)
     */
    async removeAttraction(): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Adds a review to a destination. (Future)
     */
    async addReview(): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Removes a review from a destination. (Future)
     */
    async removeReview(): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Bulk update destinations. (Future)
     */
    async bulkUpdate(): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Changes the visibility of a destination. (Future)
     */
    async changeVisibility(): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Gets nearby destinations. (Future)
     */
    async getNearbyDestinations(): Promise<never> {
        throw new Error('Not implemented yet');
    }
};
