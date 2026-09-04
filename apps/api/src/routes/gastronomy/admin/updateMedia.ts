/**
 * PATCH /api/v1/admin/gastronomies/:id/media/:mediaId
 * Correct the text metadata of a gastronomy gallery photo (HOS-1036).
 *
 * The gastronomy twin of `accommodation/admin/updateMedia.ts` (HOS-388). Until this
 * route existed there was no way at all to write a photo's `alt` or `caption`
 * for a gastronomy: the editor never offered the fields, and the only "fix" was to
 * delete the photo and re-upload it — burning a second Cloudinary asset and
 * losing the photo's gallery position. A photo with no alt text is a photo a
 * screen reader cannot describe and a search engine cannot read.
 *
 * Pure TEXT metadata: `caption`, `description`, `alt`, `attribution`. It can
 * never touch `url`, `publicId`, `moderationState`, `state`, `isFeatured`,
 * `sortOrder` or `gastronomyId` — those columns are not reachable from
 * `GastronomyMediaUpdatePayloadSchema` even if the client sends them (Zod strips
 * unknown keys on a plain object schema).
 *
 * All four fields are nullable: omit a field to leave it untouched, send `null`
 * to clear it, send a value to replace it. At least one field must be present —
 * an empty body is rejected as `VALIDATION_ERROR`, not a silent 200.
 *
 * A media row belonging to another gastronomy, a non-existent id, or a soft-deleted
 * row all answer `NOT_FOUND` (404) — never `FORBIDDEN` (403), so a foreign id
 * cannot be confirmed to exist (see `apps/api/docs/error-contract.md`).
 */
import {
    GastronomyMediaSingleOutputSchema,
    type GastronomyMediaUpdatePayload,
    GastronomyMediaUpdatePayloadSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError, updateGastronomyMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — corrects a photo's text metadata on a gastronomy.
 *
 * Permission model: gated on `GASTRONOMY_EDIT_ALL` (or the legacy `COMMERCE_EDIT_ALL`), the same pair the sibling admin media routes declare.
 */
export const adminUpdateGastronomyMediaRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}/media/{mediaId}',
    summary: 'Correct photo text metadata in gastronomy gallery (admin)',
    description:
        'Patch caption/description/alt/attribution on an existing media row. ' +
        'Each field is nullable: omit to leave unchanged, null to clear, a value ' +
        'to replace. At least one field must be present — an empty body is a ' +
        'VALIDATION_ERROR, not a silent 200. Requires GASTRONOMY_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL).',
    tags: ['Gastronomy', 'Media'],
    anyOfPermissions: [[PermissionEnum.GASTRONOMY_EDIT_ALL, PermissionEnum.COMMERCE_EDIT_ALL]],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyMediaUpdatePayloadSchema,
    responseSchema: GastronomyMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const payload = body as GastronomyMediaUpdatePayload;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        // (mirrors the sibling media routes).
        const model = (
            gastronomyService as unknown as {
                model: Parameters<typeof updateGastronomyMedia>[0];
            }
        ).model;
        const result = await updateGastronomyMedia(model, actor, {
            gastronomyId: params.id as string,
            mediaId: params.mediaId as string,
            caption: payload.caption,
            description: payload.description,
            alt: payload.alt,
            attribution: payload.attribution
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
