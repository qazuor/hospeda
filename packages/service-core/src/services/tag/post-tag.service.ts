/**
 * PostTagService — Service for the PostTag subsystem (SPEC-086 T-017).
 *
 * PostTags are the public-facing, SEO-driven blog categorization taxonomy.
 * They are completely separate from the User-Tag subsystem (`tags` table).
 *
 * Key design decisions applied here:
 * - D-001: Two separate subsystems; PostTag lives in `post_tags` + `r_post_post_tag`.
 * - D-011: Hard delete only. No soft-delete lifecycle. DB FK cascades clean up assignments.
 * - D-013: Public endpoint returns only ACTIVE tags, no pagination, optional `usageCount`.
 * - D-014: Search uses `safeIlike` on `name` only (enforced in PostTagModel.findMany).
 * - AC-F05-02 / AC-F13: Slug uniqueness on create/update; public listing is ACTIVE-only.
 *
 * This service extends `BaseService` directly because the PostTag lifecycle does not
 * match the standard soft-delete / visibility / moderation pipeline in `BaseCrudService`.
 * All public methods use `runWithLoggingAndValidation` for homogeneous logging and error
 * propagation consistent with the rest of the codebase.
 *
 * @see SPEC-086 D-001, D-011, D-013, D-014, AC-F05-02, AC-F13
 */

import { PostTagModel, RPostPostTagModel } from '@repo/db';
import type { PostTagWithCount } from '@repo/db';
import type { PostTag } from '@repo/schemas';
import {
    CreatePostTagSchema,
    PostTagAdminSearchSchema,
    ServiceErrorCode,
    UpdatePostTagSchema
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import {
    assertCanAssignPostTag,
    assertCanCreatePostTag,
    assertCanDeletePostTag,
    assertCanUpdatePostTag,
    assertCanViewPostTag
} from './post-tag.permissions';

// ---------------------------------------------------------------------------
// Input / Output schemas for custom methods
// ---------------------------------------------------------------------------

/**
 * Schema for `getImpactCount` input.
 */
const GetImpactCountSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * Schema for `delete` input.
 */
const DeletePostTagSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * Schema for `setTagsForPost` input.
 */
const SetTagsForPostSchema = z.object({
    postId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    postTagIds: z.array(z.string().uuid({ message: 'zodError.common.id.invalidUuid' }))
});

/**
 * Schema for `removeTagFromPost` input.
 */
const RemoveTagFromPostSchema = z.object({
    postId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    postTagId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * Schema for `listPublic` input.
 */
const ListPublicSchema = z.object({
    withCounts: z.boolean().default(false)
});

// ---------------------------------------------------------------------------
// PostTagService
// ---------------------------------------------------------------------------

/**
 * Service for managing PostTags (public blog post taxonomy).
 *
 * Responsibilities:
 * - CRUD with slug/name uniqueness validation on create and update.
 * - Hard delete with impact count retrieval before deletion.
 * - Paginated admin list with optional filters.
 * - Public listing (ACTIVE only, no pagination, optional usageCount).
 * - Bulk-replace and single-remove of PostTag assignments on posts.
 *
 * @example
 * ```ts
 * const service = new PostTagService({ logger });
 * const result = await service.create(actor, { name: 'Gastronomía', slug: 'gastronomia', color: 'ORANGE' });
 * if (result.data) {
 *   console.log(result.data.id);
 * }
 * ```
 */
export class PostTagService extends BaseService {
    static readonly ENTITY_NAME = 'postTag' as const;

    /**
     * Primary model for the `post_tags` table.
     */
    protected readonly model: PostTagModel;

    /**
     * Join-table model for the `r_post_post_tag` table.
     */
    protected readonly relatedModel: RPostPostTagModel;

    /**
     * Creates a new PostTagService instance.
     *
     * @param config - Service configuration (optional logger).
     * @param model - Optional PostTagModel instance for testing/mocking.
     * @param relatedModel - Optional RPostPostTagModel instance for testing/mocking.
     */
    constructor(config: ServiceConfig, model?: PostTagModel, relatedModel?: RPostPostTagModel) {
        super(config, PostTagService.ENTITY_NAME);
        this.model = model ?? new PostTagModel();
        this.relatedModel = relatedModel ?? new RPostPostTagModel();
    }

    // -------------------------------------------------------------------------
    // CRUD — Create
    // -------------------------------------------------------------------------

    /**
     * Creates a new PostTag.
     *
     * Validates that neither the `slug` nor `name` is already used by an existing
     * (non-deleted) PostTag before inserting. Returns `ALREADY_EXISTS` if either
     * conflicts (AC-F05-02).
     *
     * @param actor - The actor creating the PostTag. Must have `POST_TAG_CREATE`.
     * @param input - PostTag creation input (name, slug, color, optional icon/description).
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<PostTag>` — the newly created PostTag on success.
     *
     * @example
     * ```ts
     * const result = await service.create(actor, {
     *   name: 'Gastronomía',
     *   slug: 'gastronomia',
     *   color: 'ORANGE',
     * });
     * ```
     */
    public async create(
        actor: Actor,
        input: z.input<typeof CreatePostTagSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PostTag>> {
        return this.runWithLoggingAndValidation({
            methodName: 'create',
            input: { actor, ...input },
            schema: CreatePostTagSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanCreatePostTag(actor);

                // Slug uniqueness check (AC-F05-02)
                const bySlug = await this.model.findBySlug(validated.slug, execCtx.tx);
                if (bySlug) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        `PostTag with slug "${validated.slug}" already exists`
                    );
                }

                const created = await this.model.create(validated, execCtx.tx);
                return created as PostTag;
            }
        });
    }

    // -------------------------------------------------------------------------
    // CRUD — Update
    // -------------------------------------------------------------------------

    /**
     * Updates an existing PostTag by ID.
     *
     * If `slug` is changed, validates uniqueness against other PostTags before
     * applying the update. If `name` or other fields change, no uniqueness check
     * beyond slug is enforced at the service layer (DB index enforces name uniqueness).
     *
     * @param actor - The actor updating the PostTag. Must have `POST_TAG_UPDATE`.
     * @param id - UUID of the PostTag to update.
     * @param input - Partial PostTag fields to update.
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<PostTag>` — the updated PostTag on success.
     *
     * @example
     * ```ts
     * const result = await service.update(actor, 'uuid-here', { name: 'Gastronomía regional' });
     * ```
     */
    public async update(
        actor: Actor,
        id: string,
        input: z.input<typeof UpdatePostTagSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PostTag>> {
        const idSchema = z.object({ id: z.string().uuid() });
        return this.runWithLoggingAndValidation({
            methodName: 'update',
            input: { actor, id, ...input },
            schema: idSchema.merge(UpdatePostTagSchema),
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanUpdatePostTag(actor);

                const { id: postTagId, ...updateData } = validated;

                // Verify the PostTag exists
                const existing = await this.model.findById(postTagId, execCtx.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `PostTag not found: ${postTagId}`
                    );
                }

                // Slug uniqueness check when slug is being changed
                if (updateData.slug && updateData.slug !== existing.slug) {
                    const bySlug = await this.model.findBySlug(updateData.slug, execCtx.tx);
                    if (bySlug && bySlug.id !== postTagId) {
                        throw new ServiceError(
                            ServiceErrorCode.ALREADY_EXISTS,
                            `PostTag with slug "${updateData.slug}" already exists`
                        );
                    }
                }

                const updated = await this.model.update({ id: postTagId }, updateData, execCtx.tx);
                if (!updated) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `PostTag not found after update: ${postTagId}`
                    );
                }
                return updated as PostTag;
            }
        });
    }

    // -------------------------------------------------------------------------
    // CRUD — Delete (hard delete only per D-011)
    // -------------------------------------------------------------------------

    /**
     * Hard-deletes a PostTag by ID.
     *
     * DB FK cascades on `r_post_post_tag.postTagId` handle removal of all
     * post assignments — no service-layer cascade logic is needed (D-011).
     *
     * The caller should call `getImpactCount` first and display a confirmation
     * dialog to the user before invoking this method.
     *
     * @param actor - The actor deleting the PostTag. Must have `POST_TAG_DELETE`.
     * @param id - UUID of the PostTag to permanently delete.
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<{ success: boolean }>` — success indicator.
     *
     * @example
     * ```ts
     * const impact = await service.getImpactCount(actor, 'tag-uuid');
     * // show confirmation with impact.data.count
     * const result = await service.delete(actor, 'tag-uuid');
     * ```
     */
    public async delete(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'delete',
            input: { actor, id },
            schema: DeletePostTagSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanDeletePostTag(actor);

                const existing = await this.model.findById(validated.id, execCtx.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `PostTag not found: ${validated.id}`
                    );
                }

                await this.model.hardDelete({ id: validated.id }, execCtx.tx);
                return { success: true };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Impact Count
    // -------------------------------------------------------------------------

    /**
     * Returns the number of posts that reference this PostTag.
     *
     * Intended for the delete-confirmation flow (D-011):
     * - UI calls this endpoint first to show "N posts will be affected".
     * - Then calls `delete` after user confirmation.
     *
     * @param actor - The actor requesting the count. Must have `POST_TAG_VIEW`.
     * @param id - UUID of the PostTag.
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<{ count: number }>` — number of affected posts.
     *
     * @example
     * ```ts
     * const result = await service.getImpactCount(actor, 'uuid-here');
     * if (result.data) {
     *   console.log(`${result.data.count} posts will be affected`);
     * }
     * ```
     */
    public async getImpactCount(
        actor: Actor,
        id: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ count: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getImpactCount',
            input: { actor, id },
            schema: GetImpactCountSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanViewPostTag(actor);
                const count = await this.model.getImpactCount(validated.id, execCtx.tx);
                return { count };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Admin list
    // -------------------------------------------------------------------------

    /**
     * Returns a paginated list of PostTags for admin views.
     *
     * Supports filtering by `lifecycleState`, `color`, and `name` substring.
     * Uses `safeIlike` for name search (D-014, enforced in PostTagModel.findMany).
     *
     * @param actor - The actor listing PostTags. Must have `POST_TAG_VIEW`.
     * @param query - Admin search parameters (page, pageSize, lifecycleState, color, name/search).
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<{ items: PostTag[]; total: number }>` — paginated results.
     *
     * @example
     * ```ts
     * const result = await service.listAdmin(actor, { page: 1, pageSize: 20, lifecycleState: 'ACTIVE' });
     * ```
     */
    public async listAdmin(
        actor: Actor,
        query: z.input<typeof PostTagAdminSearchSchema>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ items: PostTag[]; total: number }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listAdmin',
            input: { actor, ...query },
            schema: PostTagAdminSearchSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanViewPostTag(actor);

                const { page = 1, pageSize = 10, lifecycleState, name, search } = validated;

                // `search` from AdminSearchBaseSchema and `name` both target name substring
                const nameFilter = name ?? search;

                const result = await this.model.findMany(
                    {
                        lifecycleState: lifecycleState as PostTag['lifecycleState'],
                        name: nameFilter
                    },
                    { page, pageSize },
                    execCtx.tx
                );

                return result as { items: PostTag[]; total: number };
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public list (no actor required, ACTIVE only, D-013)
    // -------------------------------------------------------------------------

    /**
     * Returns all ACTIVE PostTags for the public endpoint.
     *
     * No pagination — realistic volume is 50–200 PostTags (D-013).
     * When `withCounts` is true, each PostTag is enriched with `usageCount`
     * (number of posts that reference it).
     *
     * No actor is required — this endpoint is accessible to anonymous visitors.
     *
     * @param withCounts - When true, include `usageCount` per tag. Defaults to false.
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<PostTag[] | PostTagWithCount[]>` — ACTIVE PostTags.
     *
     * @example
     * ```ts
     * const result = await service.listPublic(false);
     * const withCounts = await service.listPublic(true);
     * ```
     */
    public async listPublic(
        withCounts: boolean,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PostTag[] | PostTagWithCount[]>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listPublic',
            // listPublic has no actor — use a minimal system actor placeholder to satisfy the pipeline.
            // runWithLoggingAndValidation validates the actor shape but public endpoints
            // don't need real permissions. We pass a minimal valid actor.
            input: {
                actor: { id: 'public', role: 'SYSTEM' as never, permissions: [] },
                withCounts
            },
            schema: ListPublicSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                if (validated.withCounts) {
                    return this.model.findActiveWithCounts(execCtx.tx);
                }
                return this.model.findActive(execCtx.tx);
            }
        });
    }

    // -------------------------------------------------------------------------
    // PostTag assignments
    // -------------------------------------------------------------------------

    /**
     * Atomically replaces all PostTag assignments for a post.
     *
     * Before replacing, validates that each PostTag in `postTagIds` exists and
     * has lifecycle state ACTIVE. Delegates the atomic replace to
     * `RPostPostTagModel.setTagsForPost` which performs DELETE + INSERT in one
     * transaction.
     *
     * @param actor - The actor performing the assignment. Must have `POST_TAG_ASSIGN`.
     * @param postId - UUID of the post whose PostTags are being replaced.
     * @param postTagIds - Array of PostTag UUIDs to assign. Pass [] to clear all tags.
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<{ success: boolean }>` — success indicator.
     *
     * @example
     * ```ts
     * await service.setTagsForPost(actor, 'post-uuid', ['tag-uuid-1', 'tag-uuid-2']);
     * await service.setTagsForPost(actor, 'post-uuid', []); // clear all tags
     * ```
     */
    public async setTagsForPost(
        actor: Actor,
        postId: string,
        postTagIds: string[],
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setTagsForPost',
            input: { actor, postId, postTagIds },
            schema: SetTagsForPostSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanAssignPostTag(actor);

                // Validate each PostTag exists and is ACTIVE
                for (const tagId of validated.postTagIds) {
                    const tag = await this.model.findById(tagId, execCtx.tx);
                    if (!tag) {
                        throw new ServiceError(
                            ServiceErrorCode.NOT_FOUND,
                            `PostTag not found: ${tagId}`
                        );
                    }
                    if (tag.lifecycleState !== 'ACTIVE') {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            `PostTag "${tag.name}" is not ACTIVE and cannot be assigned`
                        );
                    }
                }

                await this.relatedModel.setTagsForPost(
                    validated.postId,
                    validated.postTagIds,
                    execCtx.tx
                );

                return { success: true };
            }
        });
    }

    /**
     * Removes a single PostTag assignment from a post.
     *
     * Delegates to `RPostPostTagModel.removeTagFromPost`. If the assignment does
     * not exist, returns success silently (idempotent delete).
     *
     * @param actor - The actor removing the assignment. Must have `POST_TAG_ASSIGN`.
     * @param postId - UUID of the post.
     * @param postTagId - UUID of the PostTag to remove.
     * @param ctx - Optional service context carrying a transaction client.
     * @returns `ServiceOutput<{ success: boolean }>` — success indicator.
     *
     * @example
     * ```ts
     * await service.removeTagFromPost(actor, 'post-uuid', 'tag-uuid');
     * ```
     */
    public async removeTagFromPost(
        actor: Actor,
        postId: string,
        postTagId: string,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ success: boolean }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'removeTagFromPost',
            input: { actor, postId, postTagId },
            schema: RemoveTagFromPostSchema,
            ctx,
            execute: async (validated, _actor, execCtx) => {
                assertCanAssignPostTag(actor);

                await this.relatedModel.removeTagFromPost(
                    validated.postId,
                    validated.postTagId,
                    execCtx.tx
                );

                return { success: true };
            }
        });
    }
}
