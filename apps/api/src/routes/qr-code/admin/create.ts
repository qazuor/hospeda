/**
 * Admin QR-code create endpoint (HOS-981 PR 3).
 *
 * ```
 * POST /api/v1/admin/qr-codes
 * ```
 *
 * `slug` is optional on the way in: omit it and the service mints one with
 * `generateShortId`, retrying on the (astronomically unlikely) collision.
 * Supplying one is how an operator reserves a memorable code, and how a code
 * that is already printed on paper gets re-created in the database.
 *
 * @module routes/qr-code/admin/create
 */

import {
    PermissionEnum,
    QrCodeAdminSchema,
    QrCodeCreateHttpSchema,
    type QrCodeCreateInput,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/**
 * POST /api/v1/admin/qr-codes
 *
 * Creates a QR code. `source` and the entity reference must agree — a
 * `GENERATED` code names its entity, a `MANUAL` one must not — and the service's
 * create schema refuses the combination before anything reaches the database.
 */
export const adminCreateQrCodeRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create a QR code (admin)',
    description:
        'Creates a redirectable QR code. Omit `slug` to have one minted. A GENERATED code must name its entity; a MANUAL one must not.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_CREATE],
    requestBody: QrCodeCreateHttpSchema,
    responseSchema: QrCodeAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: the route factory hands the handler an untyped
        // `Record<string, unknown>`; the body was already validated against
        // `QrCodeCreateHttpSchema` by the factory, and the service re-validates
        // it against the domain create schema before anything is written.
        const result = await qrCodeService.create(actor, body as unknown as QrCodeCreateInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'QR code was not created');
        }

        return result.data;
    }
});
