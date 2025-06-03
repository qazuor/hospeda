import {
    type NewAccommodationInputType,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UpdateAccommodationInputType,
    type UserType
} from '@repo/types';
import type { AccommodationId as CommonAccommodationId } from '@repo/types/common/id.types';
import {
    AccommodationModel,
    type AccommodationOrderByColumn
} from '../../models/accommodation/accommodation.model';
import { dbLogger, hasPermission } from '../../utils';
import { castBrandedIds, castDateFields } from '../../utils/cast-helper';
import { logDenied, logGrant, logOverride, logUserDisabled } from '../../utils/permission-logger';
import {
    CanViewReasonEnum,
    canViewAccommodation,
    getSafeActor,
    isPublicUser,
    isUserDisabled
} from './accommodation.helper';
import {
    type CreateInput,
    type CreateOutput,
    type GetByIdInput,
    type GetByIdOutput,
    type GetByNameInput,
    type GetByNameOutput,
    type ListInput,
    type ListOutput,
    type UpdateInput,
    type UpdateOutput,
    createInputSchema,
    getByIdInputSchema,
    getByNameInputSchema,
    listInputSchema,
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
    // Log the start of the operation
    dbLogger.info({ input, actor }, 'getById:start');
    // Validate and parse input
    const parsedInput = getByIdInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
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
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
        return { accommodation: null };
    }
    // Handle unknown visibility
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
        throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
    }
    // If cannot view, log and return null (prevents information leaks)
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
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
    dbLogger.info({ result: { accommodation } }, 'getById:end');
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
    dbLogger.info({ input, actor }, 'getByName:start');
    const parsedInput = getByNameInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getByName(parsedInput.name)) ?? null;
    if (!accommodation) {
        dbLogger.info({ result: { accommodation: null } }, 'getByName:end');
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
        dbLogger.info({ result: { accommodation: null } }, 'getByName:end');
        return { accommodation: null };
    }
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'getByName:end');
        throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
    }
    // If cannot view, log and return null (prevents information leaks).
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'getByName:end');
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
    dbLogger.info({ result: { accommodation } }, 'getByName:end');
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
    dbLogger.info({ input, actor }, 'list:start');
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
    // Only allow public visibility for public users
    const searchParams: Record<string, unknown> = isPublic
        ? { visibility: 'PUBLIC', limit: parsedInput.limit, offset: parsedInput.offset }
        : {
              q: parsedInput.q,
              type: parsedInput.type,
              limit: parsedInput.limit,
              offset: parsedInput.offset,
              order: parsedInput.order,
              orderBy: parsedInput.orderBy as AccommodationOrderByColumn | undefined,
              ...(parsedInput.visibility ? { visibility: parsedInput.visibility } : {})
          };
    const cleanParams = Object.fromEntries(
        Object.entries(searchParams).filter(([_, v]) => v !== undefined)
    );
    // biome-ignore lint/suspicious/noExplicitAny: required for type compatibility in searchParams
    const accommodations = await AccommodationModel.search(cleanParams as any);
    dbLogger.info({ result: { accommodations } }, 'list:end');
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
    dbLogger.info({ input, actor }, 'create:start');
    // Always use a safe actor (public fallback)
    const safeActor = getSafeActor(actor); // Prevents bugs and ensures consistency in access logic.
    // Edge-case: public user cannot create accommodations
    if (isPublicUser(safeActor)) {
        logOverride(
            dbLogger,
            input,
            PermissionEnum.ACCOMMODATION_CREATE,
            'Public user cannot create accommodations'
        );
        throw new Error('Forbidden: Public user cannot create accommodations');
    }
    // Permission check (now with try/catch)
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
    const inputWithBrandedIds = castBrandedIds(parsedInput, (id) => id as CommonAccommodationId);
    const inputWithDates = castDateFields(inputWithBrandedIds);
    const accommodation = await AccommodationModel.create(
        inputWithDates as NewAccommodationInputType
    );
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
    dbLogger.info({ result: { accommodation } }, 'create:end');
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
    dbLogger.info({ input, actor }, 'update:start');
    const parsedInput = updateInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        dbLogger.info({ result: { accommodation: null } }, 'update:end');
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
    // If the user is disabled, explicitly deny access and log.
    if (isUserDisabled(safeActor)) {
        logUserDisabled(
            dbLogger,
            safeActor,
            input,
            accommodation,
            PermissionEnum.ACCOMMODATION_UPDATE_OWN
        );
        dbLogger.info({ result: { accommodation: null } }, 'update:end');
        throw new Error('Forbidden: user disabled');
    }
    // Only owner, admin, or user with permission can update
    const isOwner = 'id' in safeActor && accommodation.ownerId === safeActor.id;
    const isAdmin =
        'role' in safeActor &&
        (safeActor.role === RoleEnum.ADMIN || safeActor.role === RoleEnum.SUPER_ADMIN);
    try {
        if (isOwner) {
            hasPermission(safeActor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);
        } else if (isAdmin) {
            hasPermission(safeActor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        } else {
            hasPermission(safeActor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        }
    } catch (err) {
        dbLogger.permission({
            permission: isOwner
                ? PermissionEnum.ACCOMMODATION_UPDATE_OWN
                : PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: { input, error: (err as Error).message }
        });
        dbLogger.info({ result: { accommodation: null } }, 'update:end');
        throw new Error('Forbidden: user does not have permission to update accommodation');
    }
    // If cannot view, log and deny update
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'update:end');
        throw new Error('Forbidden: cannot view accommodation');
    }
    // Cast ownerId and destinationId to their branded types if present
    const inputWithBrandedIds = castBrandedIds(parsedInput, (id) => id as CommonAccommodationId);
    const inputWithDates = castDateFields(inputWithBrandedIds);
    const updatedAccommodation = await AccommodationModel.update(
        parsedInput.id,
        inputWithDates as UpdateAccommodationInputType
    );
    if (!updatedAccommodation) {
        dbLogger.info({ result: { accommodation: null } }, 'update:end');
        throw new Error('Accommodation update failed');
    }
    dbLogger.info({ result: { accommodation: updatedAccommodation } }, 'update:end');
    return { accommodation: updatedAccommodation };
};
