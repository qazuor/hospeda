import type { PostSponsorModel } from '@repo/db';
import { PostSponsorModel as RealPostSponsorModel, or, postSponsors, safeIlike } from '@repo/db';
import type {
    PostSponsor,
    PostSponsorCreateInput,
    PostSponsorListOutput,
    PostSponsorSearchInput
} from '@repo/schemas';
import {
    PostSponsorAdminSearchSchema,
    PostSponsorCreateInputSchema,
    PostSponsorSearchInputSchema,
    PostSponsorUpdateInputSchema
} from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudService } from '../../base';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './postSponsor.normalizers';
import { checkCanAdminList, checkCanManagePostSponsor } from './postSponsor.permissions';

/**
 * Service for managing PostSponsor entities.
 * Provides CRUD operations, search, and permission checks.
 */
export class PostSponsorService extends BaseCrudService<
    PostSponsor,
    PostSponsorModel,
    typeof PostSponsorCreateInputSchema,
    typeof PostSponsorUpdateInputSchema,
    typeof PostSponsorSearchInputSchema
> {
    static readonly ENTITY_NAME = 'postSponsor';
    protected readonly entityName = PostSponsorService.ENTITY_NAME;
    public readonly model: PostSponsorModel;

    public readonly createSchema = PostSponsorCreateInputSchema;
    public readonly updateSchema = PostSponsorUpdateInputSchema;
    public readonly searchSchema = PostSponsorSearchInputSchema;

    protected getDefaultListRelations() {
        return undefined;
    }

    public readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceConfig, model?: PostSponsorModel) {
        super(ctx, PostSponsorService.ENTITY_NAME);
        this.model = model ?? new RealPostSponsorModel();
        /** Uses default _executeAdminSearch() - all filter fields map directly to table columns. */
        this.adminSearchSchema = PostSponsorAdminSearchSchema;
    }

    protected _canCreate(actor: Actor, _data: PostSponsorCreateInput): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canUpdate(actor: Actor, _entity: PostSponsor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: PostSponsor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canRestore(actor: Actor, _entity: PostSponsor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canView(actor: Actor, _entity: PostSponsor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: PostSponsor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        _entity: PostSponsor,
        _newVisibility: unknown
    ): void {
        checkCanManagePostSponsor(actor);
    }

    /**
     * @inheritdoc
     * Verifies admin access via base class, then checks POST_SPONSOR_VIEW.
     */
    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanAdminList(actor);
    }

    protected async _executeSearch(
        params: PostSponsorSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<PostSponsor>> {
        const { name, type, q, page = 1, pageSize = 20, sortBy, sortOrder } = params;
        const where: Record<string, unknown> = {};

        if (type) {
            where.type = type;
        }

        const additionalConditions: SQL[] = [];
        if (name) {
            additionalConditions.push(safeIlike(postSponsors.name, name));
        }
        if (q) {
            const orCondition = or(
                safeIlike(postSponsors.name, q),
                safeIlike(postSponsors.description, q)
            );
            if (orCondition) additionalConditions.push(orCondition);
        }

        const result = await this.model.findAll(
            where,
            { page, pageSize, sortBy, sortOrder },
            additionalConditions
        );
        return result;
    }
    protected async _executeCount(
        params: PostSponsorSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const { name, type, q } = params;
        const where: Record<string, unknown> = {};
        if (type) {
            where.type = type;
        }

        const additionalConditions: SQL[] = [];
        if (name) {
            additionalConditions.push(safeIlike(postSponsors.name, name));
        }
        if (q) {
            const orCondition = or(
                safeIlike(postSponsors.name, q),
                safeIlike(postSponsors.description, q)
            );
            if (orCondition) additionalConditions.push(orCondition);
        }
        const count = await this.model.count(where, { additionalConditions });
        return { count };
    }

    /**
     * Searches for sponsors for list display.
     * @param actor - The actor performing the action
     * @param params - The search parameters
     * @returns Sponsors list
     */
    public async searchForList(
        actor: Actor,
        params: PostSponsorSearchInput
    ): Promise<ServiceOutput<PostSponsorListOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'searchForList',
            input: { actor, ...params },
            schema: z.record(z.string(), z.unknown()),
            execute: async (_validatedParams, validatedActor) => {
                await this._canSearch(validatedActor);
                const { name, type, q, page = 1, pageSize = 10, sortBy, sortOrder } = params;

                const where: Record<string, unknown> = {};
                if (type) {
                    where.type = type;
                }

                const additionalConditions: SQL[] = [];
                if (name) {
                    additionalConditions.push(safeIlike(postSponsors.name, name));
                }
                if (q) {
                    const orCondition = or(
                        safeIlike(postSponsors.name, q),
                        safeIlike(postSponsors.description, q)
                    );
                    if (orCondition) additionalConditions.push(orCondition);
                }

                const result = await this.model.findAll(
                    where,
                    { page, pageSize, sortBy, sortOrder },
                    additionalConditions
                );
                return {
                    items: result.items,
                    total: result.total
                };
            }
        });
    }
}
