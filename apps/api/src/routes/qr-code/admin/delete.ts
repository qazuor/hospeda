/**
 * Admin QR-code delete endpoint (HOS-981 PR 3).
 *
 * ```
 * DELETE /api/v1/admin/qr-codes/{id}
 * ```
 *
 * SOFT delete, and there is no hard-delete sibling on purpose. Two independent
 * reasons: `qr_code_scans` rows point at this id and are the only record that
 * the code was ever used, and `qr_codes.slug` is UNIQUE over the whole table
 * INCLUDING deleted rows precisely so a printed slug can never be reissued to a
 * different target. Removing the row would free the slug and orphan the scans in
 * one gesture.
 *
 * Retiring a code that is still in circulation is what `isActive = false` is
 * for; this endpoint is for one that should stop existing in the panel.
 *
 * @module routes/qr-code/admin/delete
 */

import { PermissionEnum, QrCodeDeleteResponseSchema, QrCodeIdSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/**
 * DELETE /api/v1/admin/qr-codes/{id}
 *
 * Soft-deletes a QR code. The slug stays reserved and the scans stay attached.
 */
export const adminDeleteQrCodeRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete a QR code (admin)',
    description:
        'Soft-deletes a QR code. The slug remains reserved forever — it may already be printed — and recorded scans are preserved. The code stops resolving immediately.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_DELETE],
    requestParams: { id: QrCodeIdSchema },
    responseSchema: QrCodeDeleteResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await qrCodeService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // `count` is how many rows the soft delete actually touched. Reporting
        // `success: true` for a zero-row delete would tell the panel a code it
        // never found is now gone.
        return { success: (result.data?.count ?? 0) > 0 };
    }
});
