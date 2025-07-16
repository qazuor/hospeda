import type { PostSponsorModel } from '@repo/db';
import { PostSponsorModel as RealPostSponsorModel } from '@repo/db';
import { BaseCrudService } from '@repo/service-core';
import type { PostSponsorType } from '@repo/types';
import type { Actor, PaginatedListOutput, ServiceContext, ServiceLogger } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './postSponsor.normalizers';
import { checkCanManagePostSponsor } from './postSponsor.permissions';
import type { CreatePostSponsorInput, SearchPostSponsorInput } from './postSponsor.schemas';
import {
    CreatePostSponsorSchema,
    SearchPostSponsorSchema,
    UpdatePostSponsorSchema
} from './postSponsor.schemas';

/**
 * Service for managing PostSponsor entities.
 * Provides CRUD operations, search, and permission checks.
 */
export class PostSponsorService extends BaseCrudService<
    PostSponsorType,
    PostSponsorModel,
    typeof CreatePostSponsorSchema,
    typeof UpdatePostSponsorSchema,
    typeof SearchPostSponsorSchema
> {
    static readonly ENTITY_NAME = 'postSponsor';
    protected readonly entityName = PostSponsorService.ENTITY_NAME;
    public readonly model: PostSponsorModel;
    public readonly logger: ServiceLogger;
    public readonly createSchema = CreatePostSponsorSchema;
    public readonly updateSchema = UpdatePostSponsorSchema;
    public readonly searchSchema = SearchPostSponsorSchema;
    public readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: PostSponsorModel) {
        super(ctx, PostSponsorService.ENTITY_NAME);
        this.logger = ctx.logger;
        this.model = model ?? new RealPostSponsorModel();
    }

    protected _canCreate(actor: Actor, _data: CreatePostSponsorInput): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canUpdate(actor: Actor, _entity: PostSponsorType): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: PostSponsorType): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canRestore(actor: Actor, _entity: PostSponsorType): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canView(actor: Actor, _entity: PostSponsorType): void {
        checkCanManagePostSponsor(actor);
    }
    protected _canHardDelete(actor: Actor, _entity: PostSponsorType): void {
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
        _entity: PostSponsorType,
        _newVisibility: unknown
    ): void {
        checkCanManagePostSponsor(actor);
    }

    protected async _executeSearch(
        params: SearchPostSponsorInput,
        _actor: Actor
    ): Promise<PaginatedListOutput<PostSponsorType>> {
        const { filters, pagination } = params;
        const where: Record<string, unknown> = {};

        if (filters) {
            if (filters.type) {
                where.type = filters.type;
            }
            if (filters.name) {
                where.name = { $ilike: `%${filters.name}%` };
            }
            if (filters.q) {
                // Buscar por nombre o descripción (case-insensitive)
                where.$or = [
                    { name: { $ilike: `%${filters.q}%` } },
                    { description: { $ilike: `%${filters.q}%` } }
                ];
            }
        }

        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 20;
        const result = await this.model.findAll(where, { page, pageSize });
        return result;
    }
    protected async _executeCount(
        params: SearchPostSponsorInput,
        _actor: Actor
    ): Promise<{ count: number }> {
        const { filters } = params;
        const where: Record<string, unknown> = {};
        if (filters) {
            if (filters.type) {
                where.type = filters.type;
            }
            if (filters.name) {
                where.name = { $ilike: `%${filters.name}%` };
            }
            if (filters.q) {
                where.$or = [
                    { name: { $ilike: `%${filters.q}%` } },
                    { description: { $ilike: `%${filters.q}%` } }
                ];
            }
        }
        const count = await this.model.count(where);
        return { count };
    }
}
