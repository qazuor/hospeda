/**
 * The tag set of one QR code (HOS-2679).
 *
 * ```
 * GET /api/v1/admin/qr-codes/{id}/tags
 * PUT /api/v1/admin/qr-codes/{id}/tags   { tagIds: string[] }
 * ```
 *
 * PUT replaces the COMPLETE set, so a double submit is harmless and the form and
 * the table row write through the same call. Kept off the QR update body on
 * purpose: `QrCodeUpdateHttpSchema` is strict and its accepted keys are frozen
 * by a guard test, and a tag set is a relation, not a column.
 *
 * Order of refusals: 403 (route permission) → 400 (body shape) → 404 (missing or
 * deleted code) → 400 `UNKNOWN_TAG` (an id that is not a live tag).
 *
 * @module routes/qr-code/admin/tags
 */

import {
    PermissionEnum,
    QrCodeIdSchema,
    QrCodeSetTagsInputSchema,
    QrCodeTagsResponseSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeTagService } from './_singletons';

/** GET /api/v1/admin/qr-codes/{id}/tags */
export const adminGetQrCodeTagsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/tags',
    summary: 'Get the tags of a QR code (admin)',
    description: 'Returns the live tags a QR code carries, by name.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    requestParams: { id: QrCodeIdSchema },
    responseSchema: QrCodeTagsResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await qrCodeTagService.getTagsForCode({
            actor,
            qrCodeId: params.id as string
        });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        return result.data;
    }
});

/** PUT /api/v1/admin/qr-codes/{id}/tags */
export const adminSetQrCodeTagsRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/tags',
    summary: 'Replace the tags of a QR code (admin)',
    description:
        'Replaces the complete tag set of a QR code; an empty list clears it. An id that is not a live tag answers 400 with reason UNKNOWN_TAG.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_UPDATE],
    requestParams: { id: QrCodeIdSchema },
    requestBody: QrCodeSetTagsInputSchema,
    responseSchema: QrCodeTagsResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await qrCodeTagService.setTagsForCode({
            actor,
            qrCodeId: params.id as string,
            tagIds: (body.tagIds as string[] | undefined) ?? []
        });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        return result.data;
    }
});
