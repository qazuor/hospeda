import type { ProfessionalServiceTypeModel } from '@repo/db';
import type { ListRelationsConfig, ProfessionalService } from '@repo/schemas';
import {
    CreateProfessionalServiceSchema,
    SearchProfessionalServicesSchema,
    UpdateProfessionalServiceSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base/base.crud.service.js';
import type { Actor, ServiceContext } from '../../types/index.js';
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
} from './professionalService.permissions.js';

/**
 * Service for managing professional services.
 * Extends BaseCrudService to provide CRUD operations with permission checks
 * for professional service listing management.
 */
export class ProfessionalServiceService extends BaseCrudService<
    ProfessionalService,
    ProfessionalServiceTypeModel,
    typeof CreateProfessionalServiceSchema,
    typeof UpdateProfessionalServiceSchema,
    typeof SearchProfessionalServicesSchema
> {
    static readonly ENTITY_NAME = 'professional-service';
    protected readonly entityName = ProfessionalServiceService.ENTITY_NAME;

    public readonly model: ProfessionalServiceTypeModel;

    public readonly createSchema = CreateProfessionalServiceSchema;
    public readonly updateSchema = UpdateProfessionalServiceSchema;
    public readonly searchSchema = SearchProfessionalServicesSchema;

    constructor(ctx: ServiceContext, model?: ProfessionalServiceTypeModel) {
        super(ctx, ProfessionalServiceService.ENTITY_NAME);
        this.model = model ?? ({} as ProfessionalServiceTypeModel);
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return {};
    }

    // ============================================================================
    // PERMISSION HOOKS (11 standard hooks)
    // ============================================================================

    /**
     * Check if actor can create professional services
     */
    protected _canCreate(actor: Actor, _data: unknown): void {
        checkCanCreate(actor, _data);
    }

    /**
     * Check if actor can update professional services
     */
    protected _canUpdate(actor: Actor, entity: ProfessionalService): void {
        checkCanUpdate(actor, entity);
    }

    /**
     * Check if actor can patch professional services
     */
    protected _canPatch(actor: Actor, entity: ProfessionalService, data: unknown): void {
        checkCanPatch(actor, entity, data);
    }

    /**
     * Check if actor can update visibility of professional services
     */
    protected _canUpdateVisibility(actor: Actor, entity: ProfessionalService): void {
        checkCanUpdateVisibility(actor, entity);
    }

    /**
     * Check if actor can soft delete professional services
     */
    protected _canDelete(actor: Actor, entity: ProfessionalService): void {
        checkCanDelete(actor, entity);
    }

    /**
     * Check if actor can hard delete professional services
     */
    protected _canHardDelete(actor: Actor, entity: ProfessionalService): void {
        checkCanHardDelete(actor, entity);
    }

    /**
     * Check if actor can restore professional services
     */
    protected _canRestore(actor: Actor, entity: ProfessionalService): void {
        checkCanRestore(actor, entity);
    }

    /**
     * Check if actor can view professional services
     */
    protected _canView(actor: Actor, entity: ProfessionalService): void {
        checkCanView(actor, entity);
    }

    /**
     * Check if actor can list professional services
     */
    protected _canList(actor: Actor): void {
        checkCanList(actor);
    }

    /**
     * Check if actor can soft delete professional services
     */
    protected _canSoftDelete(actor: Actor, entity: ProfessionalService): void {
        checkCanSoftDelete(actor, entity);
    }

    /**
     * Check if actor can search professional services
     */
    protected _canSearch(actor: Actor): void {
        checkCanSearch(actor);
    }

    /**
     * Check if actor can count professional services
     */
    protected _canCount(actor: Actor): void {
        checkCanCount(actor);
    }

    /**
     * Execute search for professional services
     * Delegates to model.findAll() with search parameters
     */
    protected async _executeSearch(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<{ items: ProfessionalService[]; total: number }> {
        const result = await this.model.findAll(params);
        return {
            items: result.items,
            total: result.total
        };
    }

    /**
     * Execute count for professional services
     * Delegates to model.count() with search parameters
     */
    protected async _executeCount(
        params: Record<string, unknown>,
        _actor: Actor
    ): Promise<{ count: number }> {
        const count = await this.model.count(params);
        return { count };
    }
}
