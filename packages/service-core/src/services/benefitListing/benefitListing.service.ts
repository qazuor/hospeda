import type { BenefitListingModel } from '@repo/db';
import type { BenefitListing, ListRelationsConfig } from '@repo/schemas';
import {
    CreateBenefitListingSchema,
    SearchBenefitListingsSchema,
    UpdateBenefitListingSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types/index.js';
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
} from './benefitListing.permissions.js';

/**
 * Service for managing benefit listings.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for benefit listings offered by partners to platform users.
 */
export class BenefitListingService extends BaseCrudService<
    BenefitListing,
    BenefitListingModel,
    typeof CreateBenefitListingSchema,
    typeof UpdateBenefitListingSchema,
    typeof SearchBenefitListingsSchema
> {
    static readonly ENTITY_NAME = 'benefit-listing';
    protected readonly entityName = BenefitListingService.ENTITY_NAME;

    public readonly model: BenefitListingModel;

    public readonly createSchema = CreateBenefitListingSchema;
    public readonly updateSchema = UpdateBenefitListingSchema;
    public readonly searchSchema = SearchBenefitListingsSchema;

    constructor(ctx: ServiceContext, model?: BenefitListingModel) {
        super(ctx, BenefitListingService.ENTITY_NAME);
        this.model = model ?? ({} as BenefitListingModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create benefit listings
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update benefit listings
     */
    protected _canUpdate(actor: Actor, entity: BenefitListing): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch benefit listings
     */
    protected _canPatch(actor: Actor, entity: BenefitListing, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of benefit listings
     */
    protected _canUpdateVisibility(actor: Actor, entity: BenefitListing): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete benefit listings
     */
    protected _canDelete(actor: Actor, entity: BenefitListing): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete benefit listings
     */
    protected _canHardDelete(actor: Actor, entity: BenefitListing): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore benefit listings
     */
    protected _canRestore(actor: Actor, entity: BenefitListing): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view benefit listings
     */
    protected _canView(actor: Actor, entity: BenefitListing): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list benefit listings
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete benefit listings
     */
    protected _canSoftDelete(actor: Actor, entity: BenefitListing): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search benefit listings
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count benefit listings
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for benefit listings
     */
    protected async _executeSearch(
        _params: z.infer<typeof SearchBenefitListingsSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<BenefitListing>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for benefit listings
     */
    protected async _executeCount(
        _params: z.infer<typeof SearchBenefitListingsSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
