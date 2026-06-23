/**
 * Admin partial update social platform format endpoint.
 * When enabled is set to false, the response includes a warnings array
 * with the count of active post targets that still reference this format.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialPlatformFormatSchema,
    SocialPlatformFormatUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialPlatformFormatService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const platformFormatService = new SocialPlatformFormatService({ logger: apiLogger });

/**
 * Response schema for platform-format patch.
 * Extends the base entity schema with an optional warnings array.
 */
const PlatformFormatPatchResponseSchema = SocialPlatformFormatSchema.extend({
    warnings: z
        .array(z.object({ message: z.string() }))
        .optional()
        .describe('Non-fatal warnings — present when the update may affect active targets')
});

/**
 * PATCH /api/v1/admin/social/platform-formats/:id
 * Partial update social platform format — Admin endpoint.
 * Updatable fields: enabled, mvpEnabled, maxCaptionLength, makeChannelKey,
 * notes, recommendedRatio, recommendedSize.
 * When enabled is set to false, the response warnings array contains the count
 * of active post targets that still reference this format.
 */
export const adminPatchSocialPlatformFormatRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social platform format (admin)',
    description:
        'Updates config fields of a platform-format row. ' +
        'When enabled is set to false, a warnings array is included in the response ' +
        'indicating how many active post targets still reference this format.',
    tags: ['Social Platform Formats'],
    requiredPermissions: [PermissionEnum.SOCIAL_PLATFORM_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialPlatformFormatUpdateSchema,
    responseSchema: PlatformFormatPatchResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await platformFormatService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const updated = result.data;

        // When the update disables the format, warn about active targets that still
        // reference it. The update succeeds regardless — this is a non-fatal advisory.
        const isDisabling = body.enabled === false;
        if (!isDisabling) {
            return updated;
        }

        const activeCount = await platformFormatService.countActiveTargetsForFormat(id);
        if (activeCount === 0) {
            return updated;
        }

        return {
            ...updated,
            warnings: [
                {
                    message: `${activeCount} active target${activeCount === 1 ? '' : 's'} reference this format`
                }
            ]
        };
    }
});
