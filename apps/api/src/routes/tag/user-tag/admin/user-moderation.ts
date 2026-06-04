/**
 * Admin USER tag moderation endpoints
 *
 * Super-admin moderation of USER tags across all owners.
 * Moderation is delete-only — no PATCH endpoint per D-012.
 *
 * Routes:
 *   GET    /api/v1/admin/tags/user     — list ALL USER tags across owners (TAG_VIEW_ALL_USER_TAGS)
 *   DELETE /api/v1/admin/tags/user/:id — delete any USER tag (TAG_USER_DELETE_ANY)
 *
 * @see SPEC-086 D-012, D-017, AC-008-01, AC-008-02
 */
import { getDb, users } from '@repo/db';
import { PermissionEnum, TagAdminSearchSchema, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import { inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { createRouter } from '../../../../utils/create-app';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Path parameter schema for tag ID */
const TagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/** Response schema for delete confirmation */
const DeleteResponseSchema = z.object({
    deleted: z.boolean(),
    impactCount: z.number().int().nonnegative()
});

/**
 * Response schema for the admin user-tag list — extends the base TagSchema
 * with owner fields enriched from the users table.
 * All owner fields are optional because the owner account may be deleted.
 */
const UserTagWithOwnerResponseSchema = TagSchema.extend({
    ownerDisplayName: z.string().nullable().optional(),
    ownerEmail: z.string().nullable().optional(),
    ownerRole: z.string().nullable().optional()
});

/**
 * GET /api/v1/admin/tags/user
 * List ALL USER tags across owners — Admin moderation endpoint
 *
 * Super-admin only. Returns all USER tags across all owners with owner identifier.
 * Supports standard admin pagination and search filters.
 * Requires TAG_VIEW_ALL_USER_TAGS permission.
 */
const adminListAllUserTagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all USER tags across owners (moderation)',
    description:
        'Returns a paginated list of all USER tags across all owners. Each tag includes owner displayName, email and role enriched from the users table. Super-admin moderation view. Requires TAG_VIEW_ALL_USER_TAGS permission (D-017).',
    tags: ['Tags', 'UserModeration'],
    requiredPermissions: [PermissionEnum.TAG_VIEW_ALL_USER_TAGS],
    requestQuery: TagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: UserTagWithOwnerResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        // Force type=USER — this endpoint only exposes USER tags
        const result = await tagService.adminList(actor, {
            ...(query ?? {}),
            type: 'USER'
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const items = result.data?.items ?? [];

        // Batch-enrich owner fields using getDb() directly (see reviews/public/list.ts pattern).
        // UserService._canView() would reject actor-as-moderator access to arbitrary users,
        // so we project only the three narrow fields needed for the moderation UI.
        const ownerIds = [...new Set(items.map((t) => t.ownerId).filter(Boolean))] as string[];
        const ownerMap = new Map<
            string,
            { displayName: string | null; email: string; role: string }
        >();

        if (ownerIds.length > 0) {
            const db = getDb();
            const ownerRows = await db
                .select({
                    id: users.id,
                    displayName: users.displayName,
                    email: users.email,
                    role: users.role
                })
                .from(users)
                .where(inArray(users.id, ownerIds));

            for (const u of ownerRows) {
                ownerMap.set(u.id, {
                    displayName: u.displayName ?? null,
                    email: u.email,
                    role: u.role
                });
            }
        }

        const enrichedItems = items.map((tag) => {
            const owner = tag.ownerId ? ownerMap.get(tag.ownerId) : undefined;
            return {
                ...tag,
                ownerDisplayName: owner?.displayName ?? null,
                ownerEmail: owner?.email ?? null,
                ownerRole: owner?.role ?? null
            };
        });

        return {
            items: enrichedItems,
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});

/**
 * DELETE /api/v1/admin/tags/user/:id
 * Delete any USER tag — Admin moderation endpoint
 *
 * Super-admin moderation action. Hard delete with DB cascade.
 * No PATCH route exists per D-012 (moderation is delete-only).
 * Requires TAG_USER_DELETE_ANY permission.
 */
const adminDeleteAnyUserTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete any USER tag (moderation)',
    description:
        "Permanently deletes any user's USER tag. DB FK cascades remove all assignments. Moderation is delete-only — no update route exists (D-012). Requires TAG_USER_DELETE_ANY permission.",
    tags: ['Tags', 'UserModeration'],
    requiredPermissions: [PermissionEnum.TAG_USER_DELETE_ANY],
    requestParams: { id: TagIdSchema },
    responseSchema: DeleteResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        apiLogger.debug(`[adminDeleteAnyUserTag] actor=${actor.id} tagId=${id}`);

        const result = await tagService.deleteTag(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

// ─── Router assembly ─────────────────────────────────────────────────────────

/**
 * User tag moderation router
 * Mounted at /api/v1/admin/tags/user
 *
 * NOTE: No PATCH route per D-012 (moderation is delete-only).
 * Tests should verify that PATCH returns 404 or 405.
 */
const userModerationApp = createRouter();

userModerationApp.route('/', adminListAllUserTagsRoute);
userModerationApp.route('/', adminDeleteAnyUserTagRoute);

export { userModerationApp as adminUserTagModerationRoutes };
