import type { BenefitPartnerModel } from '@repo/db';
import type { BenefitPartner, ListRelationsConfig } from '@repo/schemas';
import { BenefitPartnerSchema } from '@repo/schemas';
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
} from './benefitPartner.permissions.js';

/**
 * Service for managing benefit partners.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for benefit partner management.
 */
export class BenefitPartnerService extends BaseCrudService<
    BenefitPartner,
    BenefitPartnerModel,
    typeof BenefitPartnerSchema,
    typeof BenefitPartnerSchema,
    typeof BenefitPartnerSchema
> {
    static readonly ENTITY_NAME = 'benefit-partner';
    protected readonly entityName = BenefitPartnerService.ENTITY_NAME;

    public readonly model: BenefitPartnerModel;

    public readonly createSchema = BenefitPartnerSchema;
    public readonly updateSchema = BenefitPartnerSchema;
    public readonly searchSchema = BenefitPartnerSchema;

    constructor(ctx: ServiceContext, model?: BenefitPartnerModel) {
        super(ctx, BenefitPartnerService.ENTITY_NAME);
        this.model = model ?? ({} as BenefitPartnerModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create benefit partners
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update benefit partners
     */
    protected _canUpdate(actor: Actor, entity: BenefitPartner): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch benefit partners
     */
    protected _canPatch(actor: Actor, entity: BenefitPartner, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of benefit partners
     */
    protected _canUpdateVisibility(actor: Actor, entity: BenefitPartner): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete benefit partners
     */
    protected _canDelete(actor: Actor, entity: BenefitPartner): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete benefit partners
     */
    protected _canHardDelete(actor: Actor, entity: BenefitPartner): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore benefit partners
     */
    protected _canRestore(actor: Actor, entity: BenefitPartner): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view benefit partners
     */
    protected _canView(actor: Actor, entity: BenefitPartner): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list benefit partners
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete benefit partners
     */
    protected _canSoftDelete(actor: Actor, entity: BenefitPartner): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search benefit partners
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count benefit partners
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for benefit partners
     */
    protected async _executeSearch(
        _params: z.infer<typeof BenefitPartnerSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<BenefitPartner>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for benefit partners
     */
    protected async _executeCount(
        _params: z.infer<typeof BenefitPartnerSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
