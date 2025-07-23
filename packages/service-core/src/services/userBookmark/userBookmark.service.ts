import { UserBookmarkModel } from '@repo/db';
import type { UserBookmarkType } from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import type { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './userBookmark.normalizers';
import { canAccessBookmark, canCreateBookmark } from './userBookmark.permissions';
import {
    type CountBookmarksForEntityInput,
    CountBookmarksForEntityInputSchema,
    type CountBookmarksForUserInput,
    CountBookmarksForUserInputSchema,
    type CreateUserBookmarkInput,
    CreateUserBookmarkSchema,
    type ListBookmarksByEntityInput,
    ListBookmarksByEntityInputSchema,
    type ListBookmarksByUserInput,
    ListBookmarksByUserInputSchema,
    UpdateUserBookmarkSchema
} from './userBookmark.schemas';

/**
 * Service for managing user bookmarks (favorites).
 * Implements business logic, permissions, and hooks for UserBookmark entities.
 * @extends BaseCrudService
 */
export class UserBookmarkService extends BaseCrudService<
    UserBookmarkType,
    UserBookmarkModel,
    typeof CreateUserBookmarkSchema,
    typeof UpdateUserBookmarkSchema,
    typeof ListBookmarksByUserInputSchema
> {
    static readonly ENTITY_NAME = 'userBookmark';
    protected readonly entityName = UserBookmarkService.ENTITY_NAME;
    protected readonly model: UserBookmarkModel;

    protected readonly createSchema = CreateUserBookmarkSchema;
    protected readonly updateSchema = UpdateUserBookmarkSchema;
    protected readonly searchSchema = ListBookmarksByUserInputSchema;
    protected normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceContext, model?: UserBookmarkModel) {
        super(ctx, UserBookmarkService.ENTITY_NAME);
        this.model = model ?? new UserBookmarkModel();
    }

    /**
     * Permite solo al dueño crear bookmarks para sí mismo.
     */
    protected _canCreate(actor: Actor, data: CreateUserBookmarkInput): void {
        if (actor && typeof actor.id === 'string') {
            canCreateBookmark(actor, data.userId);
        } else {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'userId is required to create a bookmark (from actor)'
            );
        }
    }

    /**
     * Permite solo al dueño o admin acceder/modificar/eliminar el bookmark.
     */
    protected _canUpdate(actor: Actor, entity: UserBookmarkType): void {
        canAccessBookmark(actor, entity);
    }
    protected _canDelete(actor: Actor, entity: UserBookmarkType): void {
        canAccessBookmark(actor, entity);
    }
    protected _canView(actor: Actor, entity: UserBookmarkType): void {
        canAccessBookmark(actor, entity);
    }
    protected _canList(actor: Actor): void {
        if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: Missing actor');
    }
    protected _canSearch(actor: Actor): void {
        this._canList(actor);
    }
    protected _canCount(actor: Actor): void {
        this._canList(actor);
    }
    protected _canSoftDelete(actor: Actor, entity: UserBookmarkType): void {
        canAccessBookmark(actor, entity);
    }
    protected _canHardDelete(actor: Actor, entity: UserBookmarkType): void {
        canAccessBookmark(actor, entity);
    }
    protected _canRestore(actor: Actor, entity: UserBookmarkType): void {
        canAccessBookmark(actor, entity);
    }
    protected _canUpdateVisibility(
        actor: Actor,
        entity: UserBookmarkType,
        _newVisibility: unknown
    ): void {
        canAccessBookmark(actor, entity);
    }

    /**
     * Lista todos los bookmarks de un usuario.
     */
    public async listBookmarksByUser(
        actor: Actor,
        params: ListBookmarksByUserInput
    ): Promise<ServiceOutput<{ bookmarks: UserBookmarkType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listBookmarksByUser',
            input: { ...params, actor },
            schema: ListBookmarksByUserInputSchema,
            execute: async (validated) => {
                if (actor.id !== validated.userId) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can list bookmarks'
                    );
                }
                const { pagination } = validated;
                const page = pagination?.page ?? 1;
                const pageSize = pagination?.pageSize ?? 20;
                const { items } = await this.model.findAll(
                    { userId: validated.userId },
                    { page, pageSize }
                );
                return { bookmarks: items };
            }
        });
    }

    /**
     * Lista todos los bookmarks sobre una entidad.
     */
    public async listBookmarksByEntity(
        actor: Actor,
        params: ListBookmarksByEntityInput
    ): Promise<ServiceOutput<{ bookmarks: UserBookmarkType[] }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listBookmarksByEntity',
            input: { ...params, actor },
            schema: ListBookmarksByEntityInputSchema,
            execute: async (validated) => {
                this._canList(actor);
                const { pagination } = validated;
                const page = pagination?.page ?? 1;
                const pageSize = pagination?.pageSize ?? 20;
                const { items } = await this.model.findAll(
                    { entityId: validated.entityId, entityType: validated.entityType },
                    { page, pageSize }
                );
                return { bookmarks: items };
            }
        });
    }

    /**
     * Cuenta cuántos usuarios tienen bookmarkeada una entidad.
     */
    public async countBookmarksForEntity(
        actor: Actor,
        params: CountBookmarksForEntityInput
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countBookmarksForEntity',
            input: { ...params, actor },
            schema: CountBookmarksForEntityInputSchema,
            execute: async (validated) => {
                this._canCount(actor);
                const count = await this.model.count({
                    entityId: validated.entityId,
                    entityType: validated.entityType
                });
                return { count };
            }
        });
    }

    /**
     * Cuenta cuántos bookmarks tiene un usuario.
     */
    public async countBookmarksForUser(
        actor: Actor,
        params: CountBookmarksForUserInput
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'countBookmarksForUser',
            input: { ...params, actor },
            schema: CountBookmarksForUserInputSchema,
            execute: async (validated) => {
                if (actor.id !== validated.userId) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'FORBIDDEN: Only owner can count bookmarks'
                    );
                }
                const count = await this.model.count({ userId: validated.userId });
                return { count };
            }
        });
    }

    protected async _executeSearch(
        params: z.infer<typeof ListBookmarksByUserInputSchema>,
        _actor: Actor
    ) {
        const { userId, pagination } = params;
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 20;
        const { items, total } = await this.model.findAll(userId ? { userId } : {}, {
            page,
            pageSize
        });
        return { items, total };
    }

    protected async _executeCount(
        params: z.infer<typeof ListBookmarksByUserInputSchema>,
        _actor: Actor
    ) {
        const { userId } = params;
        const count = await this.model.count(userId ? { userId } : {});
        return { count };
    }
}
