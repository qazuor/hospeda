/**
 * Protected media delete endpoint for entity images.
 *
 * DELETE /api/v1/protected/media/delete-entity?publicId=hospeda/...
 *
 * Allows an authenticated host to delete a Cloudinary asset for an entity
 * they own. The publicId encodes the entity type and id
 * (e.g. `hospeda/{env}/accommodations/{entityId}/...`), so ownership is
 * verified server-side before the delete is executed.
 *
 * AUTHZ: the actor MUST be the entity's owner (`entity.ownerId === actor.id`).
 *        Actors holding ACCOMMODATION_UPDATE_ANY bypass the ownership check
 *        (same pattern as admin delete + upload-entity).
 *
 * Response shape mirrors the admin DELETE: `{ deleted, publicId, wasPresent? }`.
 */
import { resolveEnvironment } from '@repo/media/server';
import { DeleteMediaQuerySchema, DeleteMediaResponseSchema, PermissionEnum } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createProtectedRoute } from '../../../utils/route-factory';
import type { MediaEntityType } from '../admin/permissions';

/** Reusable Zod validator for actor.id UUID format. */
const ActorIdSchema = z.string().uuid();

/**
 * Safely decode a URL-encoded string.
 * Returns the original input when `decodeURIComponent` throws on a malformed
 * escape sequence so the traversal check can still inspect the raw value.
 */
const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/**
 * Pre-validation middleware for the protected DELETE /media/delete-entity route.
 *
 * Runs before OpenAPI/Zod query validation so that two security violations
 * surface with semantically appropriate HTTP statuses:
 *
 *   - Path traversal segments (raw `..` or URL-encoded `%2E%2E`) → HTTP 422
 *   - `publicId` outside the current `resolveEnvironment()` scope → HTTP 403
 *
 * The handler still runs the schema and env checks as a defense-in-depth layer.
 */
const protectedDeletePreValidation: MiddlewareHandler = async (ctx, next) => {
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

        const currentEnv = resolveEnvironment();
        const expectedPrefix = `hospeda/${currentEnv}/`;
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
 * Supported entity types for the protected delete endpoint.
 * Must match the allowed types in the protected upload-entity route.
 */
const SUPPORTED_ENTITY_TYPES = new Set<string>(['accommodation', 'destination', 'event', 'post']);

/** Maps plural Cloudinary path segments to singular entity-type strings. */
const PLURAL_TO_SINGULAR: Readonly<Record<string, MediaEntityType>> = {
    accommodations: 'accommodation',
    destinations: 'destination',
    events: 'event',
    posts: 'post'
};

/**
 * Parse the entity type and entity id from a Cloudinary publicId of the form:
 *   hospeda/{env}/{entityPlural}/{entityId}/...
 *
 * Returns null when the publicId does not match the expected entity path shape
 * (e.g. avatars, seed assets).
 */
const parseEntityFromPublicId = (
    publicId: string
): { entityType: MediaEntityType; entityId: string } | null => {
    const match = publicId.match(
        /^hospeda\/[^/]+\/(accommodations|destinations|events|posts)\/([^/]+)(\/|$)/
    );
    if (!match) return null;

    const plural = match[1];
    const entityId = match[2];
    if (!plural || !entityId) return null;
    const entityType = PLURAL_TO_SINGULAR[plural];
    if (!entityType) return null;

    return { entityType, entityId };
};

/**
 * Resolve an entity service for the given type.
 */
const resolveEntityService = (
    entityType: MediaEntityType
): AccommodationService | DestinationService | EventService | PostService => {
    switch (entityType) {
        case 'accommodation':
            return new AccommodationService({ logger: apiLogger });
        case 'destination':
            return new DestinationService({ logger: apiLogger });
        case 'event':
            return new EventService({ logger: apiLogger });
        case 'post':
            return new PostService({ logger: apiLogger });
    }
};

/**
 * DELETE /api/v1/protected/media/delete-entity
 * Delete an entity media asset (featured or gallery image) for an entity
 * owned by the authenticated user.
 *
 * Ownership check: the publicId must encode an entity whose `ownerId === actor.id`,
 * unless the actor holds ACCOMMODATION_UPDATE_ANY (admin-level bypass).
 */
export const protectedDeleteEntityRoute = createProtectedRoute({
    method: 'delete',
    path: '/delete-entity',
    summary: 'Delete entity media asset (owner only)',
    description:
        'Deletes a Cloudinary asset for a content entity owned by the authenticated user. ' +
        'The publicId must start with "hospeda/" and encode a supported entity type. ' +
        'Returns { deleted, publicId, wasPresent }.',
    tags: ['Media'],
    responseSchema: DeleteMediaResponseSchema,
    // Declare query params so OpenAPI does not reject them with 400.
    // We use .shape (the raw object shape) because the field-level .refine() chains
    // produce ZodEffects on the string fields, not on the object itself — .shape
    // is still accessible and OpenAPI tolerates ZodEffects on individual fields.
    // Manual re-validation with DeleteMediaQuerySchema.safeParse() runs in the handler
    // for the full constraint set (traversal check, custom messages).
    requestQuery: DeleteMediaQuerySchema.shape,
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 60,
                keyPrefix: 'delete:protected-entity'
            }),
            // Pre-validation: intercept traversal (..) and cross-env publicId before
            // OpenAPI query validation runs, so they surface with 422/403 instead of 400.
            protectedDeletePreValidation
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

        // ── 0b. Actor UUID guard (mirrors upload-entity pattern) ─────────────
        const actor = getActorFromContext(ctx);
        const actorIdCheck = ActorIdSchema.safeParse(actor.id);
        if (!actorIdCheck.success) {
            apiLogger.error(
                { issue: actorIdCheck.error.issues[0]?.code ?? 'invalid_string' },
                'Refusing media delete: actor.id is not a valid UUID'
            );
            return createErrorResponse(
                { code: 'INTERNAL_ERROR', message: 'Internal server error' },
                ctx,
                500
            );
        }

        // ── 0c. Re-verify session (mirrors upload-entity pattern) ────────────
        const currentSessionUser = ctx.get('user') as { id?: string } | undefined;
        const currentSession = ctx.get('session') as { userId?: string } | undefined;
        const liveActorId = currentSessionUser?.id ?? currentSession?.userId;
        const sessionContextPresent = Boolean(currentSessionUser) || Boolean(currentSession);
        if (sessionContextPresent && liveActorId !== actor.id) {
            apiLogger.warn(
                { hadSession: Boolean(currentSession), hadUser: Boolean(currentSessionUser) },
                'Aborting media delete: session no longer matches actor'
            );
            return createErrorResponse(
                {
                    code: 'SESSION_STALE',
                    message: 'Session expired or revoked. Please re-authenticate.'
                },
                ctx,
                401
            );
        }

        // ── 1. Validate query params ──────────────────────────────────────────
        const parseResult = DeleteMediaQuerySchema.safeParse(query ?? {});
        if (!parseResult.success) {
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

        // ── 1a. Validate environment prefix (defense-in-depth) ───────────────
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

        // ── 1b. Parse entity from publicId ───────────────────────────────────
        const parsed = parseEntityFromPublicId(publicId);
        if (!parsed) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message:
                        'publicId does not target a supported entity type (accommodations, destinations, events, posts)'
                },
                ctx,
                400
            );
        }

        // ── 1c. Reject unsupported entity types ──────────────────────────────
        if (!SUPPORTED_ENTITY_TYPES.has(parsed.entityType)) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: `Unsupported entity type: ${parsed.entityType}`
                },
                ctx,
                400
            );
        }

        // ── 1d. Fetch entity and verify ownership ────────────────────────────
        //
        // CRITICAL AUTHZ: parse entityType + entityId from publicId,
        // load entity via service, reject with 403 if ownerId !== actor.id.
        // Admin bypass: actors with ACCOMMODATION_UPDATE_ANY pass without
        // the ownerId check (same bypass used in upload-entity and admin delete).
        const service = resolveEntityService(parsed.entityType);
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

        const entity = entityResult.data as { ownerId?: string | null };

        // Ownership check: entity must belong to the authenticated user, OR
        // the actor holds an admin-level bypass permission.
        const hasAdminBypass = actor.permissions.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        if (!hasAdminBypass) {
            if (!entity.ownerId || entity.ownerId !== actor.id) {
                apiLogger.warn(
                    {
                        actorId: actor.id,
                        entityOwnerId: entity.ownerId,
                        entityType: parsed.entityType,
                        entityId: parsed.entityId
                    },
                    'Refusing media delete: actor does not own entity'
                );
                return createErrorResponse(
                    { code: 'FORBIDDEN', message: 'You do not own this entity' },
                    ctx,
                    403
                );
            }
        }

        // ── 2. Delete from Cloudinary ─────────────────────────────────────────
        let wasPresent: boolean;
        try {
            const deleteResult = await provider.delete({ publicId });
            wasPresent = deleteResult.wasPresent;
        } catch (deleteError) {
            apiLogger.error(
                {
                    error: deleteError instanceof Error ? deleteError.message : String(deleteError),
                    publicId,
                    actorId: actor.id,
                    entityType: parsed.entityType,
                    entityId: parsed.entityId
                },
                'Cloudinary delete failed (protected)'
            );
            return createErrorResponse(
                { code: 'UPSTREAM_ERROR', message: 'Media deletion failed' },
                ctx,
                502
            );
        }

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
            'protected media delete success'
        );

        return { deleted: true as const, publicId, wasPresent };
    }
});
