import type { AdSlotReservation, AdSlotReservationModel } from '@repo/db';
import {
    AdSlotReservationStatusEnum,
    CreateAdSlotReservationSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    SearchAdSlotReservationSchema,
    ServiceErrorCode,
    UpdateAdSlotReservationSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Ad Slot Reservation Service
 *
 * Manages advertising slot reservations by campaigns for specific time periods.
 * Handles the complete lifecycle of reservations including creation, activation,
 * pausing, cancellation, and ending.
 *
 * @extends BaseCrudService
 */
export class AdSlotReservationService extends BaseCrudService<
    AdSlotReservation,
    AdSlotReservationModel,
    typeof CreateAdSlotReservationSchema,
    typeof UpdateAdSlotReservationSchema,
    typeof SearchAdSlotReservationSchema
> {
    static readonly ENTITY_NAME = 'adSlotReservation';
    protected readonly entityName = AdSlotReservationService.ENTITY_NAME;
    public readonly model: AdSlotReservationModel;

    public readonly createSchema = CreateAdSlotReservationSchema;
    public readonly updateSchema = UpdateAdSlotReservationSchema;
    public readonly searchSchema = SearchAdSlotReservationSchema;

    /**
     * Initializes a new instance of the AdSlotReservationService.
     * @param ctx - The service context, containing the logger.
     * @param model - Optional AdSlotReservationModel instance (for testing/mocking).
     */
    constructor(ctx: ServiceContext, model?: AdSlotReservationModel) {
        super(ctx, AdSlotReservationService.ENTITY_NAME);
        this.model = model ?? ({} as AdSlotReservationModel);
    }

    /**
     * Returns default list relations (no relations for ad slot reservations)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // Permission Hooks
    // ============================================================================

    /**
     * Check if actor can create ad slot reservations
     */
    protected _canCreate(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_CREATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can update ad slot reservations
     */
    protected _canUpdate(actor: Actor, _entity: AdSlotReservation): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can soft delete ad slot reservations
     */
    protected _canSoftDelete(actor: Actor, _entity: AdSlotReservation): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can view ad slot reservations
     */
    protected _canView(actor: Actor, _entity: AdSlotReservation): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can hard delete ad slot reservations (admin only)
     */
    protected _canHardDelete(actor: Actor, _entity: AdSlotReservation): void {
        if (actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can restore soft-deleted ad slot reservations
     */
    protected _canRestore(actor: Actor, _entity: AdSlotReservation): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(
            PermissionEnum.AD_SLOT_RESERVATION_RESTORE
        );

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can list ad slot reservations
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can search ad slot reservations
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can count ad slot reservations
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count ad slot reservations'
            );
        }
    }

    /**
     * Check if actor can update visibility of ad slot reservations
     */
    protected _canUpdateVisibility(actor: Actor, _entity: AdSlotReservation): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_RESERVATION_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update reservation visibility'
            );
        }
    }

    /**
     * Check if actor can manage status of ad slot reservations
     */
    protected _canManageStatus(actor: Actor, _entity: AdSlotReservation): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(
            PermissionEnum.AD_SLOT_RESERVATION_STATUS_MANAGE
        );

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can manage reservation status'
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
        filters: z.infer<typeof SearchAdSlotReservationSchema>,
        _relations?: ListRelationsConfig
    ): Promise<AdSlotReservation[]> {
        const { items } = await this.model.findAll(filters as Record<string, unknown>);
        return items;
    }

    /**
     * Execute count with filters
     */
    protected async _executeCount(
        filters: z.infer<typeof SearchAdSlotReservationSchema>
    ): Promise<number> {
        return await this.model.count(filters as Record<string, unknown>);
    }

    // ============================================================================
    // Custom Finder Methods
    // ============================================================================

    /**
     * Find all reservations for a specific campaign
     *
     * @param actor - The actor performing the action
     * @param campaignId - The campaign ID to search for
     * @returns Service output with array of reservations
     *
     * @example
     * ```ts
     * const result = await service.findByCampaign(actor, 'campaign-123');
     * if (result.data) {
     *   console.log(result.data); // Array of reservations
     * }
     * ```
     */
    async findByCampaign(
        actor: Actor,
        campaignId: string
    ): Promise<ServiceOutput<AdSlotReservation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByCampaign',
            input: { actor, campaignId },
            schema: z.object({ campaignId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canSearch(validatedActor);
                return await this.model.findByCampaign(campaignId);
            }
        });
    }

    /**
     * Find all reservations for a specific ad slot
     *
     * @param actor - The actor performing the action
     * @param adSlotId - The ad slot ID to search for
     * @returns Service output with array of reservations
     *
     * @example
     * ```ts
     * const result = await service.findByAdSlot(actor, 'slot-123');
     * if (result.data) {
     *   console.log(result.data); // Array of reservations
     * }
     * ```
     */
    async findByAdSlot(
        actor: Actor,
        adSlotId: string
    ): Promise<ServiceOutput<AdSlotReservation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByAdSlot',
            input: { actor, adSlotId },
            schema: z.object({ adSlotId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                this._canSearch(validatedActor);
                return await this.model.findByAdSlot(adSlotId);
            }
        });
    }

    /**
     * Find all reservations by status
     *
     * @param actor - The actor performing the action
     * @param status - The reservation status to filter by
     * @returns Service output with array of reservations
     *
     * @example
     * ```ts
     * const result = await service.findByStatus(actor, AdSlotReservationStatusEnum.ACTIVE);
     * if (result.data) {
     *   console.log(result.data); // Array of active reservations
     * }
     * ```
     */
    async findByStatus(
        actor: Actor,
        status: AdSlotReservationStatusEnum
    ): Promise<ServiceOutput<AdSlotReservation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByStatus',
            input: { actor, status },
            schema: z.object({ status: z.nativeEnum(AdSlotReservationStatusEnum) }),
            execute: async (_validatedData, validatedActor) => {
                this._canSearch(validatedActor);
                return await this.model.findByStatus(status);
            }
        });
    }

    // ============================================================================
    // Business Logic Methods
    // ============================================================================

    /**
     * Activate a reservation (change status to ACTIVE)
     *
     * @param actor - The actor performing the action
     * @param reservationId - The reservation ID to activate
     * @returns Service output with activated reservation
     *
     * @example
     * ```ts
     * const result = await service.activate(actor, 'reservation-123');
     * if (result.data) {
     *   console.log(result.data.status); // ACTIVE
     * }
     * ```
     */
    async activate(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'activate',
            input: { actor, reservationId },
            schema: z.object({ reservationId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find reservation
                const reservation = await this.model.findById(reservationId);
                if (!reservation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reservation not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, reservation);

                // Activate
                return await this.model.activate(reservationId);
            }
        });
    }

    /**
     * Pause a reservation (change status to PAUSED)
     *
     * @param actor - The actor performing the action
     * @param reservationId - The reservation ID to pause
     * @returns Service output with paused reservation
     *
     * @example
     * ```ts
     * const result = await service.pause(actor, 'reservation-123');
     * if (result.data) {
     *   console.log(result.data.status); // PAUSED
     * }
     * ```
     */
    async pause(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'pause',
            input: { actor, reservationId },
            schema: z.object({ reservationId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find reservation
                const reservation = await this.model.findById(reservationId);
                if (!reservation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reservation not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, reservation);

                // Pause
                return await this.model.pause(reservationId);
            }
        });
    }

    /**
     * Cancel a reservation (change status to CANCELLED)
     *
     * @param actor - The actor performing the action
     * @param reservationId - The reservation ID to cancel
     * @returns Service output with cancelled reservation
     *
     * @example
     * ```ts
     * const result = await service.cancel(actor, 'reservation-123');
     * if (result.data) {
     *   console.log(result.data.status); // CANCELLED
     * }
     * ```
     */
    async cancel(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'cancel',
            input: { actor, reservationId },
            schema: z.object({ reservationId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find reservation
                const reservation = await this.model.findById(reservationId);
                if (!reservation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reservation not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, reservation);

                // Cancel
                return await this.model.cancel(reservationId);
            }
        });
    }

    /**
     * End a reservation (change status to ENDED)
     *
     * @param actor - The actor performing the action
     * @param reservationId - The reservation ID to end
     * @returns Service output with ended reservation
     *
     * @example
     * ```ts
     * const result = await service.end(actor, 'reservation-123');
     * if (result.data) {
     *   console.log(result.data.status); // ENDED
     * }
     * ```
     */
    async end(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'end',
            input: { actor, reservationId },
            schema: z.object({ reservationId: z.string() }),
            execute: async (_validatedData, validatedActor) => {
                // Find reservation
                const reservation = await this.model.findById(reservationId);
                if (!reservation) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reservation not found');
                }

                // Check permissions
                this._canManageStatus(validatedActor, reservation);

                // End
                return await this.model.end(reservationId);
            }
        });
    }
}
