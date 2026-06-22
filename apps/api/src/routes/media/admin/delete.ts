/**
 * Admin media delete endpoint.
 *
 * DELETE /api/v1/admin/media?publicId=hospeda/prod/accommodations/...
 *
 * Deletes a Cloudinary asset by its publicId.
 * The publicId must start with "hospeda/" to prevent accidental deletion of
 * assets outside the project namespace.
 *
 * Response contract (SPEC-078-GAPS T-030):
 *   - Body is wrapped via `ResponseFactory` (`createResponse`) as
 *     `{ success: true, data: {...}, metadata: {...} }`. No `ctx.json` bypass
 *     in the success path — error helpers (`createErrorResponse`) carry the
 *     same wrapping for the failure paths.
 *   - `data.wasPresent` (GAP-078-154) reports whether the asset existed at
 *     delete time: `true` for a real removal, `false` when Cloudinary
 *     returned `'not found'` (idempotent no-op).
 */
import { resolveEnvironment } from '@repo/media/server';
import { DeleteMediaQuerySchema, DeleteMediaResponseSchema, PermissionEnum } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    ExperienceService,
    GastronomyService,
    PostService
} from '@repo/service-core';
import type { Context, MiddlewareHandler } from 'hono';
import { Sentry } from '../../../lib/sentry';
import { incrementDomainCounter } from '../../../middlewares/metrics';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
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
            return createErrorResponse(
                {
                    code: 'UNPROCESSABLE_ENTITY',
                    message: 'publicId contains a forbidden path traversal segment'
                },
                ctx,
                422
            );
        }

        const expectedPrefix = `hospeda/${resolveEnvironment()}/`;
        if (publicIdRaw.startsWith('hospeda/') && !publicIdRaw.startsWith(expectedPrefix)) {
            return createErrorResponse(
                {
                    code: 'FORBIDDEN',
                    message: `publicId must start with "${expectedPrefix}" in this environment`
                },
                ctx,
                403
            );
        }
    }

    await next();
};

/**
 * Resolves an entity service per-request for delete-authorization lookups
 * (SPEC-078-GAPS T-034 / GAP-078-060).
 *
 * Service instances are constructed lazily inside the handler instead of
 * at module load time so test isolation is preserved (no singleton state
 * leaks across the request boundary) and any context-bound dependencies
 * introduced later can be supplied without refactoring this module.
 */
const resolveDeleteEntityService = (
    entityType: MediaEntityType
):
    | AccommodationService
    | DestinationService
    | EventService
    | PostService
    | GastronomyService
    | ExperienceService => {
    switch (entityType) {
        case 'accommodation':
            return new AccommodationService({ logger: apiLogger });
        case 'destination':
            return new DestinationService({ logger: apiLogger });
        case 'event':
            return new EventService({ logger: apiLogger });
        case 'post':
            return new PostService({ logger: apiLogger });
        case 'gastronomy':
            return new GastronomyService({ logger: apiLogger });
        case 'experience':
            return new ExperienceService({ logger: apiLogger });
    }
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
        // SPEC-079: per-user sliding-window rate limit — 60 deletes per 1-minute
        // window for admin users. Applied before pre-validation so abuse is
        // rejected early without spending query/parse budget.
        // Pre-validation hardening (GAP-078-034 / 035 / 173) runs after the rate
        // limit check; traversal failures still surface with 422, env-mismatch with 403.
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 60,
                keyPrefix: 'delete:admin'
            }),
            adminDeleteMediaPreValidation
        ]
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
            return createErrorResponse(
                {
                    code: 'CLOUDINARY_NOT_CONFIGURED',
                    message: 'Media service is not configured'
                },
                ctx,
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
            return createErrorResponse(
                {
                    code: isTraversal ? 'UNPROCESSABLE_ENTITY' : 'VALIDATION_ERROR',
                    message: isTraversal
                        ? 'publicId contains a forbidden path traversal segment'
                        : 'Invalid query parameters',
                    details: parseResult.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message
                    }))
                },
                ctx,
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
            return createErrorResponse(
                {
                    code: 'FORBIDDEN',
                    message: `publicId must start with "${expectedPrefix}" in this environment`
                },
                ctx,
                403
            );
        }

        // ── 1b. Resolve target entity from publicId ──────────────────────────
        const parsed = parseEntityFromPublicId(publicId);
        if (!parsed) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message:
                        'publicId does not target a known admin-managed entity (accommodations, destinations, events, posts)'
                },
                ctx,
                400
            );
        }

        // ── 1c. Fetch entity to verify existence and ownership ───────────────
        const actor = getActorFromContext(ctx);
        const service = resolveDeleteEntityService(parsed.entityType);
        const entityResult = await service.getById(actor, parsed.entityId);

        if (entityResult.error || !entityResult.data) {
            return createErrorResponse(
                {
                    code: 'ENTITY_NOT_FOUND',
                    message: `Entity not found: ${parsed.entityType} with id ${parsed.entityId}`
                },
                ctx,
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
            return createErrorResponse(
                {
                    code: 'FORBIDDEN',
                    message:
                        permissionCheck.reason === 'NOT_ENTITY_OWNER'
                            ? 'You do not own this entity'
                            : `Insufficient permissions to modify ${parsed.entityType} media`
                },
                ctx,
                403
            );
        }

        // ── 2. Delete from Cloudinary ─────────────────────────────────────────
        // SPEC-078-GAPS GAP-078-154: capture the provider's `wasPresent`
        // signal so the response distinguishes "deleted just now" from
        // "already absent". Both outcomes resolve normally — only a thrown
        // upstream error maps to 502.
        let wasPresent: boolean;
        try {
            const deleteResult = await provider.delete({ publicId });
            wasPresent = deleteResult.wasPresent;
        } catch (deleteError) {
            apiLogger.error(
                {
                    error: deleteError instanceof Error ? deleteError.message : String(deleteError),
                    publicId
                },
                'Cloudinary delete failed'
            );
            // SPEC-078-GAPS T-056 / GAP-078-129: capture provider errors so
            // upstream Cloudinary failures surface in Sentry with a tag that
            // groups them under the media-provider component.
            Sentry.captureException(deleteError, {
                tags: { component: 'media-provider', operation: 'delete' },
                contexts: {
                    media: {
                        publicId,
                        entityType: parsed.entityType,
                        entityId: parsed.entityId
                    }
                }
            });
            incrementDomainCounter('media_delete_total', 'failure');
            return createErrorResponse(
                { code: 'UPSTREAM_ERROR', message: 'Media deletion failed' },
                ctx,
                502
            );
        }

        // ── 2b. Structured success log + counter (SPEC-078-GAPS T-056 /
        //         GAP-078-050 + GAP-078-129). Both `wasPresent=true` and
        //         `wasPresent=false` are recorded as `success` here — the
        //         counter measures provider-call outcome, not asset state.
        apiLogger.info(
            {
                event: 'media.delete.success',
                publicId,
                preset: `${parsed.entityType}:delete`,
                entityType: parsed.entityType,
                entityId: parsed.entityId,
                wasPresent,
                actorId: actor.id
            },
            'media delete success'
        );
        incrementDomainCounter('media_delete_total', 'success');

        // The factory wraps `{ deleted, publicId, wasPresent }` via
        // `ResponseFactory.createResponse` and emits the standard envelope.
        return { deleted: true as const, publicId, wasPresent };
    }
});
