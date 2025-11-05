import type { FeaturedAccommodationModel } from '@repo/db';
import {
    FeaturedAccommodationCreateInputSchema,
    FeaturedAccommodationListQuerySchema,
    FeaturedAccommodationPatchInputSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { FeaturedAccommodation, FeaturedTypeEnum } from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Service for managing featured accommodations.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * and additional business logic methods.
 */
export class FeaturedAccommodationService extends BaseCrudService<
    FeaturedAccommodation,
    FeaturedAccommodationModel,
    typeof FeaturedAccommodationCreateInputSchema,
    typeof FeaturedAccommodationPatchInputSchema,
    typeof FeaturedAccommodationListQuerySchema
> {
    static readonly ENTITY_NAME = 'featured-accommodation';
    protected readonly entityName = FeaturedAccommodationService.ENTITY_NAME;

    public readonly model: FeaturedAccommodationModel;

    public readonly createSchema = FeaturedAccommodationCreateInputSchema;
    public readonly updateSchema = FeaturedAccommodationPatchInputSchema;
    public readonly searchSchema = FeaturedAccommodationListQuerySchema;

    constructor(ctx: ServiceContext, model?: FeaturedAccommodationModel) {
        super(ctx, FeaturedAccommodationService.ENTITY_NAME);
        this.model = model ?? ({} as FeaturedAccommodationModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard + 1 custom)
    // ============================================================================

    /**
     * Check if actor can create featured accommodations
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_CREATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can create featured accommodations'
            );
        }
    }

    /**
     * Check if actor can update featured accommodations
     */
    protected _canUpdate(actor: Actor, _id: string, _data: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_UPDATE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can update featured accommodations'
            );
        }
    }

    /**
     * Check if actor can soft delete featured accommodations
     */
    protected _canSoftDelete(actor: Actor, _id: string): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can delete featured accommodations'
            );
        }
    }

    /**
     * Check if actor can hard delete featured accommodations
     */
    protected _canHardDelete(actor: Actor, _id: string): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_HARD_DELETE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can permanently delete featured accommodations'
            );
        }
    }

    /**
     * Check if actor can restore featured accommodations
     */
    protected _canRestore(actor: Actor, _id: string): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_RESTORE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can restore featured accommodations'
            );
        }
    }

    /**
     * Check if actor can view featured accommodations
     */
    protected _canView(actor: Actor, _id: string): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can view featured accommodations'
            );
        }
    }

    /**
     * Check if actor can list featured accommodations
     */
    protected _canList(actor: Actor): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can list featured accommodations'
            );
        }
    }

    /**
     * Check if actor can search featured accommodations
     */
    protected _canSearch(actor: Actor, _filters: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can search featured accommodations'
            );
        }
    }

    /**
     * Check if actor can count featured accommodations
     */
    protected _canCount(actor: Actor, _filters: unknown): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_VIEW))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can count featured accommodations'
            );
        }
    }

    /**
     * Check if actor can manage featured accommodation status
     */
    protected _canManageStatus(actor: Actor, _id: string): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can manage featured accommodation status'
            );
        }
    }

    /**
     * Check if actor can manage featured accommodation priority
     */
    protected _canManagePriority(actor: Actor, _id: string): void {
        if (
            !actor ||
            !actor.id ||
            (actor.role !== RoleEnum.ADMIN &&
                !actor.permissions.includes(PermissionEnum.FEATURED_ACCOMMODATION_STATUS_MANAGE))
        ) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: Only admins or authorized users can manage priority'
            );
        }
    }

    // ============================================================================
    // CUSTOM FINDER METHODS (3)
    // ============================================================================

    /**
     * Find all active featured accommodations
     */
    async findActive(actor: Actor): Promise<ServiceOutput<FeaturedAccommodation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);
                const active = await this.model.findActive();
                return active;
            }
        });
    }

    /**
     * Find featured accommodations by type
     */
    async findByType(
        actor: Actor,
        featuredType: FeaturedTypeEnum
    ): Promise<ServiceOutput<FeaturedAccommodation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByType',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);
                const byType = await this.model.findByType(featuredType);
                return byType;
            }
        });
    }

    /**
     * Find featured accommodations by accommodation ID
     */
    async findByAccommodation(
        actor: Actor,
        accommodationId: string
    ): Promise<ServiceOutput<FeaturedAccommodation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'findByAccommodation',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canList(validatedActor);
                const byAccommodation = await this.model.findByAccommodation(accommodationId);
                return byAccommodation;
            }
        });
    }

    // ============================================================================
    // BUSINESS LOGIC METHODS (10)
    // ============================================================================

    /**
     * Feature an accommodation on the home page
     */
    async featureOnHome(
        actor: Actor,
        clientId: string,
        accommodationId: string,
        fromDate: Date,
        toDate: Date
    ): Promise<ServiceOutput<FeaturedAccommodation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'featureOnHome',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const featured = await this.model.featureOnHome({
                    clientId,
                    accommodationId,
                    fromDate,
                    toDate,
                    createdById: validatedActor.id
                });

                return featured;
            }
        });
    }

    /**
     * Feature an accommodation in destination pages
     */
    async featureInDestination(
        actor: Actor,
        clientId: string,
        accommodationId: string,
        fromDate: Date,
        toDate: Date
    ): Promise<ServiceOutput<FeaturedAccommodation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'featureInDestination',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const featured = await this.model.featureInDestination({
                    clientId,
                    accommodationId,
                    fromDate,
                    toDate,
                    createdById: validatedActor.id
                });

                return featured;
            }
        });
    }

    /**
     * Feature an accommodation in search results
     */
    async featureInSearch(
        actor: Actor,
        clientId: string,
        accommodationId: string,
        fromDate: Date,
        toDate: Date
    ): Promise<ServiceOutput<FeaturedAccommodation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'featureInSearch',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canCreate(validatedActor, {});

                const featured = await this.model.featureInSearch({
                    clientId,
                    accommodationId,
                    fromDate,
                    toDate,
                    createdById: validatedActor.id
                });

                return featured;
            }
        });
    }

    /**
     * Check if a featured accommodation is currently active
     */
    async isActive(actor: Actor, featuredId: string): Promise<ServiceOutput<boolean>> {
        return this.runWithLoggingAndValidation({
            methodName: 'isActive',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, featuredId);
                const active = await this.model.isActive(featuredId);
                return active;
            }
        });
    }

    /**
     * Calculate visibility score for a featured accommodation
     */
    async calculateVisibility(actor: Actor, featuredId: string): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'calculateVisibility',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, featuredId);
                const visibility = await this.model.calculateVisibility(featuredId);
                return visibility;
            }
        });
    }

    /**
     * Get placement statistics for a featured accommodation
     */
    async getPlacementStats(
        actor: Actor,
        featuredId: string
    ): Promise<
        ServiceOutput<{ views: number; clicks: number; conversions: number; position: number }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'getPlacementStats',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, featuredId);
                const stats = await this.model.getPlacementStats(featuredId);
                return stats;
            }
        });
    }

    /**
     * Get priority of a featured accommodation
     */
    async getPriority(actor: Actor, featuredId: string): Promise<ServiceOutput<number>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getPriority',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, featuredId);
                const priority = await this.model.getPriority(featuredId);
                return priority;
            }
        });
    }

    /**
     * Update priority of a featured accommodation
     */
    async updatePriority(
        actor: Actor,
        featuredId: string,
        priority: number
    ): Promise<ServiceOutput<FeaturedAccommodation>> {
        return this.runWithLoggingAndValidation({
            methodName: 'updatePriority',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canManagePriority(validatedActor, featuredId);
                const updated = await this.model.updatePriority(featuredId, priority);
                return updated;
            }
        });
    }

    /**
     * Resolve priority conflicts between featured accommodations
     */
    async resolvePriorityConflicts(
        actor: Actor,
        featuredType: FeaturedTypeEnum
    ): Promise<ServiceOutput<FeaturedAccommodation[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'resolvePriorityConflicts',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canManageStatus(validatedActor, featuredType);
                const resolved = await this.model.resolvePriorityConflicts(featuredType);
                return resolved;
            }
        });
    }

    /**
     * Get featured accommodation with accommodation details populated
     */
    async withAccommodation(
        actor: Actor,
        featuredId: string
    ): Promise<ServiceOutput<FeaturedAccommodation & { accommodation?: unknown }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'withAccommodation',
            input: { actor },
            schema: z.object({}),
            execute: async (_validatedData, validatedActor) => {
                this._canView(validatedActor, featuredId);
                const withAccommodation = await this.model.withAccommodation(featuredId);
                return withAccommodation;
            }
        });
    }
}
