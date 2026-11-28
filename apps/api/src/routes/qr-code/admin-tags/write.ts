/**
 * Writes on the QR tag catalog (HOS-2679).
 *
 * ```
 * POST   /api/v1/admin/qr-code-tags          { name, color? }
 * PATCH  /api/v1/admin/qr-code-tags/{id}     { name?, color? }
 * DELETE /api/v1/admin/qr-code-tags/{id}
 * ```
 *
 * Gated on the QR-code verbs (create / update / delete): a tag is how a QR
 * operator organises their own list. The slug is derived from the name by the
 * service; a name that slugs onto another live tag answers 409 `ALREADY_EXISTS`.
 * Delete is soft and frees the slug.
 *
 * @module routes/qr-code/admin-tags/write
 */

import {
    PermissionEnum,
    QrCodeDeleteResponseSchema,
    type QrCodeTagCreateInput,
    QrCodeTagCreateInputSchema,
    QrCodeTagIdSchema,
    QrCodeTagSchema,
    type QrCodeTagUpdateInput,
    QrCodeTagUpdateInputSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeTagService } from '../admin/_singletons';

/** POST /api/v1/admin/qr-code-tags */
export const adminCreateQrCodeTagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create QR code tag (admin)',
    description:
        'Creates a QR code tag. The slug is derived from the name; a name that collides with a live tag answers 409.',
    tags: ['QrCodeTags'],
    requiredPermissions: [PermissionEnum.QR_CODE_CREATE],
    requestBody: QrCodeTagCreateInputSchema,
    responseSchema: QrCodeTagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await qrCodeTagService.create(actor, body as QrCodeTagCreateInput);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        return result.data;
    }
});

/** PATCH /api/v1/admin/qr-code-tags/{id} */
export const adminPatchQrCodeTagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Rename or recolour QR code tag (admin)',
    description:
        'Updates a QR code tag. A rename re-derives the slug and every code carrying the tag shows the new name.',
    tags: ['QrCodeTags'],
    requiredPermissions: [PermissionEnum.QR_CODE_UPDATE],
    requestParams: { id: QrCodeTagIdSchema },
    requestBody: QrCodeTagUpdateInputSchema,
    responseSchema: QrCodeTagSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await qrCodeTagService.update(
            actor,
            params.id as string,
            body as QrCodeTagUpdateInput
        );
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        return result.data;
    }
});

/** DELETE /api/v1/admin/qr-code-tags/{id} */
export const adminDeleteQrCodeTagRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete QR code tag (admin)',
    description:
        'Soft-deletes a QR code tag. Codes that carried it simply stop showing it; the slug becomes free again.',
    tags: ['QrCodeTags'],
    requiredPermissions: [PermissionEnum.QR_CODE_DELETE],
    requestParams: { id: QrCodeTagIdSchema },
    responseSchema: QrCodeDeleteResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await qrCodeTagService.softDelete(actor, params.id as string);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        // `success` reflects the row count, as the QR delete does: a delete that
        // matched nothing (somebody else got there first) must not read as done.
        return { success: (result.data?.count ?? 0) > 0 };
    }
});
