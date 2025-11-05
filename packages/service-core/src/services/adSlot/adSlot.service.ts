/**
 * AdSlot Service
 *
 * Business logic service for managing advertising slots including placement configuration,
 * pricing management, availability scheduling, and performance tracking.
 *
 * @module AdSlotService
 */

import type { AdSlot, AdSlotModel } from '@repo/db';
import {
    AdSlotSearchSchema,
    CreateAdSlotSchema,
    type ListRelationsConfig,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    UpdateAdSlotSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Type for performance metrics update
 */
export interface UpdateSlotPerformanceMetrics {
    impressions?: number;
    clicks?: number;
    revenue?: number;
    fillRate?: number;
}

/**
 * Type for availability check result
 */
export interface AvailabilityCheckResult {
    isAvailable: boolean;
    conflictingDates?: { start: Date; end: Date; reason: string }[];
    maxReservationsReached?: boolean;
}

/**
 * AdSlot Service
 *
 * Provides business logic for managing advertising slots with support for
 * complex placement configuration, dynamic pricing, availability management,
 * and performance tracking.
 *
 * @extends BaseCrudService
 */
export class AdSlotService extends BaseCrudService<
    AdSlot,
    AdSlotModel,
    typeof CreateAdSlotSchema,
    typeof UpdateAdSlotSchema,
    typeof AdSlotSearchSchema
> {
    static readonly ENTITY_NAME = 'adSlot';
    protected readonly entityName = AdSlotService.ENTITY_NAME;
    public readonly model: AdSlotModel;

    public readonly createSchema = CreateAdSlotSchema;
    public readonly updateSchema = UpdateAdSlotSchema;
    public readonly searchSchema = AdSlotSearchSchema;

    /**
     * Creates an instance of AdSlotService
     *
     * @param ctx - The service context containing the logger
     * @param model - Optional AdSlot model instance (for testing/mocking)
     */
    constructor(ctx: ServiceContext, model?: AdSlotModel) {
        super(ctx, AdSlotService.ENTITY_NAME);
        this.model = model ?? ({} as AdSlotModel);
    }

    /**
     * Returns default list relations (no relations for ad slots)
     */
    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // Permission Hooks
    // ============================================================================

    /**
     * Check if actor can create ad slots
     *
     * @param actor - The actor performing the action
     * @param _data - The data being created (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.AD_SLOT_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create ad slots'
            );
        }
    }

    /**
     * Check if actor can update ad slots
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being updated (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canUpdate(actor: Actor, _entity: AdSlot): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad slots'
            );
        }
    }

    /**
     * Check if actor can soft delete ad slots
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being deleted (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canSoftDelete(actor: Actor, _entity: AdSlot): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete ad slots'
            );
        }
    }

    /**
     * Check if actor can view ad slots
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being viewed (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canView(actor: Actor, _entity?: AdSlot): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view ad slots'
            );
        }
    }

    /**
     * Check if actor can hard delete ad slots
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being deleted (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canHardDelete(actor: Actor, _entity: AdSlot): void {
        if (!actor || actor.role !== RoleEnum.ADMIN) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins can permanently delete ad slots'
            );
        }
    }

    /**
     * Check if actor can restore soft-deleted ad slots
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being restored (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canRestore(actor: Actor, _entity: AdSlot): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_DELETE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore ad slots'
            );
        }
    }

    /**
     * Check if actor can list ad slots
     *
     * @param actor - The actor performing the action
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canList(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list ad slots'
            );
        }
    }

    /**
     * Check if actor can search ad slots
     *
     * @param actor - The actor performing the action
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canSearch(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search ad slots'
            );
        }
    }

    /**
     * Check if actor can count ad slots
     *
     * @param actor - The actor performing the action
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canCount(actor: Actor): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_VIEW);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count ad slots'
            );
        }
    }

    /**
     * Check if actor can update visibility of ad slots
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being updated (unused)
     * @param _newVisibility - The new visibility value (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canUpdateVisibility(actor: Actor, _entity: AdSlot, _newVisibility: unknown): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_UPDATE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad slot visibility'
            );
        }
    }

    /**
     * Check if actor can update ad slot pricing
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being updated (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canUpdatePricing(actor: Actor, _entity: AdSlot): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(PermissionEnum.AD_SLOT_PRICING_MANAGE);

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad slot pricing'
            );
        }
    }

    /**
     * Check if actor can update ad slot availability
     *
     * @param actor - The actor performing the action
     * @param _entity - The entity being updated (unused)
     * @throws ServiceError if not authorized
     * @protected
     */
    protected _canUpdateAvailability(actor: Actor, _entity: AdSlot): void {
        const isAdmin = actor.role === RoleEnum.ADMIN;
        const hasPermission = actor.permissions.includes(
            PermissionEnum.AD_SLOT_AVAILABILITY_MANAGE
        );

        if (!isAdmin && !hasPermission) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update ad slot availability'
            );
        }
    }

    // ============================================================================
    // Search and Count Methods
    // ============================================================================

    /**
     * Executes a search query for ad slots.
     * This method is called by the base search method after permission checks.
     *
     * @param params - Search parameters
     * @param _actor - The actor performing the search (unused)
     * @returns Search results with items and total count
     * @protected
     */
    protected async _executeSearch(
        params: z.infer<typeof AdSlotSearchSchema>
    ): Promise<{ items: AdSlot[]; total: number }> {
        return this.model.search(params);
    }

    /**
     * Executes a count query for ad slots.
     * This method is called by the base count method after permission checks.
     *
     * @param params - Search parameters for filtering
     * @param _actor - The actor performing the count (unused)
     * @returns Object with count property
     * @protected
     */
    protected async _executeCount(
        params: z.infer<typeof AdSlotSearchSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params as Partial<AdSlot>);
        return { count };
    }

    // ============================================================================
    // Custom Finder Methods
    // ============================================================================

    /**
     * Find all ad slots for a specific placement (page + position)
     *
     * @param actor - The actor performing the action
     * @param page - The page where slots are placed
     * @param position - The position within the page
     * @returns Service output with array of slots
     */
    async findByPlacement(
        actor: Actor,
        page: string,
        position: string
    ): Promise<ServiceOutput<AdSlot[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const slots = await this.model.findByPlacement(page, position);
        return { data: slots };
    }

    /**
     * Find all ad slots by format type
     *
     * @param actor - The actor performing the action
     * @param format - The format type (banner, square, etc.)
     * @returns Service output with array of slots
     */
    async findByFormat(actor: Actor, format: string): Promise<ServiceOutput<AdSlot[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const slots = await this.model.findByFormat(format);
        return { data: slots };
    }

    /**
     * Find all ad slots by pricing model
     *
     * @param actor - The actor performing the action
     * @param pricingModel - The pricing model (cpm, cpc, cpa, fixed_rate)
     * @returns Service output with array of slots
     */
    async findByPricingModel(actor: Actor, pricingModel: string): Promise<ServiceOutput<AdSlot[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const slots = await this.model.findByPricingModel(pricingModel);
        return { data: slots };
    }

    /**
     * Find all available slots for a date range
     *
     * @param actor - The actor performing the action
     * @param startDate - Start date for availability check
     * @param endDate - End date for availability check
     * @returns Service output with array of available slots
     */
    async findAvailableSlots(
        actor: Actor,
        startDate: Date,
        endDate: Date
    ): Promise<ServiceOutput<AdSlot[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const slots = await this.model.findAvailableSlots(startDate, endDate);
        return { data: slots };
    }

    /**
     * Get top performing ad slots
     *
     * @param actor - The actor performing the action
     * @param limit - Number of top slots to return
     * @returns Service output with array of top performing slots
     */
    async getTopPerformingSlots(actor: Actor, limit: number): Promise<ServiceOutput<AdSlot[]>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        const slots = await this.model.getTopPerformingSlots(limit);
        return { data: slots };
    }

    // ============================================================================
    // Business Logic Methods
    // ============================================================================

    /**
     * Update the status of an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param isActive - New active status
     * @param reason - Reason for status change
     * @returns Service output with updated slot
     */
    async updateStatus(
        actor: Actor,
        slotId: string,
        isActive: boolean,
        _reason: string
    ): Promise<ServiceOutput<AdSlot>> {
        // Check update permission
        try {
            const current = await this.model.findById(slotId);
            if (!current) {
                return {
                    error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad slot not found')
                };
            }
            this._canUpdate(actor, current);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        // Get current slot
        const current = await this.model.findById(slotId);
        if (!current) {
            return {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad slot not found')
            };
        }

        // Update availability with new status
        const updatedAvailability = {
            ...current.availability,
            isActive
        } as typeof current.availability;

        // Update slot
        const updated = await this.model.update(
            { id: slotId },
            { availability: updatedAvailability }
        );
        if (!updated) {
            return {
                error: new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Ad slot not found after update'
                )
            };
        }

        return { data: updated };
    }

    /**
     * Update pricing for an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param pricing - New pricing configuration
     * @param reason - Reason for pricing change
     * @returns Service output with updated slot
     */
    async updatePricing(
        actor: Actor,
        slotId: string,
        pricing: AdSlot['pricing'],
        _reason: string
    ): Promise<ServiceOutput<AdSlot>> {
        // Check pricing permission
        try {
            const current = await this.model.findById(slotId);
            if (!current) {
                return {
                    error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad slot not found')
                };
            }
            this._canUpdatePricing(actor, current);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        // Update slot
        const updated = await this.model.update({ id: slotId }, { pricing });
        if (!updated) {
            return {
                error: new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Ad slot not found after update'
                )
            };
        }

        return { data: updated };
    }

    /**
     * Update performance metrics for an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param metrics - The performance metrics to update
     * @returns Service output with updated slot
     */
    async updatePerformance(
        actor: Actor,
        slotId: string,
        metrics: UpdateSlotPerformanceMetrics
    ): Promise<ServiceOutput<AdSlot>> {
        // Check update permission
        try {
            const current = await this.model.findById(slotId);
            if (!current) {
                return {
                    error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad slot not found')
                };
            }
            this._canUpdate(actor, current);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        // Get current slot
        const current = await this.model.findById(slotId);
        if (!current) {
            return {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad slot not found')
            };
        }

        // Calculate new metrics
        const currentPerformance = current.performance || {
            totalImpressions: 0,
            totalClicks: 0,
            totalRevenue: 0,
            averageCTR: 0,
            averageRPM: 0,
            fillRate: 0
        };

        const updatedPerformance = {
            ...currentPerformance,
            totalImpressions: currentPerformance.totalImpressions + (metrics.impressions || 0),
            totalClicks: currentPerformance.totalClicks + (metrics.clicks || 0),
            totalRevenue: currentPerformance.totalRevenue + (metrics.revenue || 0)
        };

        // Calculate derived metrics
        if (updatedPerformance.totalImpressions > 0) {
            updatedPerformance.averageCTR =
                updatedPerformance.totalClicks / updatedPerformance.totalImpressions;
            updatedPerformance.averageRPM =
                (updatedPerformance.totalRevenue / updatedPerformance.totalImpressions) * 1000;
        }

        if (metrics.fillRate !== undefined) {
            updatedPerformance.fillRate = metrics.fillRate;
        }

        // Update slot
        const updated = await this.model.update(
            { id: slotId },
            { performance: updatedPerformance }
        );
        if (!updated) {
            return {
                error: new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Ad slot not found after update'
                )
            };
        }

        return { data: updated };
    }

    /**
     * Activate an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param reason - Reason for activation
     * @returns Service output with updated slot
     */
    async activate(actor: Actor, slotId: string, reason: string): Promise<ServiceOutput<AdSlot>> {
        return this.updateStatus(actor, slotId, true, reason);
    }

    /**
     * Deactivate an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param reason - Reason for deactivation
     * @returns Service output with updated slot
     */
    async deactivate(actor: Actor, slotId: string, reason: string): Promise<ServiceOutput<AdSlot>> {
        return this.updateStatus(actor, slotId, false, reason);
    }

    /**
     * Check availability of an ad slot for a date range
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param startDate - Start date for availability check
     * @param endDate - End date for availability check
     * @returns Service output with availability check result
     */
    async checkAvailability(
        actor: Actor,
        slotId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ServiceOutput<AvailabilityCheckResult>> {
        // Check view permission
        try {
            this._canView(actor);
        } catch (error) {
            if (error instanceof ServiceError) {
                return { error };
            }
            throw error;
        }

        // Get slot
        const slot = await this.model.findById(slotId);
        if (!slot) {
            return {
                error: new ServiceError(ServiceErrorCode.NOT_FOUND, 'Ad slot not found')
            };
        }

        // Check if slot is active
        if (!slot.availability.isActive) {
            return {
                data: {
                    isAvailable: false,
                    conflictingDates: [
                        {
                            start: startDate,
                            end: endDate,
                            reason: 'Slot is currently inactive'
                        }
                    ]
                }
            };
        }

        // Check blackout dates
        const conflictingDates: { start: Date; end: Date; reason: string }[] = [];
        for (const blackout of slot.availability.blackoutDates || []) {
            if (
                (blackout.startDate >= startDate && blackout.startDate <= endDate) ||
                (blackout.endDate >= startDate && blackout.endDate <= endDate) ||
                (blackout.startDate <= startDate && blackout.endDate >= endDate)
            ) {
                conflictingDates.push({
                    start: blackout.startDate,
                    end: blackout.endDate,
                    reason: blackout.reason
                });
            }
        }

        // Check availability window
        if (slot.availability.availableFrom && startDate < slot.availability.availableFrom) {
            return {
                data: {
                    isAvailable: false,
                    conflictingDates: [
                        {
                            start: startDate,
                            end: slot.availability.availableFrom,
                            reason: 'Slot not yet available'
                        }
                    ]
                }
            };
        }

        if (slot.availability.availableUntil && endDate > slot.availability.availableUntil) {
            return {
                data: {
                    isAvailable: false,
                    conflictingDates: [
                        {
                            start: slot.availability.availableUntil,
                            end: endDate,
                            reason: 'Slot no longer available'
                        }
                    ]
                }
            };
        }

        return {
            data: {
                isAvailable: conflictingDates.length === 0,
                conflictingDates: conflictingDates.length > 0 ? conflictingDates : undefined
            }
        };
    }

    /**
     * Increment impression count for an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param count - Number of impressions to add
     * @returns Service output with updated slot
     */
    async incrementImpressions(
        actor: Actor,
        slotId: string,
        count: number
    ): Promise<ServiceOutput<AdSlot>> {
        return this.updatePerformance(actor, slotId, { impressions: count });
    }

    /**
     * Increment click count for an ad slot
     *
     * @param actor - The actor performing the action
     * @param slotId - The slot ID
     * @param count - Number of clicks to add
     * @returns Service output with updated slot
     */
    async incrementClicks(
        actor: Actor,
        slotId: string,
        count: number
    ): Promise<ServiceOutput<AdSlot>> {
        return this.updatePerformance(actor, slotId, { clicks: count });
    }
}
