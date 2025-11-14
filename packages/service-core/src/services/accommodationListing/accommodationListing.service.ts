import type { AccommodationListingModel } from '@repo/db';
import type { AccommodationListing, ListRelationsConfig } from '@repo/schemas';
import {
    AccommodationListingCreateInputSchema,
    AccommodationListingListQuerySchema,
    AccommodationListingPatchInputSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type {
    Actor,
    PaginatedListOutput,
    ServiceContext,
    ServiceOutput
} from '../../types/index.js';
import {
    checkCanActivate,
    checkCanArchive,
    checkCanCount,
    checkCanCreate,
    checkCanDelete,
    checkCanHardDelete,
    checkCanList,
    checkCanPatch,
    checkCanPause,
    checkCanRestore,
    checkCanSearch,
    checkCanSoftDelete,
    checkCanUpdate,
    checkCanUpdateVisibility,
    checkCanView
} from './accommodationListing.permissions';

/**
 * Service for managing accommodation listings.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * and additional business logic methods for listing lifecycle management.
 */
export class AccommodationListingService extends BaseCrudService<
    AccommodationListing,
    AccommodationListingModel,
    typeof AccommodationListingCreateInputSchema,
    typeof AccommodationListingPatchInputSchema,
    typeof AccommodationListingListQuerySchema
> {
    static readonly ENTITY_NAME = 'accommodation-listing';
    protected readonly entityName = AccommodationListingService.ENTITY_NAME;

    public readonly model: AccommodationListingModel;

    public readonly createSchema = AccommodationListingCreateInputSchema;
    public readonly updateSchema = AccommodationListingPatchInputSchema;
    public readonly searchSchema = AccommodationListingListQuerySchema;

    constructor(ctx: ServiceContext, model?: AccommodationListingModel) {
        super(ctx, AccommodationListingService.ENTITY_NAME);
        this.model = model ?? ({} as AccommodationListingModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create accommodation listings
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update accommodation listings
     */
    protected _canUpdate(actor: Actor, entity: AccommodationListing): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch accommodation listings
     */
    protected _canPatch(actor: Actor, entity: AccommodationListing, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of accommodation listings
     */
    protected _canUpdateVisibility(actor: Actor, entity: AccommodationListing): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete accommodation listings
     */
    protected _canDelete(actor: Actor, entity: AccommodationListing): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete accommodation listings
     */
    protected _canHardDelete(actor: Actor, entity: AccommodationListing): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore accommodation listings
     */
    protected _canRestore(actor: Actor, entity: AccommodationListing): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view accommodation listings
     */
    protected _canView(actor: Actor, entity: AccommodationListing): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list accommodation listings
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can activate accommodation listings
     */
    protected _canActivate(actor: Actor, entity: AccommodationListing): void {
        checkCanActivate(actor, entity);
    }

    /**
     * Check if actor can pause accommodation listings
     */
    protected _canPause(actor: Actor, entity: AccommodationListing): void {
        checkCanPause(actor, entity);
    }

    /**
     * Check if actor can archive accommodation listings
     */
    protected _canArchive(actor: Actor, entity: AccommodationListing): void {
        checkCanArchive(actor, entity);
    }

    /**
     * Check if actor can soft delete accommodation listings
     */
    protected _canSoftDelete(actor: Actor, entity: AccommodationListing): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search accommodation listings
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count accommodation listings
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for accommodation listings
     */
    protected async _executeSearch(
        _params: z.infer<typeof AccommodationListingListQuerySchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<AccommodationListing>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for accommodation listings
     */
    protected async _executeCount(
        _params: z.infer<typeof AccommodationListingListQuerySchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }

    // ============================================================================
    // BUSINESS METHODS (3 lifecycle methods)
    // ============================================================================

    /**
     * Activate an accommodation listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with activated listing
     *
     * @example
     * ```ts
     * const result = await service.activate({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async activate(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<AccommodationListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'activate',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                this._canActivate(validatedActor, {} as AccommodationListing);
                const result = await this.model.activate(input.listingId);
                return result;
            }
        });
    }

    /**
     * Pause an accommodation listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with paused listing
     *
     * @example
     * ```ts
     * const result = await service.pause({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async pause(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<AccommodationListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'pause',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                this._canPause(validatedActor, {} as AccommodationListing);
                const result = await this.model.pause(input.listingId);
                return result;
            }
        });
    }

    /**
     * Archive an accommodation listing
     *
     * @param input - Actor and listing ID
     * @returns Service output with archived listing
     *
     * @example
     * ```ts
     * const result = await service.archive({
     *   actor: adminActor,
     *   listingId: 'listing-123'
     * });
     * ```
     */
    public async archive(input: {
        actor: Actor;
        listingId: string;
    }): Promise<ServiceOutput<AccommodationListing>> {
        return this.runWithLoggingAndValidation({
            methodName: 'archive',
            input: { actor: input.actor },
            schema: z.object({}),
            execute: async (_, validatedActor) => {
                this._canArchive(validatedActor, {} as AccommodationListing);
                const result = await this.model.archive(input.listingId);
                return result;
            }
        });
    }
}
