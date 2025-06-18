import { AccommodationModel } from '@repo/db';
import { logger } from '@repo/logger';
import type {
    AccommodationType,
    NewAccommodationInputType,
    UpdateAccommodationInputType
} from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { BaseService } from '../../base/base.service';
import {
    type Actor,
    type CanCreateResult,
    type CanDeleteResult,
    type CanHardDeleteResult,
    type CanRestoreResult,
    type CanUpdateResult,
    type CanViewResult,
    EntityPermissionReasonEnum,
    type ServiceInput,
    type ServiceOutput
} from '../../types';
import { logDenied } from '../../utils/logging';
import {
    type EntityPermissionActor,
    type EntityPermissionInput,
    getEntityPermission,
    hasPermission
} from '../../utils/permission';
import { validateEntity } from '../../utils/validation';
import { NewAccommodationInputSchema } from './accommodation.schemas';

/**
 * Service for managing accommodations.
 * @extends {BaseService<AccommodationType, AccommodationCreateInput, AccommodationUpdateInput, AccommodationListInput, AccommodationListOutput>}
 */
export class AccommodationService extends BaseService<
    AccommodationType,
    NewAccommodationInputType,
    UpdateAccommodationInputType,
    unknown,
    AccommodationType[]
> {
    protected model = new AccommodationModel();
    protected logger = logger;
    protected inputSchema = NewAccommodationInputSchema as unknown as import(
        'zod'
    ).ZodType<NewAccommodationInputType>;

    /**
     * Creates a new AccommodationService.
     */
    constructor() {
        super('accommodation');
    }

    /**
     * Lists accommodations based on input criteria.
     */
    public async list(input: ServiceInput<unknown>): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation('list', input, async (_actor, input) => {
            const normalizedInput = await this.normalizeListInput(input);
            return await this.model.findAll(normalizedInput as Record<string, unknown>);
        });
    }

    /**
     * Creates a new accommodation.
     */
    public async create(
        input: ServiceInput<NewAccommodationInputType>
    ): Promise<ServiceOutput<AccommodationType>> {
        return this.runWithLoggingAndValidation(
            'create',
            input,
            async (actor, input) => {
                const canCreate = await this.canCreateEntity(actor);
                if (!canCreate.canCreate) {
                    logDenied(actor, input, null, canCreate.reason, 'create');
                    throw new Error(`Cannot create ${this.entityName}`);
                }
                const normalizedInput = await this.normalizeCreateInput(input);
                return await this.model.create(normalizedInput as Partial<AccommodationType>);
            },
            this.inputSchema
        );
    }

    /**
     * Updates an existing accommodation.
     */
    public async update(
        input: ServiceInput<UpdateAccommodationInputType>
    ): Promise<ServiceOutput<AccommodationType>> {
        return this.runWithLoggingAndValidation(
            'update',
            input,
            async (actor, input) => {
                if (!input.id) {
                    throw new Error('Missing accommodation id');
                }
                const entity = (await this.model.findById(input.id)) ?? null;
                if (!entity) {
                    throw new Error(`${this.entityName} not found`);
                }
                validateEntity(entity, this.entityName);
                const canUpdate = await this.canUpdateEntity(actor, entity);
                if (!canUpdate.canUpdate) {
                    logDenied(actor, input, entity, canUpdate.reason, 'update');
                    throw new Error(`Cannot update ${this.entityName}`);
                }
                const normalizedInput = await this.normalizeUpdateInput(input);
                const updated = await this.model.update(
                    { id: input.id },
                    normalizedInput as Partial<AccommodationType>
                );
                if (!updated) {
                    throw new Error('Accommodation not found after update');
                }
                return updated;
            },
            this.inputSchema
        );
    }

    /**
     * Searches for accommodations.
     */
    public async search(input: ServiceInput<unknown>): Promise<ServiceOutput<AccommodationType[]>> {
        return this.runWithLoggingAndValidation('search', input, async (_actor, input) => {
            return await this.searchEntities(input);
        });
    }

    /**
     * Checks if an actor can view an accommodation.
     */
    protected async canViewEntity(actor: Actor, entity: AccommodationType): Promise<CanViewResult> {
        if (entity.deletedAt) {
            return { canView: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        if (entity.isFeatured) {
            return { canView: true, reason: EntityPermissionReasonEnum.PUBLIC_ACCESS };
        }
        if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL)) {
            return { canView: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'view'
        );
        return {
            canView: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Checks if an actor can update an accommodation.
     */
    protected async canUpdateEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanUpdateResult> {
        if (entity.deletedAt) {
            return { canUpdate: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        const isAdmin = actor.role === 'ADMIN';
        const isHost = actor.role === 'HOST';
        const isOwner = actor.id === entity.ownerId;
        const hasAny = isAdmin && hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        const hasOwn =
            isOwner &&
            (isHost || isAdmin) &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_UPDATE_OWN);
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'update',
            { hasAny, hasOwn }
        );
        return {
            canUpdate: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Checks if an actor can delete an accommodation.
     */
    protected async canDeleteEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanDeleteResult> {
        if (entity.deletedAt) {
            return { canDelete: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        const isAdmin = actor.role === 'ADMIN';
        const isHost = actor.role === 'HOST';
        const isOwner = actor.id === entity.ownerId;
        const hasAny = isAdmin && hasPermission(actor, PermissionEnum.ACCOMMODATION_DELETE_ANY);
        const hasOwn =
            isOwner &&
            (isHost || isAdmin) &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_DELETE_OWN);
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'delete',
            { hasAny, hasOwn }
        );
        return {
            canDelete: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Checks if an actor can create an accommodation.
     */
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_CREATE)) {
            return { canCreate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canCreate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if an actor can restore an accommodation.
     */
    protected async canRestoreEntity(
        actor: Actor,
        entity: AccommodationType
    ): Promise<CanRestoreResult> {
        if (entity.deletedAt) {
            return { canRestore: false, reason: EntityPermissionReasonEnum.DELETED };
        }
        const isAdmin = actor.role === 'ADMIN';
        const isHost = actor.role === 'HOST';
        const isOwner = actor.id === entity.ownerId;
        const hasAny = isAdmin && hasPermission(actor, PermissionEnum.ACCOMMODATION_RESTORE_ANY);
        const hasOwn =
            isOwner &&
            (isHost || isAdmin) &&
            hasPermission(actor, PermissionEnum.ACCOMMODATION_RESTORE_OWN);
        const result = getEntityPermission(
            actor as EntityPermissionActor,
            entity as EntityPermissionInput,
            'restore',
            { hasAny, hasOwn }
        );
        return {
            canRestore: result.allowed,
            reason: result.reason
        };
    }

    /**
     * Normalizes the input for creating an accommodation.
     * @param {ServiceInput<NewAccommodationInputType>} input - The input to normalize
     * @returns {Promise<ServiceInput<NewAccommodationInputType>>} The normalized input
     */
    protected async normalizeCreateInput(
        input: ServiceInput<NewAccommodationInputType>
    ): Promise<ServiceInput<NewAccommodationInputType>> {
        return {
            ...input,
            visibility: input.visibility ?? 'PRIVATE'
        };
    }

    /**
     * Normalizes the input for updating an accommodation.
     * @param {ServiceInput<UpdateAccommodationInputType>} input - The input to normalize
     * @returns {Promise<ServiceInput<UpdateAccommodationInputType>>} The normalized input
     */
    protected async normalizeUpdateInput(
        input: ServiceInput<UpdateAccommodationInputType>
    ): Promise<ServiceInput<UpdateAccommodationInputType>> {
        return input;
    }

    /**
     * Normalizes the input for listing accommodations.
     * @param {ServiceInput<unknown>} input - The input to normalize
     * @returns {Promise<ServiceInput<unknown>>} The normalized input
     */
    protected async normalizeListInput(
        input: ServiceInput<unknown>
    ): Promise<ServiceInput<unknown>> {
        return input;
    }

    /**
     * Lists accommodations based on input criteria.
     * @param {ServiceInput<unknown>} input - The input containing list criteria
     * @returns {Promise<ServiceOutput<AccommodationType[]>>} The list of accommodations
     */
    protected async listEntities(_input: ServiceInput<unknown>): Promise<AccommodationType[]> {
        return [];
    }

    /**
     * Searches for accommodations.
     * @param {ServiceInput<unknown>} input - The input containing search criteria
     * @returns {Promise<ServiceOutput<AccommodationType[]>>} The search results
     */
    protected async searchEntities(_input: ServiceInput<unknown>): Promise<AccommodationType[]> {
        return [];
    }

    protected canHardDeleteEntity(
        _actor: unknown,
        _entity: AccommodationType
    ): CanHardDeleteResult {
        // TODO: Implement real logic
        return {
            canHardDelete: false,
            reason: EntityPermissionReasonEnum.MISSING_PERMISSION,
            checkedPermission: PermissionEnum.ACCOMMODATION_HARD_DELETE
        };
    }

    /**
     * Wrapper para count que adapta los params a AccommodationSearchParams.
     */
    public async count(params: Record<string, unknown>): Promise<number> {
        return this.model.count(params);
    }
}
