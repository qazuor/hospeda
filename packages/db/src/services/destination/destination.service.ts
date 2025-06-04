// Destination Service - MVP and Future Methods (stubs)
// All methods use RO-RO pattern and throw 'Not implemented yet' for now.

import { PermissionEnum, RoleEnum } from '@repo/types';
import type { UserId } from '@repo/types/common/id.types';
import { DestinationModel } from '../../models/destination/destination.model';
import { dbLogger } from '../../utils/logger';
import { logDenied, logGrant, logUserDisabled } from '../../utils/permission-logger';
import { hasPermission } from '../../utils/permission-manager';
import {
    CanViewReasonEnum,
    getSafeActor,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../../utils/service-helper';
import {
    assertNotActive,
    assertNotArchived,
    buildRestoreUpdate,
    buildSoftDeleteUpdate,
    canViewDestination,
    normalizeCreateInput
} from './destination.helper';
import {
    type CreateInput,
    type CreateOutput,
    type GetByIdInput,
    type GetByIdOutput,
    type GetByNameInput,
    type GetByNameOutput,
    type GetBySlugInput,
    type GetBySlugOutput,
    type ListInput,
    type ListOutput,
    createInputSchema,
    getByIdInputSchema,
    getByNameInputSchema,
    getBySlugInputSchema,
    listInputSchema
} from './destination.schemas';

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
export const getById = async (input: GetByIdInput, actor: unknown): Promise<GetByIdOutput> => {
    logMethodStart(dbLogger, 'getById', input, actor as object);
    const parsedInput = getByIdInputSchema.parse(input);
    const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
    if (!destination) {
        logMethodEnd(dbLogger, 'getById', { destination: null });
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
            dbLogger,
            safeActor,
            input,
            destination,
            checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
        );
        logMethodEnd(dbLogger, 'getById', { destination: null });
        return { destination: null };
    }
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getById', { destination: null });
        throw new Error(`Unknown destination visibility: ${destination.visibility}`);
    }
    if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
        try {
            const allowed = hasPermission(safeActor, checkedPermission);
            if (!allowed) throw new Error('Permission denied');
        } catch (_err) {
            logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(dbLogger, 'getById', { destination: null });
            return { destination: null };
        }
        if (destination.visibility !== 'PUBLIC') {
            logGrant(dbLogger, safeActor, input, destination, checkedPermission, reason);
        }
        logMethodEnd(dbLogger, 'getById', { destination });
        return { destination };
    }
    if (!canView) {
        logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getById', { destination: null });
        return { destination: null };
    }
    if (destination.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            destination,
            checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getById', { destination });
    return { destination };
};

/**
 * Gets a destination by its slug.
 * Handles edge-cases: public user, disabled user, unknown visibility.
 * Always uses RO-RO pattern for input/output.
 *
 * Why: Permite búsqueda segura y auditable por slug, con la misma robustez que getById.
 *
 * @param input - The input object containing the destination slug.
 * @param actor - The user or public actor requesting the destination.
 * @returns An object with the destination or null if not accessible.
 * @throws Error if the destination has unknown visibility.
 * @example
 * const result = await getBySlug({ slug: 'destino-uruguay' }, user);
 */
export const getBySlug = async (
    input: GetBySlugInput,
    actor: unknown
): Promise<GetBySlugOutput> => {
    logMethodStart(dbLogger, 'getBySlug', input, actor as object);
    const parsedInput = getBySlugInputSchema.parse(input);
    const destination = (await DestinationModel.getBySlug(parsedInput.slug)) ?? null;
    if (!destination) {
        logMethodEnd(dbLogger, 'getBySlug', { destination: null });
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
            dbLogger,
            safeActor,
            input,
            destination,
            checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
        );
        logMethodEnd(dbLogger, 'getBySlug', { destination: null });
        return { destination: null };
    }
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getBySlug', { destination: null });
        throw new Error(`Unknown destination visibility: ${destination.visibility}`);
    }
    if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
        try {
            const allowed = hasPermission(safeActor, checkedPermission);
            if (!allowed) throw new Error('Permission denied');
        } catch (_err) {
            logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(dbLogger, 'getBySlug', { destination: null });
            return { destination: null };
        }
        if (destination.visibility !== 'PUBLIC') {
            logGrant(dbLogger, safeActor, input, destination, checkedPermission, reason);
        }
        logMethodEnd(dbLogger, 'getBySlug', { destination });
        return { destination };
    }
    if (!canView) {
        logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getBySlug', { destination: null });
        return { destination: null };
    }
    if (destination.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            destination,
            checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getBySlug', { destination });
    return { destination };
};

/**
 * Gets a destination by its name.
 * Maneja edge-cases: usuario público, usuario deshabilitado, visibilidad desconocida.
 * RO-RO pattern.
 *
 * @param input - Objeto con el nombre del destino.
 * @param actor - Usuario o actor público.
 * @returns Objeto con el destino o null si no es accesible.
 * @throws Error si la visibilidad es desconocida.
 */
export const getByName = async (
    input: GetByNameInput,
    actor: unknown
): Promise<GetByNameOutput> => {
    logMethodStart(dbLogger, 'getByName', input, actor as object);
    const parsedInput = getByNameInputSchema.parse(input);
    const destination = (await DestinationModel.getByName(parsedInput.name)) ?? null;
    if (!destination) {
        logMethodEnd(dbLogger, 'getByName', { destination: null });
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
            dbLogger,
            safeActor,
            input,
            destination,
            checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE
        );
        logMethodEnd(dbLogger, 'getByName', { destination: null });
        return { destination: null };
    }
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getByName', { destination: null });
        throw new Error(`Unknown destination visibility: ${destination.visibility}`);
    }
    if (reason === CanViewReasonEnum.PERMISSION_CHECK_REQUIRED && checkedPermission) {
        try {
            const allowed = hasPermission(safeActor, checkedPermission);
            if (!allowed) throw new Error('Permission denied');
        } catch (_err) {
            logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
            logMethodEnd(dbLogger, 'getByName', { destination: null });
            return { destination: null };
        }
        if (destination.visibility !== 'PUBLIC') {
            logGrant(dbLogger, safeActor, input, destination, checkedPermission, reason);
        }
        logMethodEnd(dbLogger, 'getByName', { destination });
        return { destination };
    }
    if (!canView) {
        logDenied(dbLogger, safeActor, input, destination, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getByName', { destination: null });
        return { destination: null };
    }
    if (destination.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            destination,
            checkedPermission ?? PermissionEnum.DESTINATION_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getByName', { destination });
    return { destination };
};

/**
 * Lists destinations with filters, pagination and ordering.
 * Aplica lógica de visibilidad/permisos según el actor.
 * RO-RO pattern, logging, edge-cases.
 *
 * @param input - Parámetros de paginación, filtros y orden.
 * @param actor - Usuario o actor público.
 * @returns Objeto con el array de destinos accesibles.
 * @example
 * const { destinations } = await list({ limit: 10, offset: 0, visibility: 'PUBLIC' }, user);
 */
export const list = async (input: ListInput, actor: unknown): Promise<ListOutput> => {
    logMethodStart(dbLogger, 'list', input, actor as object);
    const parsedInput = listInputSchema.parse(input);
    const allDestinations = await DestinationModel.list(parsedInput);
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'list', { destinations: [] });
        return { destinations: [] };
    }
    // Filtrar por permisos/visibilidad
    const filtered = allDestinations.filter((destination) => {
        const { canView } = canViewDestination(safeActor, destination);
        return canView;
    });
    logMethodEnd(dbLogger, 'list', { destinations: filtered });
    return { destinations: filtered };
};

/**
 * Creates a new destination.
 * Solo usuarios autenticados pueden crear destinos. RO-RO, logging, permisos.
 * @param input - Input para crear destination
 * @param actor - Usuario o actor público
 * @returns { destination }
 * @throws Error si el actor es público o no tiene permiso
 */
export const create = async (
    input: CreateInput,
    actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
): Promise<CreateOutput> => {
    logMethodStart(dbLogger, 'create', input, actor);
    const safeActor = getSafeActor(actor);
    if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
        logDenied(
            dbLogger,
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
            dbLogger,
            safeActor,
            input,
            { visibility: 'PRIVATE' },
            PermissionEnum.DESTINATION_CREATE
        );
        throw new Error('Forbidden: user disabled');
    }
    if (!('role' in safeActor)) {
        logDenied(
            dbLogger,
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
        dbLogger.permission({
            permission: PermissionEnum.DESTINATION_CREATE,
            userId: safeActor.id,
            role: safeActor.role,
            extraData: { input, error: (err as Error).message }
        });
        throw new Error('Forbidden: user does not have permission to create destination');
    }
    const parsedInput = createInputSchema.parse(input);
    const normalizedInput = normalizeCreateInput(parsedInput);
    const destinationInput = {
        ...normalizedInput,
        createdById:
            (normalizedInput as { createdById?: UserId }).createdById ?? (safeActor.id as UserId)
    } as import('@repo/types').NewDestinationInputType;
    const destination = await DestinationModel.create(destinationInput);
    if (destination.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            destination,
            PermissionEnum.DESTINATION_CREATE,
            'created'
        );
    }
    logMethodEnd(dbLogger, 'create', { destination });
    return { destination };
};

/**
 * Updates an existing destination. (MVP)
 */
export const update = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

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
export const softDelete = async (
    input: GetByIdInput,
    actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
): Promise<{ destination: import('@repo/types').DestinationType | null }> => {
    logMethodStart(dbLogger, 'delete', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
    if (!destination) {
        logMethodEnd(dbLogger, 'delete', { destination: null });
        throw new Error('Destination not found');
    }
    try {
        assertNotArchived(destination);
    } catch (err) {
        logMethodEnd(dbLogger, 'delete', { destination: null });
        throw err;
    }
    const safeActor = getSafeActor(actor);
    if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            destination,
            'Forbidden: public user cannot delete destinations',
            PermissionEnum.DESTINATION_DELETE
        );
        logMethodEnd(dbLogger, 'delete', { destination: null });
        throw new Error('Forbidden: public user cannot delete destinations');
    }
    if (isUserDisabled(safeActor)) {
        logUserDisabled(dbLogger, safeActor, input, destination, PermissionEnum.DESTINATION_DELETE);
        logMethodEnd(dbLogger, 'delete', { destination: null });
        throw new Error('Forbidden: user disabled');
    }
    // Only ADMIN or user with DESTINATION_DELETE permission can delete
    try {
        hasPermission(safeActor, PermissionEnum.DESTINATION_DELETE);
    } catch (err) {
        dbLogger.permission({
            permission: PermissionEnum.DESTINATION_DELETE,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: { input, error: (err as Error).message }
        });
        logMethodEnd(dbLogger, 'delete', { destination: null });
        throw new Error('Forbidden: user does not have permission to delete destination');
    }
    const updateInput = buildSoftDeleteUpdate(safeActor);
    const updatedDestination = await DestinationModel.update(parsedInput.id, updateInput);
    if (!updatedDestination) {
        logMethodEnd(dbLogger, 'delete', { destination: null });
        throw new Error('Destination delete failed');
    }
    logMethodEnd(dbLogger, 'delete', { destination: updatedDestination });
    return { destination: updatedDestination };
};

/**
 * Restores a soft-deleted destination. (MVP)
 * Solo admin o usuario con permiso puede restaurar.
 * Maneja edge-cases: usuario público, usuario deshabilitado, no archivado, etc.
 *
 * @param input - El input con el ID del destino.
 * @param actor - El usuario o actor público que intenta restaurar.
 * @returns Objeto con el destino restaurado, o null si no se puede.
 * @throws Error si el actor no puede restaurar o el input es inválido.
 * @example
 * const result = await restore({ id: 'dest-1' }, user);
 */
export const restore = async (
    input: GetByIdInput,
    actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
): Promise<{ destination: import('@repo/types').DestinationType | null }> => {
    logMethodStart(dbLogger, 'restore', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
    if (!destination) {
        logMethodEnd(dbLogger, 'restore', { destination: null });
        throw new Error('Destination not found');
    }
    try {
        assertNotActive(destination);
    } catch (err) {
        logMethodEnd(dbLogger, 'restore', { destination: null });
        throw err;
    }
    const safeActor = getSafeActor(actor);
    if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            destination,
            'Forbidden: public user cannot restore destinations',
            PermissionEnum.DESTINATION_RESTORE
        );
        logMethodEnd(dbLogger, 'restore', { destination: null });
        throw new Error('Forbidden: public user cannot restore destinations');
    }
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            destination,
            PermissionEnum.DESTINATION_RESTORE
        );
        logMethodEnd(dbLogger, 'restore', { destination: null });
        throw new Error('Forbidden: user disabled');
    }
    try {
        hasPermission(safeActor, PermissionEnum.DESTINATION_RESTORE);
    } catch (err) {
        dbLogger.permission({
            permission: PermissionEnum.DESTINATION_RESTORE,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: { input, error: (err as Error).message }
        });
        logMethodEnd(dbLogger, 'restore', { destination: null });
        throw new Error('Forbidden: user does not have permission to restore destination');
    }
    const updateInput = buildRestoreUpdate(safeActor);
    const updatedDestination = await DestinationModel.update(parsedInput.id, updateInput);
    if (!updatedDestination) {
        logMethodEnd(dbLogger, 'restore', { destination: null });
        throw new Error('Destination restore failed');
    }
    logMethodEnd(dbLogger, 'restore', { destination: updatedDestination });
    return { destination: updatedDestination };
};

/**
 * Hard-deletes (permanently deletes) a destination by ID. (MVP)
 * Solo admin o usuario con permiso puede hard-delete.
 * Maneja edge-cases: usuario público, usuario deshabilitado, no encontrado, sin permisos, error de borrado.
 *
 * @param input - El input con el ID del destino.
 * @param actor - El usuario o actor público que intenta borrar.
 * @returns Objeto { success: boolean }.
 * @throws Error si el actor no puede borrar o el input es inválido.
 * @example
 * const result = await hardDelete({ id: 'dest-1' }, user);
 */
export const hardDelete = async (
    input: GetByIdInput,
    actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
): Promise<{ success: boolean }> => {
    logMethodStart(dbLogger, 'hardDelete', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const destination = (await DestinationModel.getById(parsedInput.id)) ?? null;
    if (!destination) {
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Destination not found');
    }
    const safeActor = getSafeActor(actor);
    if ('role' in safeActor && safeActor.role === RoleEnum.GUEST) {
        logDenied(
            dbLogger,
            safeActor,
            input,
            destination,
            'Forbidden: public user cannot hard-delete destinations',
            PermissionEnum.DESTINATION_HARD_DELETE
        );
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: public user cannot hard-delete destinations');
    }
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            destination,
            PermissionEnum.DESTINATION_HARD_DELETE
        );
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: user disabled');
    }
    try {
        hasPermission(safeActor, PermissionEnum.DESTINATION_HARD_DELETE);
    } catch (err) {
        dbLogger.permission({
            permission: PermissionEnum.DESTINATION_HARD_DELETE,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: { input, error: (err as Error).message }
        });
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: user does not have permission to hard-delete destination');
    }
    let deleted = false;
    try {
        deleted = await DestinationModel.hardDelete(parsedInput.id);
    } catch (_err) {
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Destination hard delete failed');
    }
    logMethodEnd(dbLogger, 'hardDelete', { success: deleted });
    return { success: deleted };
};

/**
 * Advanced search for destinations. (MVP)
 */
export const search = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets featured destinations. (MVP)
 * Devuelve solo los destinos destacados accesibles para el actor.
 * Aplica lógica de visibilidad/permisos, logging, edge-cases.
 *
 * @param input - Objeto con paginación (limit, offset).
 * @param actor - Usuario o actor público.
 * @returns Objeto con el array de destinos destacados accesibles.
 * @example
 * const { destinations } = await getFeatured({ limit: 10, offset: 0 }, user);
 */
export const getFeatured = async (
    input: { limit: number; offset: number },
    actor: import('@repo/types').UserType | import('@repo/types').PublicUserType
): Promise<{ destinations: import('@repo/types').DestinationType[] }> => {
    logMethodStart(dbLogger, 'getFeatured', input, actor);
    const allFeatured = await DestinationModel.list({
        limit: input.limit,
        offset: input.offset,
        isFeatured: true
    });
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logMethodEnd(dbLogger, 'getFeatured', { destinations: [] });
        return { destinations: [] };
    }
    // Filtrar por permisos/visibilidad
    const filtered = allFeatured.filter((destination) => {
        const { canView } = canViewDestination(safeActor, destination);
        return canView;
    });
    logMethodEnd(dbLogger, 'getFeatured', { destinations: filtered });
    return { destinations: filtered };
};

/**
 * Gets accommodations for a destination. (MVP)
 */
export const getAccommodations = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets attractions for a destination. (MVP)
 */
export const getAttractions = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets reviews for a destination. (MVP)
 */
export const getReviews = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

// --- FUTURE METHODS (stubs) ---

/**
 * Adds an attraction to a destination. (Future)
 */
export const addAttraction = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Removes an attraction from a destination. (Future)
 */
export const removeAttraction = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Adds a review to a destination. (Future)
 */
export const addReview = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Removes a review from a destination. (Future)
 */
export const removeReview = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Bulk update destinations. (Future)
 */
export const bulkUpdate = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Changes the visibility of a destination. (Future)
 */
export const changeVisibility = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets nearby destinations. (Future)
 */
export const getNearbyDestinations = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};
