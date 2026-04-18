/**
 * Admin media delete endpoint.
 *
 * DELETE /api/v1/admin/media?publicId=hospeda/prod/accommodations/...
 *
 * Deletes a Cloudinary asset by its publicId.
 * The publicId must start with "hospeda/" to prevent accidental deletion of
 * assets outside the project namespace.
 */
import { DeleteMediaQuerySchema, DeleteMediaResponseSchema, PermissionEnum } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { type MediaEntityType, validateEntityMediaPermission } from './permissions';

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
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid query parameters',
                        details: parseResult.error.issues.map((issue) => ({
                            field: issue.path.join('.'),
                            message: issue.message
                        }))
                    }
                },
                400
            );
        }

        const { publicId } = parseResult.data;

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
