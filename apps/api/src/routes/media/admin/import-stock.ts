import { accommodationMediaModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, getGalleryCap } from '@repo/schemas';
import {
    AccommodationService,
    DestinationService,
    EventService,
    ImageImportService,
    PostService,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getMediaProvider } from '../../../services/media';
import { buildEntityFolder } from '../../../services/media/upload-helpers';
import { getActorFromContext } from '../../../utils/actor';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { type MediaEntityType, validateEntityMediaPermission } from './permissions';

const ImportStockBodySchema = z.object({
    provider: z.enum(['unsplash', 'pexels']),
    providerId: z.string().min(1),
    fullUrl: z.string().url(),
    downloadLocation: z.string().url().optional(),
    photographer: z.string().min(1),
    photographerUrl: z.string().url(),
    entityType: z.enum([
        'accommodation',
        'destination',
        'event',
        'post',
        'gastronomy',
        'experience'
    ]),
    entityId: z.string().uuid(),
    role: z.enum(['featured', 'gallery'])
});

const ImportStockResponseSchema = z.object({
    url: z.string().url(),
    publicId: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    attribution: z.object({
        photographer: z.string().min(1),
        sourceUrl: z.string().url(),
        license: z.string().min(1),
        provider: z.enum(['unsplash', 'pexels'])
    }),
    moderationState: z.literal('APPROVED')
});

const resolveEntityService = (entityType: string) => {
    switch (entityType) {
        case 'accommodation':
            return new AccommodationService({});
        case 'destination':
            return new DestinationService({});
        case 'event':
            return new EventService({});
        case 'post':
            return new PostService({});
        default:
            return null;
    }
};

export const adminImportStockMediaRoute = createAdminRoute({
    method: 'post',
    path: '/import-stock',
    summary: 'Import stock image',
    description:
        'Downloads a selected Unsplash or Pexels image server-side, uploads it to Cloudinary, and returns persisted attribution metadata.',
    tags: ['Media'],
    requiredPermissions: [PermissionEnum.MEDIA_UPLOAD],
    requestBody: ImportStockBodySchema,
    responseSchema: ImportStockResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const provider = getMediaProvider();
        if (!provider) {
            return createErrorResponse(
                {
                    code: 'CLOUDINARY_NOT_CONFIGURED',
                    message: 'Media upload service is not configured'
                },
                ctx,
                503
            );
        }

        const parsedBody = ImportStockBodySchema.parse(body);
        const actor = getActorFromContext(ctx);

        const service = resolveEntityService(parsedBody.entityType);
        if (!service) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: `Unsupported entity type: ${parsedBody.entityType}`
                },
                ctx,
                400
            );
        }

        const entityResult = await service.getById(actor, parsedBody.entityId);
        if (entityResult.error || !entityResult.data) {
            return createErrorResponse(
                {
                    code: 'ENTITY_NOT_FOUND',
                    message: `Entity not found: ${parsedBody.entityType} with id ${parsedBody.entityId}`,
                    details: {
                        entityType: parsedBody.entityType,
                        entityId: parsedBody.entityId
                    }
                },
                ctx,
                404
            );
        }

        const permissionCheck = validateEntityMediaPermission({
            actor,
            entityType: parsedBody.entityType as MediaEntityType,
            entity: entityResult.data as { ownerId?: string | null } | null
        });

        if (!permissionCheck.allowed) {
            return createErrorResponse(
                {
                    code: 'FORBIDDEN',
                    message:
                        permissionCheck.reason === 'NOT_ENTITY_OWNER'
                            ? 'You do not own this entity'
                            : 'Insufficient permissions to modify entity media'
                },
                ctx,
                403
            );
        }

        if (parsedBody.role === 'gallery') {
            let currentGalleryCount: number;
            if (parsedBody.entityType === 'accommodation') {
                const { total } = await accommodationMediaModel.findByAccommodation({
                    accommodationId: parsedBody.entityId,
                    state: 'visible'
                });
                currentGalleryCount = total;
            } else {
                const entityMedia = (entityResult.data as { media?: { gallery?: unknown[] } })
                    .media;
                currentGalleryCount = entityMedia?.gallery?.length ?? 0;
            }

            const galleryLimit = getGalleryCap(parsedBody.entityType);
            if (currentGalleryCount >= galleryLimit) {
                return createErrorResponse(
                    {
                        code: 'GALLERY_LIMIT_EXCEEDED',
                        message: `Gallery limit of ${galleryLimit} items reached for this entity`,
                        details: {
                            entityType: parsedBody.entityType,
                            entityId: parsedBody.entityId,
                            currentCount: currentGalleryCount,
                            limit: galleryLimit
                        }
                    },
                    ctx,
                    422
                );
            }
        }

        try {
            const importService = new ImageImportService({ mediaProvider: provider });
            const result = await importService.import({
                provider: parsedBody.provider,
                providerId: parsedBody.providerId,
                fullUrl: parsedBody.fullUrl,
                downloadLocation: parsedBody.downloadLocation,
                photographer: parsedBody.photographer,
                photographerUrl: parsedBody.photographerUrl,
                folder: buildEntityFolder(parsedBody.entityType, parsedBody.entityId)
            });

            return {
                ...result,
                moderationState: 'APPROVED' as const
            };
        } catch (error) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                error instanceof Error ? error.message : 'Stock image import failed'
            );
        }
    },
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: 10,
                keyPrefix: 'media:stock-import'
            })
        ]
    }
});
