import { AdSlotReservationStatusEnum } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import type { AdSlotReservation } from '../schemas/campaign/adSlotReservation.dbschema';
import { adSlotReservations } from '../schemas/campaign/adSlotReservation.dbschema';
import { logError, logQuery } from '../utils/logger';

/**
 * Ad Slot Reservation Model
 *
 * Manages reservations of advertising slots by campaigns for defined periods.
 * Handles reservation lifecycle including activation, pausing, cancellation, and ending.
 *
 * @extends BaseModel<AdSlotReservation>
 */
export class AdSlotReservationModel extends BaseModel<AdSlotReservation> {
    protected table = adSlotReservations;
    protected entityName = 'ad-slot-reservation';

    protected getTableName(): string {
        return 'ad_slot_reservations';
    }

    /**
     * Find all reservations for a specific campaign
     *
     * @param campaignId - The campaign ID to filter by
     * @returns Array of ad slot reservations
     *
     * @example
     * ```ts
     * const reservations = await model.findByCampaign('campaign-123');
     * ```
     */
    async findByCampaign(campaignId: string): Promise<AdSlotReservation[]> {
        try {
            const result = await this.findAll({ campaignId });
            logQuery(this.entityName, 'findByCampaign', { campaignId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByCampaign', { campaignId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all reservations for a specific ad slot
     *
     * @param adSlotId - The ad slot ID to filter by
     * @returns Array of ad slot reservations
     *
     * @example
     * ```ts
     * const reservations = await model.findByAdSlot('ad-slot-123');
     * ```
     */
    async findByAdSlot(adSlotId: string): Promise<AdSlotReservation[]> {
        try {
            const result = await this.findAll({ adSlotId });
            logQuery(this.entityName, 'findByAdSlot', { adSlotId }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByAdSlot', { adSlotId }, error as Error);
            throw error;
        }
    }

    /**
     * Find all reservations by status
     *
     * @param status - The reservation status to filter by
     * @returns Array of ad slot reservations
     *
     * @example
     * ```ts
     * const activeReservations = await model.findByStatus(AdSlotReservationStatusEnum.ACTIVE);
     * ```
     */
    async findByStatus(status: AdSlotReservationStatusEnum): Promise<AdSlotReservation[]> {
        try {
            const result = await this.findAll({ status });
            logQuery(this.entityName, 'findByStatus', { status }, result.items);
            return result.items;
        } catch (error) {
            logError(this.entityName, 'findByStatus', { status }, error as Error);
            throw error;
        }
    }

    /**
     * Activate a reservation (change status to ACTIVE)
     *
     * @param reservationId - The reservation ID to activate
     * @returns Updated reservation
     *
     * @example
     * ```ts
     * const activated = await model.activate('reservation-123');
     * ```
     */
    async activate(reservationId: string): Promise<AdSlotReservation> {
        try {
            const result = await this.update({ id: reservationId }, {
                status: AdSlotReservationStatusEnum.ACTIVE
            } as Partial<AdSlotReservation>);

            if (!result) {
                throw new Error(`Reservation not found: ${reservationId}`);
            }

            logQuery(this.entityName, 'activate', { reservationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'activate', { reservationId }, error as Error);
            throw error;
        }
    }

    /**
     * Pause a reservation (change status to PAUSED)
     *
     * @param reservationId - The reservation ID to pause
     * @returns Updated reservation
     *
     * @example
     * ```ts
     * const paused = await model.pause('reservation-123');
     * ```
     */
    async pause(reservationId: string): Promise<AdSlotReservation> {
        try {
            const result = await this.update({ id: reservationId }, {
                status: AdSlotReservationStatusEnum.PAUSED
            } as Partial<AdSlotReservation>);

            if (!result) {
                throw new Error(`Reservation not found: ${reservationId}`);
            }

            logQuery(this.entityName, 'pause', { reservationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'pause', { reservationId }, error as Error);
            throw error;
        }
    }

    /**
     * Cancel a reservation (change status to CANCELLED)
     *
     * @param reservationId - The reservation ID to cancel
     * @returns Updated reservation
     *
     * @example
     * ```ts
     * const cancelled = await model.cancel('reservation-123');
     * ```
     */
    async cancel(reservationId: string): Promise<AdSlotReservation> {
        try {
            const result = await this.update({ id: reservationId }, {
                status: AdSlotReservationStatusEnum.CANCELLED
            } as Partial<AdSlotReservation>);

            if (!result) {
                throw new Error(`Reservation not found: ${reservationId}`);
            }

            logQuery(this.entityName, 'cancel', { reservationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'cancel', { reservationId }, error as Error);
            throw error;
        }
    }

    /**
     * End a reservation (change status to ENDED)
     *
     * @param reservationId - The reservation ID to end
     * @returns Updated reservation
     *
     * @example
     * ```ts
     * const ended = await model.end('reservation-123');
     * ```
     */
    async end(reservationId: string): Promise<AdSlotReservation> {
        try {
            const result = await this.update({ id: reservationId }, {
                status: AdSlotReservationStatusEnum.ENDED
            } as Partial<AdSlotReservation>);

            if (!result) {
                throw new Error(`Reservation not found: ${reservationId}`);
            }

            logQuery(this.entityName, 'end', { reservationId }, result);
            return result;
        } catch (error) {
            logError(this.entityName, 'end', { reservationId }, error as Error);
            throw error;
        }
    }
}
