import type { AdSlotReservationModel } from '@repo/db';
import type { AdSlotReservation, ListRelationsConfig } from '@repo/schemas';
import {
    type AdSlotReservationStatusEnum,
    CreateAdSlotReservationSchema,
    SearchAdSlotReservationSchema,
    ServiceErrorCode,
    UpdateAdSlotReservationSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type {
    Actor,
    PaginatedListOutput,
    ServiceContext,
    ServiceOutput
} from '../../types/index.js';
import {
    checkCanCount,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './adSlotReservation.permissions.js';

/**
 * Service for managing ad slot reservations.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for advertising slot reservation management.
 */
export class AdSlotReservationService extends BaseCrudService<
    AdSlotReservation,
    AdSlotReservationModel,
    typeof CreateAdSlotReservationSchema,
    typeof UpdateAdSlotReservationSchema,
    typeof SearchAdSlotReservationSchema
> {
    static readonly ENTITY_NAME = 'ad-slot-reservation';
    protected readonly entityName = AdSlotReservationService.ENTITY_NAME;

    public readonly model: AdSlotReservationModel;

    public readonly createSchema = CreateAdSlotReservationSchema;
    public readonly updateSchema = UpdateAdSlotReservationSchema;
    public readonly searchSchema = SearchAdSlotReservationSchema;

    constructor(ctx: ServiceContext, model?: AdSlotReservationModel) {
        super(ctx, AdSlotReservationService.ENTITY_NAME);
        this.model = model ?? ({} as AdSlotReservationModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create ad slot reservations
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update ad slot reservations
     */
    protected _canUpdate(actor: Actor, entity: AdSlotReservation): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch ad slot reservations
     */
    protected _canPatch(actor: Actor, entity: AdSlotReservation, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of ad slot reservations
     */
    protected _canUpdateVisibility(actor: Actor, entity: AdSlotReservation): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete ad slot reservations
     */
    protected _canDelete(actor: Actor, entity: AdSlotReservation): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete ad slot reservations
     */
    protected _canHardDelete(actor: Actor, entity: AdSlotReservation): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore ad slot reservations
     */
    protected _canRestore(actor: Actor, entity: AdSlotReservation): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view ad slot reservations
     */
    protected _canView(actor: Actor, entity: AdSlotReservation): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list ad slot reservations
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete ad slot reservations
     */
    protected _canSoftDelete(actor: Actor, entity: AdSlotReservation): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search ad slot reservations
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count ad slot reservations
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for ad slot reservations
     */
    protected async _executeSearch(
        _params: z.infer<typeof SearchAdSlotReservationSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<AdSlotReservation>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for ad slot reservations
     */
    protected async _executeCount(
        _params: z.infer<typeof SearchAdSlotReservationSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }

    // ============================================================================
    // BUSINESS METHODS
    // ============================================================================

    /**
     * Find all reservations for a specific campaign
     */
    async findByCampaign(
        actor: Actor,
        campaignId: string
    ): Promise<ServiceOutput<AdSlotReservation[]>> {
        this._canView(actor, {} as AdSlotReservation);
        const reservations = await this.model.findByCampaign(campaignId);
        return { data: reservations };
    }

    /**
     * Find all reservations for a specific ad slot
     */
    async findByAdSlot(
        actor: Actor,
        adSlotId: string
    ): Promise<ServiceOutput<AdSlotReservation[]>> {
        this._canView(actor, {} as AdSlotReservation);
        const reservations = await this.model.findByAdSlot(adSlotId);
        return { data: reservations };
    }

    /**
     * Find all reservations with a specific status
     */
    async findByStatus(
        actor: Actor,
        status: AdSlotReservationStatusEnum
    ): Promise<ServiceOutput<AdSlotReservation[]>> {
        this._canView(actor, {} as AdSlotReservation);
        const reservations = await this.model.findByStatus(status);
        return { data: reservations };
    }

    /**
     * Activate a reservation
     */
    async activate(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        const reservation = await this.model.findById(reservationId);
        if (!reservation) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Reservation not found' }
            };
        }

        this._canUpdate(actor, reservation);

        const updated = await this.model.activate(reservationId);
        return { data: updated };
    }

    /**
     * Pause a reservation
     */
    async pause(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        const reservation = await this.model.findById(reservationId);
        if (!reservation) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Reservation not found' }
            };
        }

        this._canUpdate(actor, reservation);

        const updated = await this.model.pause(reservationId);
        return { data: updated };
    }

    /**
     * Cancel a reservation
     */
    async cancel(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        const reservation = await this.model.findById(reservationId);
        if (!reservation) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Reservation not found' }
            };
        }

        this._canUpdate(actor, reservation);

        const updated = await this.model.cancel(reservationId);
        return { data: updated };
    }

    /**
     * End a reservation
     */
    async end(actor: Actor, reservationId: string): Promise<ServiceOutput<AdSlotReservation>> {
        const reservation = await this.model.findById(reservationId);
        if (!reservation) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Reservation not found' }
            };
        }

        this._canUpdate(actor, reservation);

        const updated = await this.model.end(reservationId);
        return { data: updated };
    }
}
