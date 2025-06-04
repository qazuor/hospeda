// Destination Service - MVP and Future Methods (stubs)
// All methods use RO-RO pattern and throw 'Not implemented yet' for now.

import { PermissionEnum } from '@repo/types';
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
import { canViewDestination } from './destination.helper';
import {
    type GetByIdInput,
    type GetByIdOutput,
    type GetByNameInput,
    type GetByNameOutput,
    type GetBySlugInput,
    type GetBySlugOutput,
    getByIdInputSchema,
    getByNameInputSchema,
    getBySlugInputSchema
} from './destination.schemas';

// --- MVP METHODS ---

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
 * Lists destinations with filters and pagination. (MVP)
 */
export const list = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Creates a new destination. (MVP)
 */
export const create = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
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
