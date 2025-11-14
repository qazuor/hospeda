import type { AdMediaAssetModel } from '@repo/db';
import type { AdMediaAsset, ListRelationsConfig } from '@repo/schemas';
import {
    CreateAdMediaAssetSchema,
    SearchAdMediaAssetSchema,
    UpdateAdMediaAssetSchema
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
} from './adMediaAsset.permissions.js';

/**
 * Service for managing ad media assets.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for advertising media asset management.
 */
export class AdMediaAssetService extends BaseCrudService<
    AdMediaAsset,
    AdMediaAssetModel,
    typeof CreateAdMediaAssetSchema,
    typeof UpdateAdMediaAssetSchema,
    typeof SearchAdMediaAssetSchema
> {
    static readonly ENTITY_NAME = 'ad-media-asset';
    protected readonly entityName = AdMediaAssetService.ENTITY_NAME;

    public readonly model: AdMediaAssetModel;

    public readonly createSchema = CreateAdMediaAssetSchema;
    public readonly updateSchema = UpdateAdMediaAssetSchema;
    public readonly searchSchema = SearchAdMediaAssetSchema;

    constructor(ctx: ServiceContext, model?: AdMediaAssetModel) {
        super(ctx, AdMediaAssetService.ENTITY_NAME);
        this.model = model ?? ({} as AdMediaAssetModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create ad media assets
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update ad media assets
     */
    protected _canUpdate(actor: Actor, entity: AdMediaAsset): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch ad media assets
     */
    protected _canPatch(actor: Actor, entity: AdMediaAsset, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of ad media assets
     */
    protected _canUpdateVisibility(actor: Actor, entity: AdMediaAsset): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete ad media assets
     */
    protected _canDelete(actor: Actor, entity: AdMediaAsset): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete ad media assets
     */
    protected _canHardDelete(actor: Actor, entity: AdMediaAsset): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore ad media assets
     */
    protected _canRestore(actor: Actor, entity: AdMediaAsset): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view ad media assets
     */
    protected _canView(actor: Actor, entity: AdMediaAsset): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list ad media assets
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete ad media assets
     */
    protected _canSoftDelete(actor: Actor, entity: AdMediaAsset): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search ad media assets
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count ad media assets
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for ad media assets
     */
    protected async _executeSearch(
        _params: z.infer<typeof SearchAdMediaAssetSchema>,
        _actor: Actor
    ): Promise<PaginatedListOutput<AdMediaAsset>> {
        // For now, delegate to list method until search is implemented
        return {
            items: [],
            total: 0
        };
    }

    /**
     * Execute count for ad media assets
     */
    protected async _executeCount(
        _params: z.infer<typeof SearchAdMediaAssetSchema>,
        _actor: Actor
    ): Promise<{ count: number }> {
        return { count: 0 };
    }
}
