import { ClientModel } from '@repo/db';
import type { Client, ListRelationsConfig, UserIdType } from '@repo/schemas';
import {
    ClientCreateInputSchema,
    ClientSearchSchema,
    ClientUpdateInputSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    type VisibilityEnum
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing clients. Implements business logic, permissions, and hooks for Client entities.
 * @extends BaseCrudService
 */
export class ClientService extends BaseCrudService<
    Client,
    ClientModel,
    typeof ClientCreateInputSchema,
    typeof ClientUpdateInputSchema,
    typeof ClientSearchSchema
> {
    static readonly ENTITY_NAME = 'client';
    protected readonly entityName = ClientService.ENTITY_NAME;
    public readonly model: ClientModel;

    public readonly createSchema = ClientCreateInputSchema;
    public readonly updateSchema = ClientUpdateInputSchema;
    public readonly searchSchema = ClientSearchSchema;

    /**
     * Initializes a new instance of the ClientService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional ClientModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: ClientModel) {
        super(ctx, ClientService.ENTITY_NAME);
        this.model = model ?? new ClientModel();
    }

    /**
     * Returns default list relations (no relations for client)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS
    // ============================================================================

    /**
     * Checks if the actor can create a client.
     * Only ADMIN and users with CLIENT_CREATE permission can create clients.
     * @param actor - The user or system performing the action.
     * @param _data - The validated input data for the new client.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.CLIENT_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or users with CLIENT_CREATE can create clients'
            );
        }
    }

    /**
     * Checks if the actor can update a client.
     * Admin, CLIENT_UPDATE permission holders, or the owner can update.
     * @param actor - The user or system performing the action.
     * @param entity - The client entity to be updated.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdate(actor: Actor, entity: Client): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.CLIENT_UPDATE);
        const isOwner = entity.userId === actor.id;

        if (!isAdmin && !hasPermission && !isOwner) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins, authorized users, or owners can update clients'
            );
        }
    }

    /**
     * Checks if the actor can soft-delete a client.
     * Only ADMIN and users with CLIENT_DELETE permission can soft-delete clients.
     * @param actor - The user or system performing the action.
     * @param _entity - The client entity to be soft-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSoftDelete(actor: Actor, _entity: Client): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.CLIENT_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can delete clients'
            );
        }
    }

    /**
     * Checks if the actor can hard-delete a client.
     * Only SUPER_ADMIN can hard-delete.
     * @param actor - The user or system performing the action.
     * @param _entity - The client entity to be hard-deleted.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canHardDelete(actor: Actor, _entity: Client): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.SUPER_ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only super admins can permanently delete clients'
            );
        }
    }

    /**
     * Checks if the actor can restore a client.
     * Only ADMIN can restore.
     * @param actor - The user or system performing the action.
     * @param _entity - The client entity to be restored.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canRestore(actor: Actor, _entity: Client): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can restore clients'
            );
        }
    }

    /**
     * Checks if the actor can view a client.
     * Authenticated users can view clients.
     * @param actor - The user or system performing the action.
     * @param _entity - The client entity to be viewed.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canView(actor: Actor, _entity: Client): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to view clients'
            );
        }
    }

    /**
     * Checks if the actor can list clients.
     * Any authenticated user can list clients.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canList(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to list clients'
            );
        }
    }

    /**
     * Checks if the actor can search clients.
     * Any authenticated user can search.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canSearch(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to search clients'
            );
        }
    }

    /**
     * Checks if the actor can count clients.
     * Any authenticated user can count.
     * @param actor - The user or system performing the action.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canCount(actor: Actor): void {
        if (!actor || !actor.id || actor.role === RoleEnum.GUEST) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Authentication required to count clients'
            );
        }
    }

    /**
     * Checks if the actor can update the visibility of a client.
     * Only ADMIN can update visibility.
     * @param actor - The user or system performing the action.
     * @param _entity - The client entity to be updated.
     * @param _newVisibility - The new visibility state.
     * @throws {ServiceError} If the permission check fails.
     */
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: Client,
        _newVisibility: VisibilityEnum
    ): void {
        if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can update client visibility'
            );
        }
    }

    // ============================================================================
    // SEARCH & COUNT IMPLEMENTATION
    // ============================================================================

    /**
     * Executes the database search for clients.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the search.
     * @returns A paginated list of clients matching the criteria.
     * @protected
     */
    protected async _executeSearch(params: Record<string, unknown>, _actor: Actor) {
        const { page = 1, pageSize = 10, ...filterParams } = params;
        return this.model.findAll(filterParams, { page, pageSize });
    }

    /**
     * Executes the database count for clients.
     * @param params - The validated and processed search parameters.
     * @param _actor - The actor performing the count.
     * @returns An object containing the total count of clients matching the criteria.
     * @protected
     */
    protected async _executeCount(params: Record<string, unknown>, _actor: Actor) {
        const { ...filterParams } = params;
        const count = await this.model.count(filterParams);
        return { count };
    }

    // ============================================================================
    // BUSINESS LOGIC METHODS
    // ============================================================================

    /**
     * Finds a client by user ID.
     * @param actor - The user or system performing the action.
     * @param userId - The user ID to search for.
     * @returns ServiceOutput containing the client or null if not found.
     */
    public async findByUser(
        actor: Actor,
        userId: UserIdType
    ): Promise<ServiceOutput<Client | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByUser',
            input: { actor, userId },
            schema: this.searchSchema,
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const client = await this.model.findByUser(userId);

                return client;
            }
        });
    }

    /**
     * Gets billing statistics for a client.
     * @param actor - The user or system performing the action.
     * @param clientId - The client ID.
     * @returns ServiceOutput containing billing statistics.
     */
    public async getBillingStats(
        actor: Actor,
        clientId: string
    ): Promise<
        ServiceOutput<{
            totalInvoices: number;
            totalPaid: number;
            totalOverdue: number;
            totalAmount: number;
            paidAmount: number;
            overdueAmount: number;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getBillingStats',
            input: { actor, clientId },
            schema: this.searchSchema,
            execute: async (_validatedData, validatedActor) => {
                // Fetch client first
                const client = await this.model.findById(clientId);
                if (!client) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Client not found');
                }

                // Check permissions (admin or owner)
                const isAdmin = validatedActor.role === RoleEnum.ADMIN;
                const isOwner = client.userId === validatedActor.id;

                if (!isAdmin && !isOwner) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: Can only view own billing stats'
                    );
                }

                // Get billing stats
                const stats = await this.model.getBillingStats(clientId);

                return stats;
            }
        });
    }

    /**
     * Checks if a client has active subscriptions.
     * @param actor - The user or system performing the action.
     * @param clientId - The client ID.
     * @returns ServiceOutput containing boolean indicating active subscriptions.
     */
    public async hasActiveSubscriptions(
        actor: Actor,
        clientId: string
    ): Promise<ServiceOutput<{ hasActive: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'hasActiveSubscriptions',
            input: { actor, clientId },
            schema: this.searchSchema,
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canView(validatedActor, { id: clientId } as Client);

                // Execute query
                const hasActive = await this.model.hasActiveSubscriptions(clientId);

                return { hasActive };
            }
        });
    }

    /**
     * Finds all clients with active subscriptions.
     * @param actor - The user or system performing the action.
     * @returns ServiceOutput containing array of clients.
     */
    public async findWithActiveSubscriptions(actor: Actor): Promise<ServiceOutput<Client[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findWithActiveSubscriptions',
            input: { actor },
            schema: this.searchSchema,
            execute: async (_validatedData, validatedActor) => {
                // Permission check
                this._canList(validatedActor);

                // Execute query
                const clients = await this.model.findWithActiveSubscriptions();

                return clients;
            }
        });
    }
}
