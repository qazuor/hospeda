/**
 * PATCH /api/v1/protected/experiences/:id/media/:mediaId
 * Correct the text metadata of a experience gallery photo (HOS-1036).
 *
 * The experience twin of `accommodation/protected/updateMedia.ts` (HOS-388). Until this
 * route existed there was no way at all to write a photo's `alt` or `caption`
 * for a experience: the editor never offered the fields, and the only "fix" was to
 * delete the photo and re-upload it — burning a second Cloudinary asset and
 * losing the photo's gallery position. A photo with no alt text is a photo a
 * screen reader cannot describe and a search engine cannot read.
 *
 * Pure TEXT metadata: `caption`, `description`, `alt`, `attribution`. It can
 * never touch `url`, `publicId`, `moderationState`, `state`, `isFeatured`,
 * `sortOrder` or `experienceId` — those columns are not reachable from
 * `ExperienceMediaUpdatePayloadSchema` even if the client sends them (Zod strips
 * unknown keys on a plain object schema).
 *
 * All four fields are nullable: omit a field to leave it untouched, send `null`
 * to clear it, send a value to replace it. At least one field must be present —
 * an empty body is rejected as `VALIDATION_ERROR`, not a silent 200.
 *
 * A media row belonging to another experience, a non-existent id, or a soft-deleted
 * row all answer `NOT_FOUND` (404) — never `FORBIDDEN` (403), so a foreign id
 * cannot be confirmed to exist (see `apps/api/docs/error-contract.md`).
 */
import {
    ExperienceMediaSingleOutputSchema,
    type ExperienceMediaUpdatePayload,
    ExperienceMediaUpdatePayloadSchema
} from '@repo/schemas';
import { ExperienceService, ServiceError, updateExperienceMedia } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — corrects a photo's text metadata on a experience.
 *
 * Permission model: the service helper `updateExperienceMedia` gates on `checkExperienceCanEditMedia` — listing owner or staff — exactly like `setFeaturedExperienceMedia`.
 */
export const protectedUpdateExperienceMediaRoute = createCRUDRoute({
    method: 'patch',
    path: '/{id}/media/{mediaId}',
    summary: 'Correct photo text metadata in experience gallery',
    description:
        'Patch caption/description/alt/attribution on an existing media row. ' +
        'Each field is nullable: omit to leave unchanged, null to clear, a value ' +
        'to replace. At least one field must be present — an empty body is a ' +
        'VALIDATION_ERROR, not a silent 200. Requires EXPERIENCE_EDIT_OWN (listing owner) or EXPERIENCE_EDIT_ALL (staff); the legacy COMMERCE_ equivalents are still accepted until HOS-1077 release 2.',
    tags: ['Experience', 'Experience Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        mediaId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceMediaUpdatePayloadSchema,
    responseSchema: ExperienceMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const payload = body as ExperienceMediaUpdatePayload;

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        // (mirrors the sibling media routes).
        const model = (
            experienceService as unknown as {
                model: Parameters<typeof updateExperienceMedia>[0];
            }
        ).model;
        const result = await updateExperienceMedia(model, actor, {
            experienceId: params.id as string,
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
