import {
    type AccommodationType,
    PermissionEnum,
    type PublicUserType,
    RoleEnum,
    type UpdateAccommodationInputType,
    type UserType
} from '@repo/types';
import { AccommodationModel } from '../../models/accommodation/accommodation.model';
import { hasPermission, serviceLogger } from '../../utils';
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
    getTopRatedByDestinationInputSchema,
    listInputSchema,
    searchInputSchema,
    updateInputSchema
} from './accommodation.schemas';

export const AccommodationService = {
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
    async getById(input: GetByIdInput, actor: UserType | PublicUserType): Promise<GetByIdOutput> {
        logMethodStart(serviceLogger, 'getById', input, actor);
        const parsedInput = getByIdInputSchema.parse(input);
        const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
        if (!accommodation) {
            logMethodEnd(serviceLogger, 'getById', { accommodation: null });
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
                serviceLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
            );
            logMethodEnd(serviceLogger, 'getById', { accommodation: null });
            return { accommodation: null };
        }
        // Handle unknown visibility
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(serviceLogger, safeActor, input, accommodation, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getById', { accommodation: null });
            throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
        }
        // If cannot view, log and return null (prevents information leaks)
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, accommodation, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getById', { accommodation: null });
            return { accommodation: null };
        }
        // Log successful access to private/draft for traceability and audit
        if (accommodation.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getById', { accommodation });
        return { accommodation };
    },
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
    async getByName(
        input: GetByNameInput,
        actor: UserType | PublicUserType
    ): Promise<GetByNameOutput> {
        logMethodStart(serviceLogger, 'getByName', input, actor);
        const parsedInput = getByNameInputSchema.parse(input);
        const accommodation = (await AccommodationModel.getByName(parsedInput.name)) ?? null;
        if (!accommodation) {
            logMethodEnd(serviceLogger, 'getByName', { accommodation: null });
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
                serviceLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
            );
            logMethodEnd(serviceLogger, 'getByName', { accommodation: null });
            return { accommodation: null };
        }
        if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
            logDenied(serviceLogger, safeActor, input, accommodation, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getByName', { accommodation: null });
            throw new Error(`Unknown accommodation visibility: ${accommodation.visibility}`);
        }
        // If cannot view, log and return null (prevents information leaks).
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, accommodation, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'getByName', { accommodation: null });
            return { accommodation: null };
        }
        // Log successful access to private/draft for traceability and audit.
        if (accommodation.visibility !== 'PUBLIC') {
            logGrant(
                serviceLogger,
                safeActor,
                input,
                accommodation,
                checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                reason
            );
        }
        logMethodEnd(serviceLogger, 'getByName', { accommodation });
        return { accommodation };
    },
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
    async list(input: ListInput, actor: UserType | PublicUserType): Promise<ListOutput> {
        logMethodStart(serviceLogger, 'list', input, actor);
        const parsedInput = listInputSchema.parse(input);
        // Always use a safe actor (public fallback)
        const safeActor = getSafeActor(actor); // Prevents bugs and ensures consistency in access logic.
        // Edge-case: public user can only see PUBLIC accommodations
        const isPublic = isPublicUser(safeActor); // Centralizes public user logic.
        if (isPublic && parsedInput.visibility && parsedInput.visibility !== 'PUBLIC') {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.ACCOMMODATION_VIEW_ALL,
                'Forced visibility=PUBLIC for public user'
            );
        }
        // Use helper to build and clean search params
        const cleanParams = buildSearchParams(parsedInput, safeActor);
        // biome-ignore lint/suspicious/noExplicitAny: required for type compatibility in searchParams
        const accommodations = await AccommodationModel.search(cleanParams as any);
        logMethodEnd(serviceLogger, 'list', { accommodations });
        return { accommodations };
    },
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
    async create(input: CreateInput, actor: UserType | PublicUserType): Promise<CreateOutput> {
        logMethodStart(serviceLogger, 'create', input, actor);
        const safeActor = getSafeActor(actor);
        if (isPublicUser(safeActor)) {
            logOverride(
                serviceLogger,
                input,
                PermissionEnum.ACCOMMODATION_CREATE,
                'Public user cannot create accommodations'
            );
            throw new Error('Forbidden: Public user cannot create accommodations');
        }
        try {
            hasPermission(safeActor, PermissionEnum.ACCOMMODATION_CREATE);
        } catch (err) {
            serviceLogger.permission({
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
                serviceLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_CREATE,
                'created'
            );
        }
        logMethodEnd(serviceLogger, 'create', { accommodation });
        return { accommodation };
    },
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
    async update(input: UpdateInput, actor: UserType | PublicUserType): Promise<UpdateOutput> {
        logMethodStart(serviceLogger, 'update', input, actor);
        const parsedInput = updateInputSchema.parse(input);
        const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
        if (!accommodation) {
            logMethodEnd(serviceLogger, 'update', { accommodation: null });
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
                serviceLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_UPDATE_OWN
            );
            logMethodEnd(serviceLogger, 'update', { accommodation: null });
            throw new Error('Forbidden: user disabled');
        }
        // Use helper for owner check
        const owner = isOwner(safeActor, accommodation);
        // Use helper for permission check and logging
        checkAndLogPermission(
            safeActor,
            owner
                ? PermissionEnum.ACCOMMODATION_UPDATE_OWN
                : PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            serviceLogger,
            { input },
            'Forbidden: user does not have permission to update accommodation'
        );
        if (!canView) {
            logDenied(serviceLogger, safeActor, input, accommodation, reason, checkedPermission);
            logMethodEnd(serviceLogger, 'update', { accommodation: null });
            throw new Error('Forbidden: cannot view accommodation');
        }
        const normalizedUpdateInput = normalizeUpdateInput(accommodation, parsedInput);
        const updatedAccommodation = await AccommodationModel.update(
            parsedInput.id,
            normalizedUpdateInput as UpdateAccommodationInputType
        );
        if (!updatedAccommodation) {
            logMethodEnd(serviceLogger, 'update', { accommodation: null });
            throw new Error('Accommodation update failed');
        }
        logMethodEnd(serviceLogger, 'update', { accommodation: updatedAccommodation });
        return { accommodation: updatedAccommodation };
    },
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
    async softDelete(
        input: GetByIdInput,
        actor: UserType | PublicUserType
    ): Promise<{ accommodation: AccommodationType | null }> {
        logMethodStart(serviceLogger, 'delete', input, actor);
        const parsedInput = getByIdInputSchema.parse(input);
        const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
        if (!accommodation) {
            logMethodEnd(serviceLogger, 'delete', { accommodation: null });
            throw new Error('Accommodation not found');
        }
        try {
            assertNotArchived(accommodation);
        } catch (err) {
            logMethodEnd(serviceLogger, 'delete', { accommodation: null });
            throw err;
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_DELETE_OWN
            );
            logMethodEnd(serviceLogger, 'delete', { accommodation: null });
            throw new Error('Forbidden: user disabled');
        }
        const owner = isOwner(safeActor, accommodation);
        checkAndLogPermission(
            safeActor,
            owner
                ? PermissionEnum.ACCOMMODATION_DELETE_OWN
                : PermissionEnum.ACCOMMODATION_DELETE_ANY,
            serviceLogger,
            { input },
            'Forbidden: user does not have permission to delete accommodation'
        );
        const updateInput = buildSoftDeleteUpdate(safeActor);
        const updatedAccommodation = await AccommodationModel.update(parsedInput.id, {
            ...updateInput
        } as Partial<UpdateAccommodationInputType>);
        if (!updatedAccommodation) {
            logMethodEnd(serviceLogger, 'delete', { accommodation: null });
            throw new Error('Accommodation delete failed');
        }
        logMethodEnd(serviceLogger, 'delete', { accommodation: updatedAccommodation });
        return { accommodation: updatedAccommodation };
    },
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
    async restore(
        input: GetByIdInput,
        actor: UserType | PublicUserType
    ): Promise<{ accommodation: AccommodationType | null }> {
        logMethodStart(serviceLogger, 'restore', input, actor);
        const parsedInput = getByIdInputSchema.parse(input);
        const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
        if (!accommodation) {
            logMethodEnd(serviceLogger, 'restore', { accommodation: null });
            throw new Error('Accommodation not found');
        }
        try {
            assertNotActive(accommodation);
        } catch (err) {
            // Log end for idempotent restore (already active)
            logMethodEnd(serviceLogger, 'restore', { accommodation: null });
            throw err;
        }
        const safeActor = getSafeActor(actor);
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_RESTORE_OWN
            );
            logMethodEnd(serviceLogger, 'restore', { accommodation: null });
            throw new Error('Forbidden: user disabled');
        }
        const owner = isOwner(safeActor, accommodation);
        checkAndLogPermission(
            safeActor,
            owner
                ? PermissionEnum.ACCOMMODATION_RESTORE_OWN
                : PermissionEnum.ACCOMMODATION_RESTORE_ANY,
            serviceLogger,
            { input },
            'Forbidden: user does not have permission to restore accommodation'
        );
        const updateInput = buildRestoreUpdate(safeActor);
        const updatedAccommodation = await AccommodationModel.update(parsedInput.id, {
            ...updateInput
        } as Partial<UpdateAccommodationInputType>);
        if (!updatedAccommodation) {
            logMethodEnd(serviceLogger, 'restore', { accommodation: null });
            throw new Error('Accommodation restore failed');
        }
        logMethodEnd(serviceLogger, 'restore', { accommodation: updatedAccommodation });
        return { accommodation: updatedAccommodation };
    },
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
    async hardDelete(
        input: GetByIdInput,
        actor: UserType | PublicUserType
    ): Promise<{ success: boolean }> {
        logMethodStart(serviceLogger, 'hardDelete', input, actor);
        const parsedInput = getByIdInputSchema.parse(input);
        const accommodation = (await AccommodationModel.getById(parsedInput.id)) ?? null;
        if (!accommodation) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Accommodation not found');
        }
        const safeActor = getSafeActor(actor);
        // If the user is disabled, deny and log
        if (isUserDisabled(safeActor)) {
            logUserDisabled(
                serviceLogger,
                safeActor,
                input,
                accommodation,
                PermissionEnum.ACCOMMODATION_HARD_DELETE
            );
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Forbidden: user disabled');
        }
        // Permissions: owner, admin, or global
        try {
            hasPermission(safeActor, PermissionEnum.ACCOMMODATION_HARD_DELETE);
        } catch (err) {
            serviceLogger.permission({
                permission: PermissionEnum.ACCOMMODATION_HARD_DELETE,
                userId: 'id' in safeActor ? safeActor.id : 'public',
                role: 'role' in safeActor ? safeActor.role : RoleEnum.GUEST,
                extraData: { input, error: (err as Error).message }
            });
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error(
                'Forbidden: user does not have permission to hard-delete accommodation'
            );
        }
        // Hard-delete: remove from DB
        let deleted = false;
        try {
            deleted = await AccommodationModel.hardDelete(parsedInput.id);
        } catch (_err) {
            logMethodEnd(serviceLogger, 'hardDelete', { success: false });
            throw new Error('Accommodation hard delete failed');
        }
        logMethodEnd(serviceLogger, 'hardDelete', { success: deleted });
        return { success: deleted };
    },
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
    async getByDestination(
        input: GetByDestinationInput,
        actor: UserType | PublicUserType
    ): Promise<GetByDestinationOutput> {
        logMethodStart(serviceLogger, 'getByDestination', input, actor);
        const parsedInput = getByDestinationInputSchema.parse(input);
        const allAccommodations = await AccommodationModel.search({
            destinationId: parsedInput.destinationId,
            limit: 1000,
            offset: 0
        });
        const safeActor = getSafeActor(actor);
        // If the user is disabled, deny access to all
        if (isUserDisabled(safeActor)) {
            for (const accommodation of allAccommodations) {
                logUserDisabled(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation,
                    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
                );
            }
            logMethodEnd(serviceLogger, 'getByDestination', { accommodations: [] });
            return { accommodations: [] };
        }
        // Filter by permissions and visibility
        const result: AccommodationType[] = [];
        for (const accommodation of allAccommodations as AccommodationType[]) {
            const { canView, reason, checkedPermission } = canViewAccommodation(
                safeActor,
                accommodation as AccommodationType
            );
            if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            if (!canView) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            // Log access to private/draft
            if ((accommodation as AccommodationType).visibility !== 'PUBLIC') {
                logGrant(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                    reason
                );
            }
            result.push(accommodation as AccommodationType);
        }
        logMethodEnd(serviceLogger, 'getByDestination', { accommodations: result });
        return { accommodations: result };
    },
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
    async getByOwner(
        input: GetByOwnerInput,
        actor: UserType | PublicUserType
    ): Promise<GetByOwnerOutput> {
        logMethodStart(serviceLogger, 'getByOwner', input, actor);
        const safeActor = getSafeActor(actor);
        const parsedInput = getByOwnerInputSchema.parse(input);
        const allAccommodations = await AccommodationModel.search({
            ownerId: parsedInput.ownerId,
            limit: 1000,
            offset: 0
        });
        const result: AccommodationType[] = [];
        for (const accommodation of allAccommodations as AccommodationType[]) {
            if (isUserDisabled(safeActor)) {
                logUserDisabled(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
                );
                continue;
            }
            const { canView, reason, checkedPermission } = canViewAccommodation(
                safeActor,
                accommodation as AccommodationType
            );
            if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            if (!canView) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            // Log access to private/draft
            if ((accommodation as AccommodationType).visibility !== 'PUBLIC') {
                logGrant(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                    reason
                );
            }
            result.push(accommodation as AccommodationType);
        }
        logMethodEnd(serviceLogger, 'getByOwner', { accommodations: result });
        return { accommodations: result };
    },
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
    async getTopRatedByDestination(
        input: GetTopRatedByDestinationInput,
        actor: UserType | PublicUserType
    ): Promise<GetTopRatedByDestinationOutput> {
        logMethodStart(serviceLogger, 'getTopRatedByDestination', input, actor);
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
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation,
                    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
                );
            }
            logMethodEnd(serviceLogger, 'getTopRatedByDestination', { accommodations: [] });
            return { accommodations: [] };
        }
        // Filter by permissions and visibility
        const result: AccommodationType[] = [];
        for (const accommodation of allAccommodations as AccommodationType[]) {
            const { canView, reason, checkedPermission } = canViewAccommodation(
                safeActor,
                accommodation as AccommodationType
            );
            if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            if (!canView) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            // Log access to private/draft
            if ((accommodation as AccommodationType).visibility !== 'PUBLIC') {
                logGrant(
                    serviceLogger,
                    safeActor,
                    input,
                    accommodation as AccommodationType,
                    checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                    reason
                );
            }
            result.push(accommodation as AccommodationType);
        }
        const limitedResult = result.slice(0, parsedInput.limit);
        logMethodEnd(serviceLogger, 'getTopRatedByDestination', { accommodations: limitedResult });
        return { accommodations: limitedResult };
    },
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
    async search(input: SearchInput, actor: UserType | PublicUserType): Promise<SearchOutput> {
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
        let filtered: AccommodationType[] = baseAccommodations;

        // Filter by multiple types if provided (beyond the first)
        if (parsedInput.types && parsedInput.types.length > 1) {
            filtered = filtered.filter(
                (acc: AccommodationType) =>
                    Array.isArray(parsedInput.types) && parsedInput.types.includes(acc.type)
            );
        }
        // Filter by minPrice/maxPrice/includeWithoutPrice using price.price
        if (
            typeof parsedInput.minPrice === 'number' ||
            typeof parsedInput.maxPrice === 'number' ||
            parsedInput.includeWithoutPrice
        ) {
            filtered = filtered.filter((acc: AccommodationType) => {
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
            filtered = filtered.filter((acc: AccommodationType) => {
                const accAmenityIds = (acc.amenities || []).map((a) => a.amenityId as string);
                return (
                    Array.isArray(parsedInput.amenities) &&
                    parsedInput.amenities.every((aid) => accAmenityIds.includes(aid))
                );
            });
        }
        // Filter by features (must have all selected)
        if (parsedInput.features && parsedInput.features.length > 0) {
            filtered = filtered.filter((acc: AccommodationType) => {
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
                    serviceLogger,
                    safeActor,
                    parsedInput,
                    accommodation,
                    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
                );
                continue;
            }
            const { canView, reason, checkedPermission } = canViewAccommodation(
                safeActor,
                accommodation as AccommodationType
            );
            if (reason === CanViewReasonEnum.UNKNOWN_VISIBILITY) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    parsedInput,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            if (!canView) {
                logDenied(
                    serviceLogger,
                    safeActor,
                    parsedInput,
                    accommodation as AccommodationType,
                    reason,
                    checkedPermission
                );
                continue;
            }
            // Log access to private/draft
            if ((accommodation as AccommodationType).visibility !== 'PUBLIC') {
                logGrant(
                    serviceLogger,
                    safeActor,
                    parsedInput,
                    accommodation as AccommodationType,
                    checkedPermission ?? PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
                    reason
                );
            }
            result.push(accommodation as AccommodationType);
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
    },
    // --- FUTURE METHODS (stubs) ---
    /**
     * Adds a FAQ to an accommodation. (Stub)
     */
    async addFaq(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Removes a FAQ from an accommodation. (Stub)
     */
    async removeFaq(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Updates a FAQ for an accommodation. (Stub)
     */
    async updateFaq(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets all FAQs for an accommodation. (Stub)
     */
    async getFaqs(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Bulk update accommodations. (Stub)
     */
    async bulkUpdate(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Adds IA data to an accommodation. (Stub)
     *
     * @param _input - Input parameters (not used)
     * @param _actor - Actor (not used)
     * @throws Error always (not implemented)
     */
    async addIAData(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Removes IA data from an accommodation. (Stub)
     *
     * @param _input - Input parameters (not used)
     * @param _actor - Actor (not used)
     * @throws Error always (not implemented)
     */
    async removeIAData(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Updates IA data for an accommodation. (Stub)
     *
     * @param _input - Input parameters (not used)
     * @param _actor - Actor (not used)
     * @throws Error always (not implemented)
     */
    async updateIAData(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets all IA data for accommodations. (Stub)
     *
     * @param _input - Input parameters (not used)
     * @param _actor - Actor (not used)
     * @throws Error always (not implemented)
     */
    async getAllIAData(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Changes the visibility of an accommodation. (Stub)
     *
     * @param _input - Input parameters (not used)
     * @param _actor - Actor (not used)
     * @throws Error always (not implemented)
     */
    async changeVisibility(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    },
    /**
     * Gets the owner of an accommodation. (Stub)
     *
     * @param _input - Input parameters (not used)
     * @param _actor - Actor (not used)
     * @throws Error always (not implemented)
     */
    async getOwner(_input: unknown, _actor: unknown): Promise<never> {
        throw new Error('Not implemented yet');
    }
};
