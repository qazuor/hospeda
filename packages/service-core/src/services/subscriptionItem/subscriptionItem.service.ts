import { SubscriptionItemModel } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { SubscriptionItem } from '@repo/schemas/entities/subscriptionItem';
import {
    SubscriptionItemCreateInputSchema,
    SubscriptionItemQuerySchema,
    SubscriptionItemUpdateInputSchema
} from '@repo/schemas/entities/subscriptionItem';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing subscription items. Implements business logic, permissions, and hooks for SubscriptionItem entities.
 * Handles polymorphic associations to 7 different entity types via linkedEntityId + entityType.
 * @extends BaseCrudService
 */
export class SubscriptionItemService extends BaseCrudService<
    SubscriptionItem,
    SubscriptionItemModel,
    typeof SubscriptionItemCreateInputSchema,
    typeof SubscriptionItemUpdateInputSchema,
    typeof SubscriptionItemQuerySchema
> {
    static readonly ENTITY_NAME = 'subscriptionItem';
    protected readonly entityName = SubscriptionItemService.ENTITY_NAME;
    public readonly model: SubscriptionItemModel;

    public readonly createSchema = SubscriptionItemCreateInputSchema;
    public readonly updateSchema = SubscriptionItemUpdateInputSchema;
    public readonly searchSchema = SubscriptionItemQuerySchema;

    /**
     * Initializes a new instance of the SubscriptionItemService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional SubscriptionItemModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: SubscriptionItemModel) {
        super(ctx, SubscriptionItemService.ENTITY_NAME);
        this.model = model ?? new SubscriptionItemModel();
    }

    /**
     * Returns default list relations (no relations for subscription items)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a subscription item.
     * Only ADMIN and users with SUBSCRIPTION_ITEM_CREATE permission can create.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new subscription item.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SUBSCRIPTION_ITEM_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with SUBSCRIPTION_ITEM_CREATE can create subscription items'
            );
        }
    }

    /**
     * Checks if the actor can update a subscription item.
     * Admin or SUBSCRIPTION_ITEM_UPDATE permission holders can update.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription item entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, _entity: SubscriptionItem): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SUBSCRIPTION_ITEM_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update subscription items'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a subscription item.
     * Admin or SUBSCRIPTION_ITEM_DELETE permission holders can soft delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription item entity to be soft deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: SubscriptionItem): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SUBSCRIPTION_ITEM_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can soft delete subscription items'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a subscription item.
     * Only super admins can permanently delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription item entity to be hard deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: SubscriptionItem): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete subscription items'
            );
        }
    }

    /**
     * Checks if the actor can restore a subscription item.
     * Only admins can restore soft deleted subscription items.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription item entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: SubscriptionItem): void {
        if (actor.role !== RoleEnum.ADMIN && actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore subscription items'
            );
        }
    }

    /**
     * Checks if the actor can view a subscription item.
     * Any authenticated user can view subscription items.
     * @param actor - The user or system performing the action.
     * @param _entity - The subscription item entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: SubscriptionItem): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view subscription items'
            );
        }
    }

    /**
     * Checks if the actor can list subscription items.
     * Any authenticated user can list.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list subscription items'
            );
        }
    }

    /**
     * Checks if the actor can search subscription items.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search subscription items'
            );
        }
    }

    /**
     * Checks if the actor can count subscription items.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count subscription items'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for subscription items.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of subscription items matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for subscription items.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of subscription items matching the criteria.
     * @protected
     */
    protected async _executeCount(params: Record<string, unknown>, _actor: Actor) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // POLYMORPHIC VALIDATION METHODS
    // ============================================================================

    /**
     * Validates that a polymorphic reference exists.
     * Checks if the linkedEntityId exists in the target table specified by entityType.
     * @param actor - Actor performing the operation
     * @param linkedEntityId - ID of the linked entity
     * @param entityType - Type of the linked entity
     * @returns ServiceOutput with validation result
     */
    public async validatePolymorphicReference(
        actor: Actor,
        linkedEntityId: string,
        entityType: string
    ): Promise<ServiceOutput<{ valid: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'validatePolymorphicReference',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: linkedEntityId } as SubscriptionItem);

                // Execute validation
                const exists = await this.model.validateEntityExists(
                    linkedEntityId,
                    entityType,
                    undefined
                );

                return { valid: exists };
            }
        });
    }

    /**
     * Generates CLIENT_ACCESS_RIGHT for a subscription item.
     * This is automatically called during creation.
     * @param actor - Actor performing the operation
     * @param subscriptionItemData - Subscription item data
     * @returns ServiceOutput with generated access rights
     */
    public async generateAccessRights(
        actor: Actor,
        subscriptionItemData: {
            sourceId: string;
            sourceType: string;
            linkedEntityId: string;
            entityType: string;
        }
    ): Promise<ServiceOutput<{ accessRight: string }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'generateAccessRights',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canCreate(validatedActor, subscriptionItemData);

                // Generate access right format: SOURCE_TYPE:SOURCE_ID:ENTITY_TYPE:ENTITY_ID
                const accessRight = `${subscriptionItemData.sourceType}:${subscriptionItemData.sourceId}:${subscriptionItemData.entityType}:${subscriptionItemData.linkedEntityId}`;

                return { accessRight };
            }
        });
    }

    // ============================================================================
    // POLYMORPHIC BUSINESS METHODS
    // ============================================================================

    /**
     * Link a source (subscription or purchase) to a target entity
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID (subscription or purchase)
     * @param sourceType - Source type (SUBSCRIPTION or PURCHASE)
     * @param linkedEntityId - Target entity ID
     * @param entityType - Target entity type
     * @returns ServiceOutput with created subscription item
     */
    public async linkToEntity(
        actor: Actor,
        sourceId: string,
        sourceType: string,
        linkedEntityId: string,
        entityType: string
    ): Promise<ServiceOutput<SubscriptionItem>> {
        return this.runWithLoggingAndValidation({
            methodName: 'linkToEntity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canCreate(validatedActor, {
                    sourceId,
                    sourceType,
                    linkedEntityId,
                    entityType
                });

                // Execute linking
                const item = await this.model.linkToEntity(
                    sourceId,
                    sourceType,
                    linkedEntityId,
                    entityType,
                    undefined
                );

                if (!item) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Failed to link entity'
                    );
                }

                return item;
            }
        });
    }

    /**
     * Unlink a source from a target entity
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @param linkedEntityId - Target entity ID
     * @param entityType - Target entity type
     * @returns ServiceOutput with success status
     */
    public async unlinkFromEntity(
        actor: Actor,
        sourceId: string,
        sourceType: string,
        linkedEntityId: string,
        entityType: string
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'unlinkFromEntity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canSoftDelete(validatedActor, { id: sourceId } as SubscriptionItem);

                // Execute unlinking
                const success = await this.model.unlinkFromEntity(
                    sourceId,
                    sourceType,
                    linkedEntityId,
                    entityType,
                    undefined
                );

                return { success };
            }
        });
    }

    /**
     * Find subscription items by entity type
     * @param actor - Actor performing the operation
     * @param entityType - Entity type to filter by
     * @param options - Pagination options
     * @returns ServiceOutput with paginated subscription items
     */
    public async findByEntityType(
        actor: Actor,
        entityType: string,
        options?: { page?: number; pageSize?: number }
    ): Promise<ServiceOutput<{ items: SubscriptionItem[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByEntityType',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const result = await this.model.findByEntityType(entityType, options, undefined);

                return result;
            }
        });
    }

    /**
     * Find subscription items by linked entity
     * @param actor - Actor performing the operation
     * @param linkedEntityId - Linked entity ID
     * @param entityType - Optional entity type filter
     * @returns ServiceOutput with subscription items
     */
    public async findByLinkedEntity(
        actor: Actor,
        linkedEntityId: string,
        entityType?: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByLinkedEntity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findByLinkedEntity(
                    linkedEntityId,
                    entityType,
                    undefined
                );

                return items;
            }
        });
    }

    /**
     * Find subscription items by source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findBySource(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findBySource',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findBySource(sourceId, sourceType, undefined);

                return items;
            }
        });
    }

    /**
     * Get linked entity information for a subscription item
     * @param actor - Actor performing the operation
     * @param id - Subscription item ID
     * @returns ServiceOutput with linked entity info
     */
    public async getLinkedEntity(
        actor: Actor,
        id: string
    ): Promise<ServiceOutput<{ linkedEntityId: string; entityType: string } | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getLinkedEntity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id } as SubscriptionItem);

                // Execute query
                const result = await this.model.getLinkedEntity(id, undefined);

                return result;
            }
        });
    }

    /**
     * Get subscription item with linked entity details
     * @param actor - Actor performing the operation
     * @param id - Subscription item ID
     * @returns ServiceOutput with subscription item and linked entity
     */
    public async withLinkedEntity(
        actor: Actor,
        id: string
    ): Promise<
        ServiceOutput<{
            subscriptionItem: SubscriptionItem;
            linkedEntity: Record<string, unknown>;
        } | null>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'withLinkedEntity',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id } as SubscriptionItem);

                // Execute query
                const result = await this.model.withLinkedEntity(id, undefined);

                return result;
            }
        });
    }

    // ============================================================================
    // TYPE-SPECIFIC FINDER METHODS
    // ============================================================================

    /**
     * Find accommodation listing subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findAccommodationListings(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findAccommodationListings',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findAccommodationListings(
                    sourceId,
                    sourceType,
                    undefined
                );

                return items;
            }
        });
    }

    /**
     * Find campaign subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findCampaigns(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findCampaigns',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findCampaigns(sourceId, sourceType, undefined);

                return items;
            }
        });
    }

    /**
     * Find sponsorship subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findSponsorship(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findSponsorship',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findSponsorship(sourceId, sourceType, undefined);

                return items;
            }
        });
    }

    /**
     * Find featured accommodation subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findFeaturedAccommodations(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findFeaturedAccommodations',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findFeaturedAccommodations(
                    sourceId,
                    sourceType,
                    undefined
                );

                return items;
            }
        });
    }

    /**
     * Find professional service order subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findProfessionalServiceOrders(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findProfessionalServiceOrders',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findProfessionalServiceOrders(
                    sourceId,
                    sourceType,
                    undefined
                );

                return items;
            }
        });
    }

    /**
     * Find benefit listing subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findBenefitListings(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findBenefitListings',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findBenefitListings(sourceId, sourceType, undefined);

                return items;
            }
        });
    }

    /**
     * Find service listing subscription items for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with subscription items
     */
    public async findServiceListings(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<SubscriptionItem[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findServiceListings',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const items = await this.model.findServiceListings(sourceId, sourceType, undefined);

                return items;
            }
        });
    }

    // ============================================================================
    // AGGREGATION METHODS
    // ============================================================================

    /**
     * Get all entity types used by a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with array of entity types
     */
    public async getEntityTypesForSource(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<string[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getEntityTypesForSource',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const entityTypes = await this.model.getEntityTypesForSource(
                    sourceId,
                    sourceType,
                    undefined
                );

                return entityTypes;
            }
        });
    }

    /**
     * Count subscription items by entity type for a source
     * @param actor - Actor performing the operation
     * @param sourceId - Source ID
     * @param sourceType - Source type
     * @returns ServiceOutput with count by entity type
     */
    public async countByEntityType(
        actor: Actor,
        sourceId: string,
        sourceType: string
    ): Promise<ServiceOutput<Record<string, number>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countByEntityType',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canCount(validatedActor);

                // Execute query
                const counts = await this.model.countByEntityType(sourceId, sourceType, undefined);

                return counts;
            }
        });
    }
}
