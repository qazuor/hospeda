import type { Sponsorship, SponsorshipModel } from '@repo/db';
import {
    CreateSponsorshipSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    SearchSponsorshipsSchema,
    ServiceErrorCode,
    SponsorshipEntityTypeEnum,
    UpdateSponsorshipSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Sponsorship Service
 *
 * Manages sponsorships for posts and events. Handles the complete lifecycle
 * including creation, activation, pausing, expiration, and cancellation.
 * Tracks performance metrics and ROI calculations.
 *
 * @extends BaseCrudService
 */
export class SponsorshipService extends BaseCrudService<
    Sponsorship,
    SponsorshipModel,
    typeof CreateSponsorshipSchema,
    typeof UpdateSponsorshipSchema,
    typeof SearchSponsorshipsSchema
> {
    static readonly ENTITY_NAME = 'sponsorship';
    protected readonly entityName = SponsorshipService.ENTITY_NAME;
    public readonly model: SponsorshipModel;

    public readonly createSchema = CreateSponsorshipSchema;
    public readonly updateSchema = UpdateSponsorshipSchema;
    public readonly searchSchema = SearchSponsorshipsSchema;

    /**
     * Initializes a new instance of the SponsorshipService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional SponsorshipModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: SponsorshipModel) {
        super(ctx, SponsorshipService.ENTITY_NAME);
        this.model = model ?? ({} as SponsorshipModel);
    }

    /**
     * Returns default list relations (no relations for sponsorships)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // Permission Hooks
    // ============================================================================

    /**
     * Check if actor can create sponsorships
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SPONSORSHIP_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create sponsorships'
            );
        }
    }

    /**
     * Check if actor can update sponsorships
     */
    protected _canUpdate(actor: Actor, _entity: Sponsorship): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update sponsorships'
            );
        }
    }

    /**
     * Check if actor can soft delete sponsorships
     */
    protected _canSoftDelete(actor: Actor, _entity: Sponsorship): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SPONSORSHIP_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete sponsorships'
            );
        }
    }

    /**
     * Check if actor can view sponsorships
     */
    protected _canView(actor: Actor, _entity: Sponsorship): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view sponsorships'
            );
        }
    }

    /**
     * Check if actor can hard delete sponsorships (admin only)
     */
    protected _canHardDelete(actor: Actor, _entity: Sponsorship): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete sponsorships'
            );
        }
    }

    /**
     * Check if actor can restore soft-deleted sponsorships
     */
    protected _canRestore(actor: Actor, _entity: Sponsorship): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SPONSORSHIP_RESTORE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore sponsorships'
            );
        }
    }

    /**
     * Check if actor can list sponsorships
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list sponsorships'
            );
        }
    }

    /**
     * Check if actor can search sponsorships
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search sponsorships'
            );
        }
    }

    /**
     * Check if actor can count sponsorships
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count sponsorships'
            );
        }
    }

    /**
     * Check if actor can update visibility of sponsorships
     */
    protected _canUpdateVisibility(actor: Actor, _entity: Sponsorship): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.SPONSORSHIP_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update sponsorship visibility'
            );
        }
    }

    /**
     * Check if actor can manage status of sponsorships
     */
    protected _canManageStatus(actor: Actor, _entity: Sponsorship): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.SPONSORSHIP_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can manage sponsorship status'
            );
        }
    }

    // ============================================================================
    // Search & Count Implementation
    // ============================================================================

    /**
     * Execute search with filters
     */
    protected async _executeSearch(
        filters: z.infer<typeof SearchSponsorshipsSchema>,
        _relations?: ListRelationsConfig
    ): Promise<Sponsorship[]> {
        const { items } = await this.model.findAll(filters as Record<string, unknown>);
        return items;
    }

    /**
     * Execute count with filters
     */
    protected async _executeCount(
        filters: z.infer<typeof SearchSponsorshipsSchema>
    ): Promise<number> {
        return await this.model.count(filters as Record<string, unknown>);
    }

    // ============================================================================
    // Custom Finder Methods
    // ============================================================================

    /**
     * Find all active sponsorships
     *
     * @param actor - The actor performing the action
     * @returns Service output with array of active sponsorships
     *
     * @example
     * ```ts
     * const result = await service.findActive(actor);
     * if (result.data) {
     *   console.log(result.data); // Array of active sponsorships
     * }
     * ```
     */
    async findActive(actor: Actor): Promise<ServiceOutput<Sponsorship[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canSearch(validatedActor);
                return await this.model.findActive();
            }
        });
    }

    /**
     * Find all sponsorships for a specific client
     *
     * @param actor - The actor performing the action
     * @param clientId - The client ID to search for
     * @returns Service output with array of sponsorships
     *
     * @example
     * ```ts
     * const result = await service.findByClient(actor, 'client-123');
     * if (result.data) {
     *   console.log(result.data); // Array of sponsorships
     * }
     * ```
     */
    async findByClient(actor: Actor, clientId: string): Promise<ServiceOutput<Sponsorship[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByClient',
            input: { actor, clientId },
            schema: z.object({ clientId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canSearch(validatedActor);
                return await this.model.findByClient(clientId);
            }
        });
    }

    /**
     * Find all sponsorships for a specific entity (post or event)
     *
     * @param actor - The actor performing the action
     * @param entityId - The entity ID to search for
     * @param entityType - The entity type (POST or EVENT)
     * @returns Service output with array of sponsorships
     *
     * @example
     * ```ts
     * const result = await service.findByEntity(actor, 'post-123', SponsorshipEntityTypeEnum.POST);
     * if (result.data) {
     *   console.log(result.data); // Array of sponsorships for post-123
     * }
     * ```
     */
    async findByEntity(
        actor: Actor,
        entityId: string,
        entityType: SponsorshipEntityTypeEnum
    ): Promise<ServiceOutput<Sponsorship[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByEntity',
            input: { actor, entityId, entityType },
            schema: z.object({
                entityId: z.string(),
                entityType: z.nativeEnum(SponsorshipEntityTypeEnum)
            }),
            execute: async (_validatedData, validatedActor) => {
                this._canSearch(validatedActor);
                return await this.model.findByEntity(entityId, entityType);
            }
        });
    }

    // ============================================================================
    // Business Logic Methods - Status Management
    // ============================================================================

    /**
     * Activate a sponsorship (change status to ACTIVE)
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID to activate
     * @returns Service output with activated sponsorship
     *
     * @example
     * ```ts
     * const result = await service.activate(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log(result.data.status); // ACTIVE
     * }
     * ```
     */
    async activate(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<Sponsorship>> {
        return this.runWithLoggingAndValidation({
            methodName: 'activate',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find sponsorship
                const sponsorship = await this.model.findById(sponsorshipId);
                if (!sponsorship) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Sponsorship not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, sponsorship);

                // Activate
                return await this.model.activate(sponsorshipId);
            }
        });
    }

    /**
     * Pause a sponsorship (change status to PAUSED)
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID to pause
     * @returns Service output with paused sponsorship
     *
     * @example
     * ```ts
     * const result = await service.pause(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log(result.data.status); // PAUSED
     * }
     * ```
     */
    async pause(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<Sponsorship>> {
        return this.runWithLoggingAndValidation({
            methodName: 'pause',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find sponsorship
                const sponsorship = await this.model.findById(sponsorshipId);
                if (!sponsorship) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Sponsorship not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, sponsorship);

                // Pause
                return await this.model.pause(sponsorshipId);
            }
        });
    }

    /**
     * Expire a sponsorship (change status to EXPIRED)
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID to expire
     * @returns Service output with expired sponsorship
     *
     * @example
     * ```ts
     * const result = await service.expire(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log(result.data.status); // EXPIRED
     * }
     * ```
     */
    async expire(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<Sponsorship>> {
        return this.runWithLoggingAndValidation({
            methodName: 'expire',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find sponsorship
                const sponsorship = await this.model.findById(sponsorshipId);
                if (!sponsorship) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Sponsorship not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, sponsorship);

                // Expire
                return await this.model.expire(sponsorshipId);
            }
        });
    }

    /**
     * Cancel a sponsorship (change status to CANCELLED)
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID to cancel
     * @returns Service output with cancelled sponsorship
     *
     * @example
     * ```ts
     * const result = await service.cancel(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log(result.data.status); // CANCELLED
     * }
     * ```
     */
    async cancel(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<Sponsorship>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find sponsorship
                const sponsorship = await this.model.findById(sponsorshipId);
                if (!sponsorship) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Sponsorship not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, sponsorship);

                // Cancel
                return await this.model.cancel(sponsorshipId);
            }
        });
    }

    // ============================================================================
    // Business Logic Methods - Specialized Operations
    // ============================================================================

    /**
     * Create a post sponsorship
     *
     * @param actor - The actor performing the action
     * @param params - Sponsorship parameters
     * @returns Service output with created sponsorship
     *
     * @example
     * ```ts
     * const result = await service.sponsorPost(actor, {
     *   clientId: 'client-123',
     *   postId: 'post-123',
     *   fromDate: new Date('2025-01-01'),
     *   toDate: new Date('2025-01-31')
     * });
     * ```
     */
    async sponsorPost(
        actor: Actor,
        params: {
            clientId: string;
            postId: string;
            fromDate: Date;
            toDate: Date;
        }
    ): Promise<ServiceOutput<Sponsorship>> {
        return this.runWithLoggingAndValidation({
            methodName: 'sponsorPost',
            input: { actor, ...params },
            schema: z.object({
                clientId: z.string(),
                postId: z.string(),
                fromDate: z.date(),
                toDate: z.date()
            }),
            execute: async (validatedData, validatedActor) => {
                this._canCreate(validatedActor, validatedData);
                return await this.model.sponsorPost(validatedData);
            }
        });
    }

    /**
     * Create an event sponsorship
     *
     * @param actor - The actor performing the action
     * @param params - Sponsorship parameters
     * @returns Service output with created sponsorship
     *
     * @example
     * ```ts
     * const result = await service.sponsorEvent(actor, {
     *   clientId: 'client-123',
     *   eventId: 'event-123',
     *   fromDate: new Date('2025-01-01'),
     *   toDate: new Date('2025-01-31')
     * });
     * ```
     */
    async sponsorEvent(
        actor: Actor,
        params: {
            clientId: string;
            eventId: string;
            fromDate: Date;
            toDate: Date;
        }
    ): Promise<ServiceOutput<Sponsorship>> {
        return this.runWithLoggingAndValidation({
            methodName: 'sponsorEvent',
            input: { actor, ...params },
            schema: z.object({
                clientId: z.string(),
                eventId: z.string(),
                fromDate: z.date(),
                toDate: z.date()
            }),
            execute: async (validatedData, validatedActor) => {
                this._canCreate(validatedActor, validatedData);
                return await this.model.sponsorEvent(validatedData);
            }
        });
    }

    /**
     * Check if a sponsorship is currently active
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID to check
     * @returns Service output with boolean result
     *
     * @example
     * ```ts
     * const result = await service.isActive(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log('Is active:', result.data); // true or false
     * }
     * ```
     */
    async isActive(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'isActive',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Sponsorship);
                return await this.model.isActive(sponsorshipId);
            }
        });
    }

    /**
     * Calculate cost for a sponsorship
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID
     * @returns Service output with calculated cost
     *
     * @example
     * ```ts
     * const result = await service.calculateCost(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log('Cost:', result.data); // 1500
     * }
     * ```
     */
    async calculateCost(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateCost',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Sponsorship);
                return await this.model.calculateCost(sponsorshipId);
            }
        });
    }

    /**
     * Get visibility statistics for a sponsorship
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID
     * @returns Service output with visibility stats
     *
     * @example
     * ```ts
     * const result = await service.getVisibilityStats(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log('Stats:', result.data); // { impressions, clicks, reach, engagement }
     * }
     * ```
     */
    async getVisibilityStats(
        actor: Actor,
        sponsorshipId: string
    ): Promise<
        ServiceOutput<{ impressions: number; clicks: number; reach: number; engagement: number }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getVisibilityStats',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Sponsorship);
                return await this.model.getVisibilityStats(sponsorshipId);
            }
        });
    }

    /**
     * Calculate return on investment for a sponsorship
     *
     * @param actor - The actor performing the action
     * @param sponsorshipId - The sponsorship ID
     * @returns Service output with ROI percentage
     *
     * @example
     * ```ts
     * const result = await service.calculateROI(actor, 'sponsorship-123');
     * if (result.data) {
     *   console.log('ROI:', result.data); // 150 (150% ROI)
     * }
     * ```
     */
    async calculateROI(actor: Actor, sponsorshipId: string): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateROI',
            input: { actor, sponsorshipId },
            schema: z.object({ sponsorshipId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, {} as Sponsorship);
                return await this.model.calculateROI(sponsorshipId);
            }
        });
    }
}
