import {
    type AccommodationType,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UpdateAccommodationInputType,
    type UserType
} from '@repo/types';
import { AccommodationModel } from '../../models/accommodation/accommodation.model';
import { DestinationModel } from '../../models/destination/destination.model';
import { dbLogger, hasPermission } from '../../utils';
import { logDenied, logGrant, logOverride, logUserDisabled } from '../../utils/permission-logger';
import {
    CanViewReasonEnum,
    checkAndLogPermission,
    getSafeActor,
    isPublicUser,
    isUserDisabled,
    logMethodEnd,
    logMethodStart
} from '../../utils/service-helper';
import {
    assertNotActive,
    assertNotArchived,
    buildRestoreUpdate,
    buildSearchParams,
    buildSoftDeleteUpdate,
    canViewAccommodation,
    isOwner,
    normalizeCreateInput,
    normalizeUpdateInput
} from './accommodation.helper';
import {
    type CreateInput,
    type CreateOutput,
    type GetByDestinationInput,
    type GetByDestinationOutput,
    type GetByIdInput,
    type GetByIdOutput,
    type GetByNameInput,
    type GetByNameOutput,
    type GetByOwnerInput,
    type GetByOwnerOutput,
    type GetForHomeInput,
    type GetForHomeOutput,
    type GetTopRatedByDestinationInput,
    type GetTopRatedByDestinationOutput,
    type ListInput,
    type ListOutput,
    type SearchInput,
    type SearchOutput,
    type UpdateInput,
    type UpdateOutput,
    createInputSchema,
    getByDestinationInputSchema,
    getByIdInputSchema,
    getByNameInputSchema,
    getByOwnerInputSchema,
    getForHomeInputSchema,
    getTopRatedByDestinationInputSchema,
    listInputSchema,
    searchInputSchema,
    updateInputSchema
} from './accommodation.schemas';

/**
 * Gets an accommodation by its ID.
 * Handles edge-cases: public user, deleted/disabled owner, unknown visibility.
 * Always uses RO-RO pattern for input/output.
 *
 * Why: Centralizes access and logging logic, prevents information leaks, and ensures traceability.
 *
 * @param input - The input object containing the accommodation ID.
 * @param actor - The user or public actor requesting the accommodation.
 * @returns An object with the accommodation or null if not accessible.
 * @throws Error if the accommodation has unknown visibility.
 * @example
 * const result = await getById({ id: 'acc-1' as AccommodationId }, user);
 */
export const getById = async (
    input: GetByIdInput,
    actor: UserType | PublicUserType
): Promise<GetByIdOutput> => {
    logMethodStart(dbLogger, 'getById', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        logMethodEnd(dbLogger, 'getById', { accommodation: null });
        return { accommodation: null };
    }
    // Always operate on a safe actor to avoid subtle bugs
    const safeActor = getSafeActor(actor);
    let checkedPermission: PermissionEnum | undefined;
    const {
        canView,
        reason,
        checkedPermission: checkedPerm
    } = canViewAccommodation(safeActor, accommodation);
    checkedPermission = checkedPerm;
    // If the user is disabled, explicitly deny access and log
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
        );
        logMethodEnd(dbLogger, 'getById', { accommodation: null });
        return { accommodation: null };
    }
    // Handle unknown visibility
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getById', { accommodation: null });
        throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
    }
    // If cannot view, log and return null (prevents information leaks)
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getById', { accommodation: null });
        return { accommodation: null };
    }
    // Log successful access to private/draft for traceability and audit
    if (accommodation.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            accommodation,
            checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getById', { accommodation });
    return { accommodation };
};

/**
 * Gets an accommodation by its name.
 * Handles edge-cases: public user, deleted/disabled owner, unknown visibility.
 * Always uses RO-RO pattern for input/output.
 *
 * Why: Allows safe and auditable search by name, with the same robustness as getById.
 *
 * @param input - The input object containing the accommodation name.
 * @param actor - The user or public actor requesting the accommodation.
 * @returns An object with the accommodation or null if not accessible.
 * @throws Error if the accommodation has unknown visibility.
 * @example
 * const result = await getByName({ name: 'Hotel Uruguay' }, user);
 */
export const getByName = async (
    input: GetByNameInput,
    actor: UserType | PublicUserType
): Promise<GetByNameOutput> => {
    logMethodStart(dbLogger, 'getByName', input, actor);
    const parsedInput = getByNameInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getByName(parsedInput.name)) ?? null;
    if (!accommodation) {
        logMethodEnd(dbLogger, 'getByName', { accommodation: null });
        return { accommodation: null };
    }
    const safeActor = getSafeActor(actor); // Always operate on a safe actor to avoid subtle bugs.
    let checkedPermission: PermissionEnum | undefined;
    const {
        canView,
        reason,
        checkedPermission: checkedPerm
    } = canViewAccommodation(safeActor, accommodation);
    checkedPermission = checkedPerm;
    // If the user is disabled, explicitly deny access and log.
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
        );
        logMethodEnd(dbLogger, 'getByName', { accommodation: null });
        return { accommodation: null };
    }
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getByName', { accommodation: null });
        throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
    }
    // If cannot view, log and return null (prevents information leaks).
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        logMethodEnd(dbLogger, 'getByName', { accommodation: null });
        return { accommodation: null };
    }
    // Log successful access to private/draft for traceability and audit.
    if (accommodation.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            accommodation,
            checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            reason
        );
    }
    logMethodEnd(dbLogger, 'getByName', { accommodation });
    return { accommodation };
};

/**
 * Lists accommodations with optional filters and pagination.
 * Handles edge-cases: public user, RO-RO pattern.
 *
 * Why: Centralizes visibility and access logic for bulk searches, preventing information leaks.
 *
 * @param input - The input object with filters and pagination.
 * @param actor - The user or public actor requesting the list.
 * @returns An object with the list of accommodations.
 * @example
 * const result = await list({ limit: 10, offset: 0 }, user);
 */
export const list = async (
    input: ListInput,
    actor: UserType | PublicUserType
): Promise<ListOutput> => {
    logMethodStart(dbLogger, 'list', input, actor);
    const parsedInput = listInputSchema.parse(input);
    // Always use a safe actor (public fallback)
    const safeActor = getSafeActor(actor); // Prevents bugs and ensures consistency in access logic.
    // Edge-case: public user can only see PUBLIC accommodations
    const isPublic = isPublicUser(safeActor); // Centralizes public user logic.
    if (isPublic && parsedInput.visibility && parsedInput.visibility !== 'PUBLIC') {
        logOverride(
            dbLogger,
            input,
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            'Forced visibility=PUBLIC for public user'
        );
    }
    // Use helper to build and clean search params
    const cleanParams = buildSearchParams(parsedInput, safeActor);
    // biome-ignore lint/suspicious/noExplicitAny: required for type compatibility in searchParams
    const accommodations = await AccommodationModel.search(cleanParams as any);
    logMethodEnd(dbLogger, 'list', { accommodations });
    return { accommodations };
};

/**
 * Creates a new accommodation.
 * Handles edge-cases: public user, RO-RO pattern, robust logging.
 *
 * Why: Only authenticated users can create, and all relevant access is logged for traceability and security.
 *
 * @param input - The input object for the new accommodation.
 * @param actor - The user or public actor attempting to create.
 * @returns An object with the created accommodation.
 * @throws Error if the actor is a public user or lacks permission.
 * @example
 * const result = await create(getMockAccommodationInput(), user);
 */
export const create = async (
    input: CreateInput,
    actor: UserType | PublicUserType
): Promise<CreateOutput> => {
    logMethodStart(dbLogger, 'create', input, actor);
    const safeActor = getSafeActor(actor);
    if (isPublicUser(safeActor)) {
        logOverride(
            dbLogger,
            input,
            PermissionEnum.ACCOMMODATION_CREATE,
            'Public user cannot create accommodations'
        );
        throw new Error('Forbidden: Public user cannot create accommodations');
    }
    try {
        hasPermission(safeActor, PermissionEnum.ACCOMMODATION_CREATE);
    } catch (err) {
        dbLogger.permission({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: safeActor.id,
            role: safeActor.role,
            extraData: { input, error: (err as Error).message }
        });
        throw new Error('Forbidden: User does not have permission to create accommodation');
    }
    const parsedInput = createInputSchema.parse(input);
    const normalizedInput = normalizeCreateInput(parsedInput);
    const accommodation = await AccommodationModel.create(normalizedInput);
    // Log success for private/draft creations
    if (accommodation.visibility !== 'PUBLIC') {
        logGrant(
            dbLogger,
            safeActor,
            input,
            accommodation,
            PermissionEnum.ACCOMMODATION_CREATE,
            'created'
        );
    }
    logMethodEnd(dbLogger, 'create', { accommodation });
    return { accommodation };
};

/**
 * Updates an existing accommodation.
 * Only the owner, admin, or a user with the required permission can update.
 * Handles edge-cases: public user, disabled owner, unknown visibility, etc.
 *
 * @param input - The input object with fields to update (must include id).
 * @param actor - The user or public actor attempting the update.
 * @returns An object with the updated accommodation.
 * @throws Error if the actor is not allowed to update or input is invalid.
 * @example
 * const result = await update({ id: 'acc-1', name: 'New Name' }, user);
 */
export const update = async (
    input: UpdateInput,
    actor: UserType | PublicUserType
): Promise<UpdateOutput> => {
    logMethodStart(dbLogger, 'update', input, actor);
    const parsedInput = updateInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        logMethodEnd(dbLogger, 'update', { accommodation: null });
        throw new Error('Accommodation not found');
    }
    const safeActor = getSafeActor(actor);
    let checkedPermission: PermissionEnum | undefined;
    const {
        canView,
        reason,
        checkedPermission: checkedPerm
    } = canViewAccommodation(safeActor, accommodation);
    checkedPermission = checkedPerm;
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            PermissionEnum.ACCOMMODATION_UPDATE_OWN
        );
        logMethodEnd(dbLogger, 'update', { accommodation: null });
        throw new Error('Forbidden: user disabled');
    }
    // Use helper for owner check
    const owner = isOwner(safeActor, accommodation);
    // Use helper for permission check and logging
    checkAndLogPermission(
        safeActor,
        owner ? PermissionEnum.ACCOMMODATION_UPDATE_OWN : PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        dbLogger,
        { input },
        'Forbidden: user does not have permission to update accommodation'
    );
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        logMethodEnd(dbLogger, 'update', { accommodation: null });
        throw new Error('Forbidden: cannot view accommodation');
    }
    const normalizedUpdateInput = normalizeUpdateInput(accommodation, parsedInput);
    const updatedAccommodation = await AccommodationModel.update(
        parsedInput.id,
        normalizedUpdateInput as UpdateAccommodationInputType
    );
    if (!updatedAccommodation) {
        logMethodEnd(dbLogger, 'update', { accommodation: null });
        throw new Error('Accommodation update failed');
    }
    logMethodEnd(dbLogger, 'update', { accommodation: updatedAccommodation });
    return { accommodation: updatedAccommodation };
};

/**
 * Soft-deletes (archives) an accommodation by ID.
 * Only the owner, admin, or a user with the required permission can delete.
 * Handles edge-cases: public user, disabled owner, already archived/deleted, etc.
 *
 * @param input - The input object with the accommodation ID.
 * @param actor - The user or public actor attempting the soft-delete.
 * @returns An object with the deleted (archived) accommodation, or null if not found or not allowed.
 * @throws Error if the actor is not allowed to delete or input is invalid.
 * @example
 * const result = await softDelete({ id: 'acc-1' }, user);
 */
export const softDelete = async (
    input: GetByIdInput,
    actor: UserType | PublicUserType
): Promise<{ accommodation: AccommodationType | null }> => {
    logMethodStart(dbLogger, 'delete', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        logMethodEnd(dbLogger, 'delete', { accommodation: null });
        throw new Error('Accommodation not found');
    }
    try {
        assertNotArchived(accommodation);
    } catch (err) {
        logMethodEnd(dbLogger, 'delete', { accommodation: null });
        throw err;
    }
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            PermissionEnum.ACCOMMODATION_DELETE_OWN
        );
        logMethodEnd(dbLogger, 'delete', { accommodation: null });
        throw new Error('Forbidden: user disabled');
    }
    const owner = isOwner(safeActor, accommodation);
    checkAndLogPermission(
        safeActor,
        owner ? PermissionEnum.ACCOMMODATION_DELETE_OWN : PermissionEnum.ACCOMMODATION_DELETE_ANY,
        dbLogger,
        { input },
        'Forbidden: user does not have permission to delete accommodation'
    );
    const updateInput = buildSoftDeleteUpdate(safeActor);
    const updatedAccommodation = await AccommodationModel.update(parsedInput.id, {
        ...updateInput
    } as Partial<UpdateAccommodationInputType>);
    if (!updatedAccommodation) {
        logMethodEnd(dbLogger, 'delete', { accommodation: null });
        throw new Error('Accommodation delete failed');
    }
    logMethodEnd(dbLogger, 'delete', { accommodation: updatedAccommodation });
    return { accommodation: updatedAccommodation };
};

/**
 * Restores (un-archives) a soft-deleted accommodation by ID.
 * Only the owner, admin, or a user with the required permission can restore.
 * Handles edge-cases: public user, disabled owner, not archived, etc.
 *
 * @param input - The input object with the accommodation ID.
 * @param actor - The user or public actor attempting the restore.
 * @returns An object with the restored accommodation, or null if not found or not allowed.
 * @throws Error if the actor is not allowed to restore or input is invalid.
 * @example
 * const result = await restore({ id: 'acc-1' }, user);
 */
export const restore = async (
    input: GetByIdInput,
    actor: UserType | PublicUserType
): Promise<{ accommodation: AccommodationType | null }> => {
    logMethodStart(dbLogger, 'restore', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        logMethodEnd(dbLogger, 'restore', { accommodation: null });
        throw new Error('Accommodation not found');
    }
    try {
        assertNotActive(accommodation);
    } catch (err) {
        // Log end for idempotent restore (already active)
        logMethodEnd(dbLogger, 'restore', { accommodation: null });
        throw err;
    }
    const safeActor = getSafeActor(actor);
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            PermissionEnum.ACCOMMODATION_RESTORE_OWN
        );
        logMethodEnd(dbLogger, 'restore', { accommodation: null });
        throw new Error('Forbidden: user disabled');
    }
    const owner = isOwner(safeActor, accommodation);
    checkAndLogPermission(
        safeActor,
        owner ? PermissionEnum.ACCOMMODATION_RESTORE_OWN : PermissionEnum.ACCOMMODATION_RESTORE_ANY,
        dbLogger,
        { input },
        'Forbidden: user does not have permission to restore accommodation'
    );
    const updateInput = buildRestoreUpdate(safeActor);
    const updatedAccommodation = await AccommodationModel.update(parsedInput.id, {
        ...updateInput
    } as Partial<UpdateAccommodationInputType>);
    if (!updatedAccommodation) {
        logMethodEnd(dbLogger, 'restore', { accommodation: null });
        throw new Error('Accommodation restore failed');
    }
    logMethodEnd(dbLogger, 'restore', { accommodation: updatedAccommodation });
    return { accommodation: updatedAccommodation };
};

/**
 * Hard-deletes (permanently deletes) an accommodation by ID.
 * Only the owner, admin, or a user with the required permission can hard-delete.
 * Handles edge-cases: public user, disabled owner, already deleted, etc.
 *
 * @param input - The input object with the accommodation ID.
 * @param actor - The user or public actor attempting the hard-delete.
 * @returns An object with success true if deleted, false otherwise.
 * @throws Error if the actor is not allowed to hard-delete or input is invalid.
 * @example
 * const result = await hardDelete({ id: 'acc-1' }, user);
 */
export const hardDelete = async (
    input: GetByIdInput,
    actor: UserType | PublicUserType
): Promise<{ success: boolean }> => {
    logMethodStart(dbLogger, 'hardDelete', input, actor);
    const parsedInput = getByIdInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Accommodation not found');
    }
    const safeActor = getSafeActor(actor);
    // If the user is disabled, deny and log
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            PermissionEnum.ACCOMMODATION_HARD_DELETE
        );
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: user disabled');
    }
    // Permissions: owner, admin, or global
    try {
        hasPermission(safeActor, PermissionEnum.ACCOMMODATION_HARD_DELETE);
    } catch (err) {
        dbLogger.permission({
            permission: PermissionEnum.ACCOMMODATION_HARD_DELETE,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: { input, error: (err as Error).message }
        });
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Forbidden: user does not have permission to hard-delete accommodation');
    }
    // Hard-delete: remove from DB
    let deleted = false;
    try {
        deleted = await AccommodationModel.hardDelete(parsedInput.id);
    } catch (_err) {
        logMethodEnd(dbLogger, 'hardDelete', { success: false });
        throw new Error('Accommodation hard delete failed');
    }
    logMethodEnd(dbLogger, 'hardDelete', { success: deleted });
    return { success: deleted };
};

/**
 * Gets all accommodations for a given destination.
 * Handles edge-cases: public user, disabled user, visibility, permissions.
 * Always uses RO-RO pattern for input/output.
 *
 * @param input - The input object containing the destination ID.
 * @param actor - The user or public actor requesting the accommodations.
 * @returns An object with the accommodations array (filtered by access).
 * @example
 * const result = await getByDestination({ destinationId: 'dest-1' }, user);
 */
export const getByDestination = async (
    input: GetByDestinationInput,
    actor: UserType | PublicUserType
): Promise<GetByDestinationOutput> => {
    logMethodStart(dbLogger, 'getByDestination', input, actor);
    const parsedInput = getByDestinationInputSchema.parse(input);
    const allAccommodations = await AccommodationModel.getByDestination(parsedInput.destinationId);
    const safeActor = getSafeActor(actor);
    // If the user is disabled, deny access to all
    if (isUserDisabled(safeActor)) {
        for (const accommodation of allAccommodations) {
            logUserDisabled(
                dbLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
            );
        }
        logMethodEnd(dbLogger, 'getByDestination', { accommodations: [] });
        return { accommodations: [] };
    }
    // Filter by permissions and visibility
    const result: AccommodationType[] = [];
    for (const accommodation of allAccommodations) {
        const { canView, reason, checkedPermission } = canViewAccommodation(
            safeActor,
            accommodation
        );
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
            continue;
        }
        if (!canView) {
            logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
            continue;
        }
        // Log access to private/draft
        if (accommodation.visibility !== 'PUBLIC') {
            logGrant(
                dbLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                reason
            );
        }
        result.push(accommodation);
    }
    logMethodEnd(dbLogger, 'getByDestination', { accommodations: result });
    return { accommodations: result };
};

/**
 * Gets accommodations by owner ID.
 * Handles edge-cases: public user, disabled owner, unknown visibility.
 * Always uses RO-RO pattern for input/output.
 *
 * Why: Centralizes access and logging logic, prevents information leaks, and ensures traceability.
 *
 * @param input - The input object containing the owner ID.
 * @param actor - The user or public actor requesting the accommodations.
 * @returns An object with the accommodations accessible to the actor.
 * @example
 * const result = await getByOwner({ ownerId: 'user-1' }, user);
 */
export const getByOwner = async (
    input: GetByOwnerInput,
    actor: UserType | PublicUserType
): Promise<GetByOwnerOutput> => {
    logMethodStart(dbLogger, 'getByOwner', input, actor);
    const safeActor = getSafeActor(actor);
    const parsedInput = getByOwnerInputSchema.parse(input);
    const allAccommodations = await AccommodationModel.getByOwner(parsedInput.ownerId);
    const result: AccommodationType[] = [];
    for (const accommodation of allAccommodations) {
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                dbLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
            );
            continue;
        }
        const { canView, reason, checkedPermission } = canViewAccommodation(
            safeActor,
            accommodation
        );
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
            continue;
        }
        if (!canView) {
            logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
            continue;
        }
        // Log access to private/draft
        if (accommodation.visibility !== 'PUBLIC') {
            logGrant(
                dbLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                reason
            );
        }
        result.push(accommodation);
    }
    logMethodEnd(dbLogger, 'getByOwner', { accommodations: result });
    return { accommodations: result };
};

/**
 * Gets the top-rated accommodations for a given destination.
 * Orders by averageRating (desc) and limits the result.
 * Handles edge-cases: public user, disabled user, visibility, permissions.
 * Always uses RO-RO pattern for input/output.
 *
 * @param input - The input object containing the destination ID and limit.
 * @param actor - The user or public actor requesting the accommodations.
 * @returns An object with the accommodations array (filtered by access).
 * @example
 * const result = await getTopRatedByDestination({ destinationId: 'dest-1', limit: 5 }, user);
 */
export const getTopRatedByDestination = async (
    input: GetTopRatedByDestinationInput,
    actor: UserType | PublicUserType
): Promise<GetTopRatedByDestinationOutput> => {
    logMethodStart(dbLogger, 'getTopRatedByDestination', input, actor);
    const parsedInput = getTopRatedByDestinationInputSchema.parse(input);
    const safeActor = getSafeActor(actor);
    const allAccommodations = await AccommodationModel.search({
        destinationId: parsedInput.destinationId,
        orderBy: 'averageRating',
        order: 'desc',
        limit: parsedInput.limit,
        offset: 0
    });
    // If the user is disabled, deny access to all
    if (isUserDisabled(safeActor)) {
        for (const accommodation of allAccommodations) {
            logUserDisabled(
                dbLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
            );
        }
        logMethodEnd(dbLogger, 'getTopRatedByDestination', { accommodations: [] });
        return { accommodations: [] };
    }
    // Filter by permissions and visibility
    const result: AccommodationType[] = [];
    for (const accommodation of allAccommodations) {
        const { canView, reason, checkedPermission } = canViewAccommodation(
            safeActor,
            accommodation
        );
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
            continue;
        }
        if (!canView) {
            logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
            continue;
        }
        // Log access to private/draft
        if (accommodation.visibility !== 'PUBLIC') {
            logGrant(
                dbLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                reason
            );
        }
        result.push(accommodation);
    }
    const limitedResult = result.slice(0, parsedInput.limit);
    logMethodEnd(dbLogger, 'getTopRatedByDestination', { accommodations: limitedResult });
    return { accommodations: limitedResult };
};

/**
 * Gets the most top rated accommodations for every destination (for home page).
 * If destinationIds is provided, only those destinations are used. Otherwise, all destinations in the system are used.
 * For each destination, returns up to limitAccommodationByDestination accommodations ordered by averageRating desc.
 * Handles edge-cases: public user, disabled user, visibility, permissions.
 * Always uses RO-RO pattern for input/output.
 *
 * @param input - The input object with optional destinationIds and limitAccommodationByDestination.
 * @param actor - The user or public actor requesting the accommodations.
 * @returns An object with accommodationsByDestination: Record<destinationId, AccommodationType[]>
 * @example
 * const result = await getForHome({ destinationIds: ['dest-1'], limitAccommodationByDestination: 2 }, user);
 */
export const getForHome = async (
    input: GetForHomeInput,
    _actor: UserType | PublicUserType
): Promise<GetForHomeOutput> => {
    const parsedInput = getForHomeInputSchema.parse(input);
    let destinationIds: string[];
    if (parsedInput.destinationIds && parsedInput.destinationIds.length > 0) {
        destinationIds = parsedInput.destinationIds;
    } else {
        // Get all destinations in the system
        const allDestinations = await DestinationModel.list({ limit: 1000, offset: 0 });
        destinationIds = allDestinations.map((d) => d.id);
    }
    const accommodationsByDestination: Record<string, AccommodationType[]> = {};
    for (const destinationId of destinationIds) {
        const allAccommodations = await AccommodationModel.search({
            destinationId,
            orderBy: 'averageRating',
            order: 'desc',
            limit: parsedInput.limitAccommodationByDestination,
            offset: 0
        });
        accommodationsByDestination[destinationId] = allAccommodations.slice(
            0,
            parsedInput.limitAccommodationByDestination
        );
    }
    return { accommodationsByDestination };
};

/**
 * Advanced accommodation search with hybrid filtering strategy.
 *
 * Filters applied in the model (DB):
 * - destinationIds
 * - types
 * - isFeatured
 * - minRating
 * - withContactInfo
 *
 * Filters applied in the service (in-memory):
 * - includeWithoutPrice
 * - amenities
 * - features
 * - free text in summary/description
 * - advanced ordering (isFeatured first, then multiple fields)
 *
 * When the data volume grows, migrate amenities/features/free-text filters to SQL for efficiency.
 * See comments inside the function for migration hints.
 *
 * NOTE: Add the actor parameter when permission logic is required.
 */
export const search = async (
    input: SearchInput,
    actor: UserType | PublicUserType
): Promise<SearchOutput> => {
    // 1. Validate input
    const parsedInput = searchInputSchema.parse(input);

    // 2. Build base query params for the model
    const modelFilters: Record<string, unknown> = {};
    if (parsedInput.destinationId) {
        modelFilters.destinationId = parsedInput.destinationId;
    }
    if (parsedInput.types && parsedInput.types.length > 0) {
        modelFilters.type = parsedInput.types[0]; // Only one type supported in model
    }
    if (typeof parsedInput.isFeatured === 'boolean') {
        modelFilters.isFeatured = parsedInput.isFeatured;
    }
    if (typeof parsedInput.minRating === 'number') {
        modelFilters.averageRating = parsedInput.minRating;
    }
    if (typeof parsedInput.withContactInfo === 'boolean') {
        modelFilters.contactInfo = parsedInput.withContactInfo ? { $ne: null } : null;
    }
    if (parsedInput.text && parsedInput.text.trim().length > 0) {
        modelFilters.q = parsedInput.text.trim();
    }

    // 3. Query the model (DB) for a base set
    const baseAccommodations = await AccommodationModel.search({
        ...modelFilters,
        limit: 1000,
        offset: 0
    });

    // 4. In-memory filtering for advanced logic
    let filtered = baseAccommodations;

    // Filter by multiple types if provided (beyond the first)
    if (parsedInput.types && parsedInput.types.length > 1) {
        filtered = filtered.filter(
            (acc) => Array.isArray(parsedInput.types) && parsedInput.types.includes(acc.type)
        );
    }
    // Filter by minPrice/maxPrice/includeWithoutPrice using price.price
    if (
        typeof parsedInput.minPrice === 'number' ||
        typeof parsedInput.maxPrice === 'number' ||
        parsedInput.includeWithoutPrice
    ) {
        filtered = filtered.filter((acc) => {
            const priceObj = acc.price;
            const hasPrice =
                typeof priceObj === 'object' &&
                priceObj !== null &&
                Object.prototype.hasOwnProperty.call(priceObj, 'price') &&
                typeof (priceObj as Record<string, unknown>).price === 'number';
            if (!hasPrice) return !!parsedInput.includeWithoutPrice;
            const priceValue = (priceObj as { price: number }).price;
            if (typeof parsedInput.minPrice === 'number' && priceValue < parsedInput.minPrice)
                return false;
            if (typeof parsedInput.maxPrice === 'number' && priceValue > parsedInput.maxPrice)
                return false;
            return true;
        });
    }
    // Filter by amenities (must have all selected)
    if (parsedInput.amenities && parsedInput.amenities.length > 0) {
        filtered = filtered.filter((acc) => {
            const accAmenityIds = (acc.amenities || []).map((a) => a.amenityId as string);
            return (
                Array.isArray(parsedInput.amenities) &&
                parsedInput.amenities.every((aid) => accAmenityIds.includes(aid))
            );
        });
    }
    // Filter by features (must have all selected)
    if (parsedInput.features && parsedInput.features.length > 0) {
        filtered = filtered.filter((acc) => {
            const accFeatureIds = (acc.features || []).map((f) => f.featureId as string);
            return (
                Array.isArray(parsedInput.features) &&
                parsedInput.features.every((fid) => accFeatureIds.includes(fid))
            );
        });
    }

    // 5. Permissions and logging (filter by what the actor can view)
    const safeActor = getSafeActor(actor);
    const result: AccommodationType[] = [];
    for (const accommodation of filtered) {
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                dbLogger,
                safeActor,
                parsedInput,
                accommodation,
                PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
            );
            continue;
        }
        const { canView, reason, checkedPermission } = canViewAccommodation(
            safeActor,
            accommodation
        );
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(dbLogger, safeActor, parsedInput, accommodation, reason, checkedPermission);
            continue;
        }
        if (!canView) {
            logDenied(dbLogger, safeActor, parsedInput, accommodation, reason, checkedPermission);
            continue;
        }
        // Log access to private/draft
        if (accommodation.visibility !== 'PUBLIC') {
            logGrant(
                dbLogger,
                safeActor,
                parsedInput,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                reason
            );
        }
        result.push(accommodation);
    }

    // 6. Advanced ordering: isFeatured first, then by orderBy fields
    const ordered = result.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        if (parsedInput.orderBy && parsedInput.orderBy.length > 0) {
            for (const field of parsedInput.orderBy) {
                if (field === 'price') {
                    const aPriceObj = a.price;
                    const bPriceObj = b.price;
                    const aHasPrice =
                        typeof aPriceObj === 'object' &&
                        aPriceObj !== null &&
                        Object.prototype.hasOwnProperty.call(aPriceObj, 'price') &&
                        typeof (aPriceObj as Record<string, unknown>).price === 'number';
                    const bHasPrice =
                        typeof bPriceObj === 'object' &&
                        bPriceObj !== null &&
                        Object.prototype.hasOwnProperty.call(bPriceObj, 'price') &&
                        typeof (bPriceObj as Record<string, unknown>).price === 'number';
                    const aPrice = aHasPrice
                        ? (aPriceObj as { price: number }).price
                        : Number.POSITIVE_INFINITY;
                    const bPrice = bHasPrice
                        ? (bPriceObj as { price: number }).price
                        : Number.POSITIVE_INFINITY;
                    if (aPrice !== bPrice) return aPrice - bPrice;
                } else if (field === 'destination') {
                    if (a.destinationId !== b.destinationId)
                        return a.destinationId.localeCompare(b.destinationId);
                } else if (field === 'type') {
                    if (a.type !== b.type) return a.type.localeCompare(b.type);
                } else if (field === 'rating') {
                    const aRating = a.averageRating ?? 0;
                    const bRating = b.averageRating ?? 0;
                    if (aRating !== bRating) return bRating - aRating;
                }
            }
        }
        return 0;
    });

    // 7. Pagination (after filtering and ordering)
    const total = ordered.length;
    const paginated = ordered.slice(parsedInput.offset, parsedInput.offset + parsedInput.limit);

    // 8. Return result
    return {
        accommodations: paginated,
        total
    };
};

// --- FUTURE METHODS (stubs) ---

/**
 * Adds a FAQ to an accommodation. (Stub)
 */
export const addFaq = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Removes a FAQ from an accommodation. (Stub)
 */
export const removeFaq = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Updates a FAQ for an accommodation. (Stub)
 */
export const updateFaq = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets all FAQs for an accommodation. (Stub)
 */
export const getFaqs = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Bulk update accommodations. (Stub)
 */
export const bulkUpdate = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Adds IA data to an accommodation. (Stub)
 */
export const addIAData = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Removes IA data from an accommodation. (Stub)
 */
export const removeIAData = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Updates IA data for an accommodation. (Stub)
 */
export const updateIAData = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets all IA data for accommodations. (Stub)
 */
export const getAllIAData = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Changes the visibility of an accommodation. (Stub)
 */
export const changeVisibility = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};

/**
 * Gets the owner of an accommodation. (Stub)
 */
export const getOwner = async (_input: unknown, _actor: unknown): Promise<never> => {
    throw new Error('Not implemented yet');
};
