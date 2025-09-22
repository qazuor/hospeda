import type { PostSponsorModel } from '@repo/db';
import { PostSponsorModel as RealPostSponsorModel } from '@repo/db';
import type {
    PostSponsor,
    PostSponsorCreateInput,
    PostSponsorListOutput,
    PostSponsorSearchInput
} from '@repo/schemas';
import {
    PostSponsorCreateInputSchema,
    PostSponsorSearchInputSchema,
    PostSponsorUpdateInputSchema
} from '@repo/schemas';
import { BaseCrudService } from '../../base';
import type { Actor, PaginatedListOutput, ServiceContext } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './postSponsor.normalizers';
import { checkCanManagePostSponsor } from './postSponsor.permissions';

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
    public readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: PostSponsorModel) {
        super(ctx, PostSponsorService.ENTITY_NAME);
        this.model = model ?? new RealPostSponsorModel();
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

    protected async _executeSearch(
        params: PostSponsorSearchInput,
        _actor: Actor
    ): Promise<PaginatedListOutput<PostSponsor>> {
        const { name, type, q, ...pagination } = params;
        const where: Record<string, unknown> = {};

        if (type) {
            where.type = type;
        }
        if (name) {
            where.name = { $ilike: `%${name}%` };
        }
        if (q) {
            // Search by name or description (case-insensitive)
            where.$or = [{ name: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }];
        }

        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 20;
        const result = await this.model.findAll(where, { page, pageSize });
        return result;
    }
    protected async _executeCount(
        params: PostSponsorSearchInput,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { name, type, q } = params;
        const where: Record<string, unknown> = {};
        if (type) {
            where.type = type;
        }
        if (name) {
            where.name = { $ilike: `%${name}%` };
        }
        if (q) {
            where.$or = [{ name: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }];
        }
        const count = await this.model.count(where);
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
    ): Promise<PostSponsorListOutput> {
        this._canSearch(actor);
        const { name, type, q, page = 1, pageSize = 10 } = params;

        const where: Record<string, unknown> = {};

        if (type) {
            where.type = type;
        }
        if (name) {
            where.name = { $ilike: `%${name}%` };
        }
        if (q) {
            where.$or = [{ name: { $ilike: `%${q}%` } }, { description: { $ilike: `%${q}%` } }];
        }

        const result = await this.model.findAll(where, { page, pageSize });
        return {
            items: result.items,
            total: result.total
        };
    }
}
