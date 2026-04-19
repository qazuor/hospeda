/**
 * Admin media delete endpoint.
 *
 * DELETE /api/v1/admin/media?publicId=hospeda/prod/accommodations/...
 *
 * Deletes a Cloudinary asset by its publicId.
 * The publicId must start with "hospeda/" to prevent accidental deletion of
 * assets outside the project namespace.
 */
import { resolveEnvironment } from '@repo/media';
import { DeleteMediaQuerySchema, DeleteMediaResponseSchema, PermissionEnum } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context, MiddlewareHandler } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { type MediaEntityType, validateEntityMediaPermission } from './permissions';

/**
 * Safely decode a URL-encoded string. Returns the original input when
 * `decodeURIComponent` throws on a malformed escape sequence so the
 * traversal check can still inspect the raw value instead of crashing.
 */
const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/**
 * Pre-validation middleware for the admin DELETE /media route.
 *
 * Runs before OpenAPI/Zod query validation so that two security violations
 * surface with semantically appropriate HTTP statuses:
 *
 *   - GAP-078-034 + GAP-078-173 — path traversal segments (raw `..` or
 *     URL-encoded `%2E%2E`) yield HTTP 422 (UNPROCESSABLE_ENTITY) instead of
 *     the generic 400 returned by the global Zod default hook.
 *   - GAP-078-035 — `publicId` outside the current `resolveEnvironment()`
 *     scope yields HTTP 403 (FORBIDDEN) before any further processing,
 *     including the provider availability check.
 *
 * The handler itself still runs the schema and env checks as a defense-in-depth
 * second layer so callers cannot bypass validation by directly invoking the
 * route function in tests.
 */
const adminDeleteMediaPreValidation: MiddlewareHandler = async (ctx, next) => {
    const publicIdRaw = ctx.req.query('publicId');
    if (typeof publicIdRaw === 'string' && publicIdRaw.length > 0) {
        const decoded = safeDecode(publicIdRaw);
        if (publicIdRaw.includes('..') || decoded.includes('..')) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'UNPROCESSABLE_ENTITY',
                        message: 'publicId contains a forbidden path traversal segment'
                    }
                },
                422
            );
        }

        const expectedPrefix = `hospeda/${resolveEnvironment()}/`;
        if (publicIdRaw.startsWith('hospeda/') && !publicIdRaw.startsWith(expectedPrefix)) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: `publicId must start with "${expectedPrefix}" in this environment`
                    }
                },
                403
            );
        }
    }

    await next();
};

/** Service instances for entity ownership lookup during delete authorization. */
const deleteAccommodationService = new AccommodationService({ logger: apiLogger });
const deleteDestinationService = new DestinationService({ logger: apiLogger });
const deleteEventService = new EventService({ logger: apiLogger });
const deletePostService = new PostService({ logger: apiLogger });

const deleteEntityServices: Record<
    MediaEntityType,
    AccommodationService | DestinationService | EventService | PostService
> = {
    accommodation: deleteAccommodationService,
    destination: deleteDestinationService,
    event: deleteEventService,
    post: deletePostService
};

/**
 * Parses a Cloudinary publicId and extracts the entity type and id when the
 * path matches the expected admin media structure:
 *   hospeda/{env}/{entityPlural}/{entityId}/...
 *
 * Returns `null` if the publicId does not match (e.g. user avatars, seeds).
 */
const parseEntityFromPublicId = (
    publicId: string
): { entityType: MediaEntityType; entityId: string } | null => {
    const match = publicId.match(
        /^hospeda\/[^/]+\/(accommodations|destinations|events|posts)\/([^/]+)(\/|$)/
    );
    if (!match) return null;

    const pluralToSingular: Record<string, MediaEntityType> = {
        accommodations: 'accommodation',
        destinations: 'destination',
        events: 'event',
        posts: 'post'
    };

    const plural = match[1];
    const entityId = match[2];
    if (!plural || !entityId) return null;
    const entityType = pluralToSingular[plural];
    if (!entityType) return null;

    return { entityType, entityId };
};

/**
 * DELETE /api/v1/admin/media
 * Delete a media asset by its Cloudinary publicId. Admin only.
 */
export const adminDeleteMediaRoute = createAdminRoute({
    method: 'delete',
    path: '/',
    summary: 'Delete media asset',
    description:
        'Permanently deletes a Cloudinary asset by its publicId. ' +
        'The publicId must start with "hospeda/" to protect assets outside the project namespace.',
    tags: ['Media'],
    requiredPermissions: [PermissionEnum.MEDIA_DELETE],
    requestQuery: DeleteMediaQuerySchema.shape,
    responseSchema: DeleteMediaResponseSchema,
    options: {
        // Pre-validation hardening (GAP-078-034 / 035 / 173). Must run before
        // OpenAPI Zod validation so traversal failures get a 422 instead of the
        // generic 400 from the global default hook, and so env-mismatch yields
        // a 403 before the provider availability check.
        middlewares: [adminDeleteMediaPreValidation]
    },
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        // ── 0. Provider availability check ───────────────────────────────────
        const provider = getMediaProvider();
        if (!provider) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'CLOUDINARY_NOT_CONFIGURED',
                        message: 'Media service is not configured'
                    }
                },
                503
            );
        }

        // ── 1. Validate query params ──────────────────────────────────────────
        const parseResult = DeleteMediaQuerySchema.safeParse(query ?? {});
        if (!parseResult.success) {
            // Path-traversal attempts (raw `..` or URL-encoded) surface as a
            // schema-level refinement failure. These are unprocessable rather
            // than merely malformed, so we surface them with HTTP 422 so the
            // caller can distinguish them from other validation issues.
            const isTraversal = parseResult.error.issues.some((issue) =>
                issue.message.includes('path traversal')
            );
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: isTraversal ? 'UNPROCESSABLE_ENTITY' : 'VALIDATION_ERROR',
                        message: isTraversal
                            ? 'publicId contains a forbidden path traversal segment'
                            : 'Invalid query parameters',
                        details: parseResult.error.issues.map((issue) => ({
                            field: issue.path.join('.'),
                            message: issue.message
                        }))
                    }
                },
                isTraversal ? 422 : 400
            );
        }

        const { publicId } = parseResult.data;

        // ── 1a. Validate environment prefix ──────────────────────────────────
        // The publicId must live under `hospeda/{currentEnv}/...` so that callers
        // running in (for example) a dev or preview deployment cannot delete
        // production assets, even when the route-level permission check has
        // already passed. This is a defense-in-depth boundary.
        const currentEnv = resolveEnvironment();
        const expectedPrefix = `hospeda/${currentEnv}/`;
        if (!publicId.startsWith(expectedPrefix)) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: `publicId must start with "${expectedPrefix}" in this environment`
                    }
                },
                403
            );
        }

        // ── 1b. Resolve target entity from publicId ──────────────────────────
        const parsed = parseEntityFromPublicId(publicId);
        if (!parsed) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message:
                            'publicId does not target a known admin-managed entity (accommodations, destinations, events, posts)'
                    }
                },
                400
            );
        }

        // ── 1c. Fetch entity to verify existence and ownership ───────────────
        const actor = getActorFromContext(ctx);
        const service = deleteEntityServices[parsed.entityType];
        const entityResult = await service.getById(actor, parsed.entityId);

        if (entityResult.error || !entityResult.data) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'ENTITY_NOT_FOUND',
                        message: `Entity not found: ${parsed.entityType} with id ${parsed.entityId}`
                    }
                },
                404
            );
        }

        // ── 1d. Validate entity-specific permission (defense in depth) ───────
        const permissionCheck = validateEntityMediaPermission({
            actor,
            entityType: parsed.entityType,
            entity: entityResult.data as { ownerId?: string | null }
        });

        if (!permissionCheck.allowed) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message:
                            permissionCheck.reason === 'NOT_ENTITY_OWNER'
                                ? 'You do not own this entity'
                                : `Insufficient permissions to modify ${parsed.entityType} media`
                    }
                },
                403
            );
        }

        // ── 2. Delete from Cloudinary ─────────────────────────────────────────
        try {
            await provider.delete({ publicId });
        } catch (deleteError) {
            apiLogger.error(
                {
                    error: deleteError instanceof Error ? deleteError.message : String(deleteError),
                    publicId
                },
                'Cloudinary delete failed'
            );
            return ctx.json(
                {
                    success: false,
                    error: { code: 'UPSTREAM_ERROR', message: 'Media deletion failed' }
                },
                502
            );
        }

        return { deleted: true as const, publicId };
    }
});
