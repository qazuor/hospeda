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
import { canViewDestination, normalizeCreateInput } from './destination.helper';
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
 * Soft-deletes (archives) a destination. (MVP)
 */
export const softDelete = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Restores a soft-deleted destination. (MVP)
 */
export const restore = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Hard-deletes (permanently deletes) a destination. (MVP)
 */
export const hardDelete = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Advanced search for destinations. (MVP)
 */
export const search = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets featured destinations. (MVP)
 */
export const getFeatured = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
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
