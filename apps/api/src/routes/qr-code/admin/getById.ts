/**
 * Admin QR-code detail endpoint (HOS-981 PR 3).
 *
 * ```
 * GET /api/v1/admin/qr-codes/{id}
 * ```
 *
 * @module routes/qr-code/admin/getById
 */

import { PermissionEnum, QrCodeAdminSchema, QrCodeIdSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/**
 * GET /api/v1/admin/qr-codes/{id}
 *
 * Returns one QR code with every field, audit columns included.
 *
 * A missing id answers 404, not a 200 carrying `null`. `getById` resolves an
 * absent row as `data: null` with no error, so the check below is what turns
 * "there is no such code" into the status the error contract asks for; without
 * it the panel would render an empty detail page for a deleted code and report
 * nothing wrong.
 */
export const adminGetQrCodeByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a QR code by id (admin)',
    description: 'Returns a single redirectable QR code with its full admin detail.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.SETTINGS_MANAGE],
    requestParams: { id: QrCodeIdSchema },
    responseSchema: QrCodeAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await qrCodeService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'QR code not found');
        }

        return result.data;
    }
});
