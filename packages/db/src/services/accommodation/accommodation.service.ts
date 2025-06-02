import { AccommodationSchema } from '@repo/schemas';
import {
    type AccommodationId,
    type AccommodationType,
    type DestinationId,
    type NewAccommodationInputType,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UserId,
    type UserType
} from '@repo/types';
import { z } from 'zod';
import {
    ACCOMMODATION_ORDERABLE_COLUMNS,
    AccommodationModel,
    type AccommodationOrderByColumn
} from '../../models/accommodation/accommodation.model';
import { dbLogger, hasPermission } from '../../utils';
import {
    CanViewReasonEnum,
    canViewAccommodation,
    getSafeActor,
    isPublicUser,
    isUserDisabled,
    logDenied
} from './accommodation.helper';

/**
 * Input schema for getById.
 *
 * @example
 * const input = { id: 'acc-1' as AccommodationId };
 */
const getByIdInputSchema = z.object({
    id: z.string().min(1, 'Accommodation ID is required') as unknown as z.ZodType<AccommodationId>
});

/**
 * Input type for getById.
 * @example
 * const input: GetByIdInput = { id: 'acc-1' as AccommodationId };
 */
export type GetByIdInput = z.infer<typeof getByIdInputSchema>;

/**
 * Output type for getById.
 * @example
 * const output: GetByIdOutput = { accommodation: mockAccommodation };
 */
export type GetByIdOutput = { accommodation: AccommodationType | null };

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
    dbLogger.info({ input, actor }, 'getById:start');
    const parsedInput = getByIdInputSchema.parse(input);
    const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
    if (!accommodation) {
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
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
        dbLogger.permission({
            permission: checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: safeActor.id,
            roleId: safeActor.role,
            extraData: {
                input,
                visibility: accommodation.visibility,
                access: 'denied',
                reason: 'user disabled',
                actor: { id: safeActor.id, role: safeActor.role }
            }
        });
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
        return { accommodation: null };
    }
    if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
        throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
    }
    // If cannot view, log and return null (prevents information leaks).
    if (!canView) {
        logDenied(dbLogger, safeActor, input, accommodation, reason, checkedPermission);
        dbLogger.info({ result: { accommodation: null } }, 'getById:end');
        return { accommodation: null };
    }
    // Log successful access to private/draft for traceability and audit.
    if (accommodation.visibility !== 'PUBLIC') {
        dbLogger.permission({
            permission: checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            roleId: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: {
                input,
                visibility: accommodation.visibility,
                access: 'granted',
                reason,
                actor: { id: safeActor.id, role: safeActor.role }
            }
        });
    }
    dbLogger.info({ result: { accommodation } }, 'getById:end');
    return { accommodation };
};

/**
 * Input schema for getByName.
 *
 * @example
 * const input = { name: 'Hotel Uruguay' };
 */
const getByNameInputSchema = z.object({
    name: z.string().min(1, 'Accommodation name is required')
});

/**
 * Input type for getByName.
 * @example
 * const input: GetByNameInput = { name: 'Hotel Uruguay' };
 */
export type GetByNameInput = z.infer<typeof getByNameInputSchema>;

/**
 * Output type for getByName.
 * @example
 * const output: GetByNameOutput = { accommodation: mockAccommodation };
 */
export type GetByNameOutput = { accommodation: AccommodationType | null };

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
        dbLogger.permission({
            permission: checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: safeActor.id,
            roleId: safeActor.role,
            extraData: {
                input,
                visibility: accommodation.visibility,
                access: 'denied',
                reason: 'user disabled',
                actor: { id: safeActor.id, role: safeActor.role }
            }
        });
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
        dbLogger.permission({
            permission: checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: 'id' in safeActor ? safeActor.id : 'public',
            roleId: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
            extraData: {
                input,
                visibility: accommodation.visibility,
                access: 'granted',
                reason,
                actor: { id: safeActor.id, role: safeActor.role }
            }
        });
    }
    dbLogger.info({ result: { accommodation } }, 'getByName:end');
    return { accommodation };
};

/**
 * Input schema for list.
 *
 * @example
 * const input = { limit: 10, offset: 0 };
 */
const listInputSchema = z.object({
    q: z.string().optional(),
    type: z.string().optional(),
    visibility: z.enum(['PUBLIC', 'DRAFT', 'PRIVATE']).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z
        .enum([...ACCOMMODATION_ORDERABLE_COLUMNS] as [
            AccommodationOrderByColumn,
            ...AccommodationOrderByColumn[]
        ])
        .optional()
});

/**
 * Input type for list.
 * @example
 * const input: ListInput = { limit: 10, offset: 0 };
 */
export type ListInput = z.infer<typeof listInputSchema>;

/**
 * Output type for list.
 * @example
 * const output: ListOutput = { accommodations: [mockAccommodation] };
 */
export type ListOutput = { accommodations: AccommodationType[] };

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
        dbLogger.permission({
            permission: PermissionEnum.ACCOMMODATION_VIEW_ALL,
            userId: 'public',
            roleId: RoleEnum.GUEST,
            extraData: { input, override: 'Forced visibility=PUBLIC for public user' }
        });
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
 * Input schema for create.
 *
 * @example
 * const input = { ... };
 */
const createInputSchema = AccommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

/**
 * Input type for create.
 * @example
 * const input: CreateInput = { ... };
 */
export type CreateInput = z.infer<typeof createInputSchema>;

/**
 * Output type for create.
 * @example
 * const output: CreateOutput = { accommodation: mockAccommodation };
 */
export type CreateOutput = { accommodation: AccommodationType };

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
        dbLogger.permission({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: 'public',
            roleId: RoleEnum.GUEST,
            extraData: { input, error: 'Public user cannot create accommodations' }
        });
        throw new Error('Forbidden: Public user cannot create accommodations');
    }
    const parsedInput = createInputSchema.parse(input);
    let deniedReason = '';
    try {
        hasPermission(safeActor, PermissionEnum.ACCOMMODATION_CREATE, {
            logReason: (r) => {
                deniedReason = r;
            }
        });
        if (deniedReason !== '') {
            throw new Error(`Forbidden: ${deniedReason}`);
        }
    } catch (err) {
        dbLogger.permission({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: safeActor.id,
            roleId: safeActor.role,
            extraData: { input, error: (err as Error).message }
        });
        throw err;
    }
    // Cast ownerId and destinationId to their branded types
    const inputWithBrandedIds = {
        ...parsedInput,
        ownerId: parsedInput.ownerId ? (parsedInput.ownerId as UserId) : undefined,
        destinationId: parsedInput.destinationId
            ? (parsedInput.destinationId as DestinationId)
            : undefined
    };
    const accommodation = await AccommodationModel.create(
        inputWithBrandedIds as NewAccommodationInputType
    );
    // Log success for private/draft creations
    if (accommodation.visibility !== 'PUBLIC') {
        dbLogger.permission({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: safeActor.id,
            roleId: safeActor.role,
            extraData: {
                input,
                visibility: accommodation.visibility,
                access: 'granted',
                reason: 'created',
                actor: { id: safeActor.id, role: safeActor.role }
            }
        });
    }
    dbLogger.info({ result: { accommodation } }, 'create:end');
    return { accommodation };
};
