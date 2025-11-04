import type { ClientAccessRightModel } from '@repo/db';
import {
    AccessRightScopeEnum,
    type ClientAccessRight,
    ClientAccessRightCreateInputSchema,
    ClientAccessRightSearchInputSchema,
    ClientAccessRightUpdateInputSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing client access rights. Implements business logic, permissions, and hooks for ClientAccessRight entities.
 * Handles the specific features and permissions that clients have access to based on their subscriptions.
 * @extends BaseCrudService
 */
export class ClientAccessRightService extends BaseCrudService<
    ClientAccessRight,
    ClientAccessRightModel,
    typeof ClientAccessRightCreateInputSchema,
    typeof ClientAccessRightUpdateInputSchema,
    typeof ClientAccessRightSearchInputSchema
> {
    static readonly ENTITY_NAME = 'clientAccessRight';
    protected readonly entityName = ClientAccessRightService.ENTITY_NAME;
    public readonly model: ClientAccessRightModel;

    public readonly createSchema = ClientAccessRightCreateInputSchema;
    public readonly updateSchema = ClientAccessRightUpdateInputSchema;
    public readonly searchSchema = ClientAccessRightSearchInputSchema;

    /**
     * Initializes a new instance of the ClientAccessRightService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional ClientAccessRightModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: ClientAccessRightModel) {
        super(ctx, ClientAccessRightService.ENTITY_NAME);
        this.model = model ?? ({} as ClientAccessRightModel);
    }

    /**
     * Returns default list relations (no relations for client access rights)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a client access right.
     * Only ADMIN and users with ACCESS_PERMISSIONS_MANAGE permission can create.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with ACCESS_PERMISSIONS_MANAGE can create access rights'
            );
        }
    }

    /**
     * Checks if the actor can update a client access right.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can update.
     */
    protected _canUpdate(actor: Actor, _entity: ClientAccessRight): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update access rights'
            );
        }
    }

    /**
     * Checks if the actor can soft delete a client access right.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can soft delete.
     */
    protected _canSoftDelete(actor: Actor, _entity: ClientAccessRight): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete access rights'
            );
        }
    }

    /**
     * Checks if the actor can hard delete a client access right.
     * Only ADMIN can hard delete.
     */
    protected _canHardDelete(actor: Actor, _entity: ClientAccessRight): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete access rights'
            );
        }
    }

    /**
     * Checks if the actor can view a client access right.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can view.
     */
    protected _canView(actor: Actor, _entity: ClientAccessRight): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view access rights'
            );
        }
    }

    /**
     * Checks if the actor can list client access rights.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can list.
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list access rights'
            );
        }
    }

    /**
     * Checks if the actor can restore a client access right.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can restore.
     */
    protected _canRestore(actor: Actor, _entity: ClientAccessRight): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore access rights'
            );
        }
    }

    /**
     * Checks if the actor can search client access rights.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can search.
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search access rights'
            );
        }
    }

    /**
     * Checks if the actor can count client access rights.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can count.
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count access rights'
            );
        }
    }

    /**
     * Checks if the actor can update visibility of a client access right.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can update visibility.
     */
    protected _canUpdateVisibility(actor: Actor, _entity: ClientAccessRight): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update visibility of access rights'
            );
        }
    }

    /**
     * Checks if the actor can update lifecycle state of a client access right.
     * Admin or ACCESS_PERMISSIONS_MANAGE permission holders can update lifecycle state.
     */
    protected _canUpdateLifecycleState(actor: Actor, _entity: ClientAccessRight): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.ACCESS_PERMISSIONS_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update lifecycle state of access rights'
            );
        }
    }

    /**
     * Executes search for client access rights.
     * Uses the model's findAll method to retrieve paginated results.
     */
    protected async _executeSearch(
        params: z.infer<typeof ClientAccessRightSearchInputSchema>,
        _actor: Actor
    ): Promise<{ items: ClientAccessRight[]; total: number }> {
        const { page, pageSize } = params;
        return this.model.findAll(params, { page, pageSize });
    }

    /**
     * Executes count for client access rights.
     * Uses the model's count method to count access rights based on provided criteria.
     */
    protected async _executeCount(
        params: z.infer<typeof ClientAccessRightSearchInputSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }

    // =========================================================================
    // Business Methods - Find Operations
    // =========================================================================

    /**
     * Find access rights by scope
     *
     * @param actor - Current user context
     * @param scope - Access right scope
     * @returns Service output with matching access rights
     */
    public async findByScope(
        actor: Actor,
        scope: AccessRightScopeEnum
    ): Promise<ServiceOutput<ClientAccessRight[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByScope',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const rights = await this.model.findByScope(scope);

                return rights;
            }
        });
    }

    /**
     * Find access rights by scope type
     *
     * @param actor - Current user context
     * @param scopeType - Entity type for scoped access
     * @returns Service output with matching access rights
     */
    public async findByScopeType(
        actor: Actor,
        scopeType: string
    ): Promise<ServiceOutput<ClientAccessRight[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByScopeType',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const rights = await this.model.findByScopeType(scopeType);

                return rights;
            }
        });
    }

    /**
     * Find currently active access rights
     *
     * @param actor - Current user context
     * @returns Service output with active access rights
     */
    public async findActiveRights(actor: Actor): Promise<ServiceOutput<ClientAccessRight[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActiveRights',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const rights = await this.model.findActiveRights();

                return rights;
            }
        });
    }

    /**
     * Check if client has specific permission
     *
     * @param actor - Current user context
     * @param clientId - Client ID
     * @param feature - Feature name
     * @param scope - Access right scope
     * @param scopeId - Optional scope entity ID
     * @returns Service output with boolean indicating permission
     */
    public async hasPermission(
        actor: Actor,
        clientId: string,
        feature: string,
        scope: AccessRightScopeEnum,
        scopeId?: string
    ): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'hasPermission',
            input: { actor },
            schema: z.object({}),
            execute: async () => {
                // Anyone can check permissions
                const hasPermission = await this.model.hasPermission(
                    clientId,
                    feature,
                    scope,
                    scopeId
                );

                return hasPermission;
            }
        });
    }

    /**
     * Find access rights by subscription item
     *
     * @param actor - Current user context
     * @param subscriptionItemId - Subscription item ID
     * @returns Service output with matching access rights
     */
    public async findBySubscriptionItem(
        actor: Actor,
        subscriptionItemId: string
    ): Promise<ServiceOutput<ClientAccessRight[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findBySubscriptionItem',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const rights = await this.model.findBySubscriptionItem(subscriptionItemId);

                return rights;
            }
        });
    }

    /**
     * Find access rights expiring within specified days
     *
     * @param actor - Current user context
     * @param days - Number of days to look ahead
     * @returns Service output with expiring access rights
     */
    public async findExpiring(
        actor: Actor,
        days: number
    ): Promise<ServiceOutput<ClientAccessRight[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findExpiring',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const rights = await this.model.findExpiring(days);

                return rights;
            }
        });
    }

    /**
     * Get active features for a client
     *
     * @param actor - Current user context
     * @param clientId - Client ID
     * @returns Service output with array of active feature names
     */
    public async getActiveFeatures(
        actor: Actor,
        clientId: string
    ): Promise<ServiceOutput<string[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getActiveFeatures',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const features = await this.model.getActiveFeatures(clientId);

                return features;
            }
        });
    }

    // =========================================================================
    // Business Methods - Grant/Revoke Operations
    // =========================================================================

    /**
     * Grant access right to a client
     *
     * Business Rules:
     * - Checks for conflicts before granting
     * - Validates scope requirements (scopeId required for non-GLOBAL scopes)
     * - Validates date ranges (validTo must be after validFrom)
     *
     * @param actor - Current user context
     * @param input - Access right data
     * @returns Service output with newly created access right
     */
    public async grantAccess(
        actor: Actor,
        input: {
            clientId: string;
            subscriptionItemId: string;
            feature: string;
            scope: AccessRightScopeEnum;
            validFrom: Date;
            validTo?: Date;
            scopeId?: string;
            scopeType?: string;
        }
    ): Promise<ServiceOutput<ClientAccessRight>> {
        return this.runWithLoggingAndValidation({
            methodName: 'grantAccess',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.ACCESS_PERMISSIONS_MANAGE
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can grant access'
                    );
                }

                // Validate scope requirements
                if (input.scope !== AccessRightScopeEnum.GLOBAL && !input.scopeId) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'scopeId is required for non-GLOBAL scope'
                    );
                }

                if (input.scope !== AccessRightScopeEnum.GLOBAL && !input.scopeType) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'scopeType is required for non-GLOBAL scope'
                    );
                }

                // Validate date range
                if (input.validTo && input.validTo <= input.validFrom) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'validTo must be after validFrom'
                    );
                }

                // Check for conflicts
                const conflicts = await this.model.findConflicts(
                    input.clientId,
                    input.feature,
                    input.scope,
                    input.scopeId
                );

                if (conflicts.length > 0) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'Conflicting access right already exists for this client and feature'
                    );
                }

                // Grant access
                const accessRight = await this.model.grantAccess(
                    input.clientId,
                    input.subscriptionItemId,
                    input.feature,
                    input.scope,
                    input.validFrom,
                    input.validTo,
                    input.scopeId,
                    input.scopeType
                );

                return accessRight;
            }
        });
    }

    /**
     * Revoke access right for a client
     *
     * Sets validTo to current time, effectively ending the access.
     *
     * @param actor - Current user context
     * @param input - Revocation criteria
     * @returns Service output with boolean indicating success
     */
    public async revokeAccess(
        actor: Actor,
        input: {
            clientId: string;
            feature: string;
            scope: AccessRightScopeEnum;
            scopeId?: string;
        }
    ): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'revokeAccess',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.ACCESS_PERMISSIONS_MANAGE
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can revoke access'
                    );
                }

                const revoked = await this.model.revokeAccess(
                    input.clientId,
                    input.feature,
                    input.scope,
                    input.scopeId
                );

                if (!revoked) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'No active access right found to revoke'
                    );
                }

                return revoked;
            }
        });
    }

    /**
     * Find conflicts for a potential access right
     *
     * Checks if granting this access would conflict with existing active rights.
     *
     * @param actor - Current user context
     * @param input - Access right criteria to check
     * @returns Service output with conflicting access rights
     */
    public async findConflicts(
        actor: Actor,
        input: {
            clientId: string;
            feature: string;
            scope: AccessRightScopeEnum;
            scopeId?: string;
        }
    ): Promise<ServiceOutput<ClientAccessRight[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findConflicts',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);

                const conflicts = await this.model.findConflicts(
                    input.clientId,
                    input.feature,
                    input.scope,
                    input.scopeId
                );

                return conflicts;
            }
        });
    }

    // =========================================================================
    // Business Methods - Batch Operations
    // =========================================================================

    /**
     * Batch grant access to multiple clients
     *
     * Useful for subscription activation scenarios.
     *
     * @param actor - Current user context
     * @param inputs - Array of access right data
     * @returns Service output with created access rights and errors
     */
    public async batchGrantAccess(
        actor: Actor,
        inputs: Array<{
            clientId: string;
            subscriptionItemId: string;
            feature: string;
            scope: AccessRightScopeEnum;
            validFrom: Date;
            validTo?: Date;
            scopeId?: string;
            scopeType?: string;
        }>
    ): Promise<
        ServiceOutput<{
            created: ClientAccessRight[];
            errors: Array<{ index: number; error: string }>;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'batchGrantAccess',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.ACCESS_PERMISSIONS_MANAGE
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can grant access'
                    );
                }

                const created: ClientAccessRight[] = [];
                const errors: Array<{ index: number; error: string }> = [];

                for (let i = 0; i < inputs.length; i++) {
                    const input = inputs[i];

                    if (!input) {
                        errors.push({
                            index: i,
                            error: 'Invalid input: undefined or null'
                        });
                        continue;
                    }

                    try {
                        const result = await this.grantAccess(validatedActor, input);

                        if (result.error) {
                            errors.push({
                                index: i,
                                error: result.error.message
                            });
                        } else if (result.data) {
                            created.push(result.data);
                        }
                    } catch (error) {
                        errors.push({
                            index: i,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }

                return { created, errors };
            }
        });
    }

    /**
     * Batch revoke access for multiple clients
     *
     * Useful for subscription cancellation scenarios.
     *
     * @param actor - Current user context
     * @param inputs - Array of revocation criteria
     * @returns Service output with revocation results and errors
     */
    public async batchRevokeAccess(
        actor: Actor,
        inputs: Array<{
            clientId: string;
            feature: string;
            scope: AccessRightScopeEnum;
            scopeId?: string;
        }>
    ): Promise<
        ServiceOutput<{
            revoked: number;
            errors: Array<{ index: number; error: string }>;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'batchRevokeAccess',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                // Check permissions
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const hasPermission = validatedActor.permissions.includes(
                    PermissionEnum.ACCESS_PERMISSIONS_MANAGE
                );

                if (!isAdmin && !hasPermission) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Only admins or authorized users can revoke access'
                    );
                }

                let revoked = 0;
                const errors: Array<{ index: number; error: string }> = [];

                for (let i = 0; i < inputs.length; i++) {
                    const input = inputs[i];

                    if (!input) {
                        errors.push({
                            index: i,
                            error: 'Invalid input: undefined or null'
                        });
                        continue;
                    }

                    try {
                        const result = await this.revokeAccess(validatedActor, input);

                        if (result.error) {
                            errors.push({
                                index: i,
                                error: result.error.message
                            });
                        } else if (result.data) {
                            revoked++;
                        }
                    } catch (error) {
                        errors.push({
                            index: i,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }

                return { revoked, errors };
            }
        });
    }
}
