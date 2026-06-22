import {
    SocialContentBatchModel as RealSocialContentBatchModel,
    type SelectSocialContentBatch,
    type SocialContentBatchModel,
    safeIlike,
    socialContentBatches
} from '@repo/db';
import type {
    SocialContentBatchAdminSearch,
    SocialContentBatchCreate,
    SocialContentBatchUpdate
} from '@repo/schemas';
import {
    SocialContentBatchAdminSearchSchema,
    SocialContentBatchCreateSchema,
    SocialContentBatchUpdateSchema,
    parseAdminSort
} from '@repo/schemas';
import { gte, lte } from 'drizzle-orm';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../types';
import { generateContentBatchSlug } from './social.helpers';
import { checkCanManageContentBatch } from './social.permissions';

/**
 * CRUD service for `social_content_batches` (publishing sprints).
 *
 * Slug is auto-generated from `name` on create when not explicitly provided.
 * On update, the slug is regenerated when `name` changes and no explicit `slug`
 * is supplied.
 *
 * Permission model: all operations are gated on `SOCIAL_BATCH_MANAGE`.
 */
export class SocialContentBatchService extends BaseCrudService<
    SelectSocialContentBatch,
    SocialContentBatchModel,
    typeof SocialContentBatchCreateSchema,
    typeof SocialContentBatchUpdateSchema,
    typeof SocialContentBatchAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'socialContentBatch';
    protected readonly entityName = SocialContentBatchService.ENTITY_NAME;
    public readonly model: SocialContentBatchModel;

    public readonly createSchema = SocialContentBatchCreateSchema;
    public readonly updateSchema = SocialContentBatchUpdateSchema;
    public readonly searchSchema = SocialContentBatchAdminSearchSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    constructor(ctx: ServiceConfig, model?: SocialContentBatchModel) {
        super(ctx, SocialContentBatchService.ENTITY_NAME);
        this.model = model ?? new RealSocialContentBatchModel();
        this.adminSearchSchema = SocialContentBatchAdminSearchSchema;
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks
    // -------------------------------------------------------------------------

    /**
     * Generates a unique slug from `name` when the caller does not supply one.
     */
    protected override async _beforeCreate(
        data: SocialContentBatchCreate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialContentBatch>> {
        const slug = data.slug ?? (await generateContentBatchSlug(data.name, this.model));
        return { ...data, slug };
    }

    /**
     * Regenerates the slug when `name` is updated and no explicit `slug` is provided.
     */
    protected override async _beforeUpdate(
        data: SocialContentBatchUpdate,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<SelectSocialContentBatch>> {
        if (data.name !== undefined && data.slug === undefined) {
            const slug = await generateContentBatchSlug(data.name, this.model);
            return { ...data, slug };
        }
        return { ...data };
    }

    // -------------------------------------------------------------------------
    // Permission hooks — all gated on SOCIAL_BATCH_MANAGE
    // -------------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: SocialContentBatchCreate): void {
        checkCanManageContentBatch(actor);
    }
    protected _canUpdate(actor: Actor, _entity: SelectSocialContentBatch): void {
        checkCanManageContentBatch(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: SelectSocialContentBatch): void {
        checkCanManageContentBatch(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: SelectSocialContentBatch): void {
        checkCanManageContentBatch(actor);
    }
    protected _canRestore(actor: Actor, _entity: SelectSocialContentBatch): void {
        checkCanManageContentBatch(actor);
    }
    protected _canView(actor: Actor, _entity: SelectSocialContentBatch): void {
        checkCanManageContentBatch(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanManageContentBatch(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanManageContentBatch(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanManageContentBatch(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: SelectSocialContentBatch,
        _newVisibility: unknown
    ): void {
        checkCanManageContentBatch(actor);
    }

    // -------------------------------------------------------------------------
    // Search / count
    // -------------------------------------------------------------------------

    protected async _executeSearch(
        params: SocialContentBatchAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<SelectSocialContentBatch>> {
        const { page = 1, pageSize = 20, sort, active, startsAfter, endsBefore, search } = params;
        const where: Record<string, unknown> = {};

        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialContentBatches.name, search));
        }
        if (startsAfter !== undefined) {
            additionalConditions.push(gte(socialContentBatches.startsAt, startsAfter));
        }
        if (endsBefore !== undefined) {
            additionalConditions.push(lte(socialContentBatches.endsAt, endsBefore));
        }

        const parsedSort = sort ? parseAdminSort(sort) : undefined;
        return this.model.findAll(
            where,
            { page, pageSize, sortBy: parsedSort?.field, sortOrder: parsedSort?.direction },
            additionalConditions
        );
    }

    protected async _executeCount(
        params: SocialContentBatchAdminSearch,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { active, startsAfter, endsBefore, search } = params;
        const where: Record<string, unknown> = {};

        if (active !== undefined) where.active = active;

        const additionalConditions = [];
        if (search) {
            additionalConditions.push(safeIlike(socialContentBatches.name, search));
        }
        if (startsAfter !== undefined) {
            additionalConditions.push(gte(socialContentBatches.startsAt, startsAfter));
        }
        if (endsBefore !== undefined) {
            additionalConditions.push(lte(socialContentBatches.endsAt, endsBefore));
        }

        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }
}
