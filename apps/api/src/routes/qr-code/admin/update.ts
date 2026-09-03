/**
 * Admin QR-code update endpoint (HOS-981 PR 3).
 *
 * ```
 * PATCH /api/v1/admin/qr-codes/{id}
 * ```
 *
 * ## This endpoint is the feature
 *
 * Changing `targetUrl` is the entire reason redirectable QR codes exist. The
 * printed symbol encodes `/qr/{slug}/` and nothing else, so retargeting a code
 * is a row update here and no reprint anywhere. Everything else on this route —
 * the label, the description, the render options, the active flag — is
 * housekeeping around that one field.
 *
 * ## `slug` is not in the request body, by construction
 *
 * `QrCodeUpdateHttpSchema` is built by omitting `slug` and is `.strict()`, so a
 * body carrying one is refused rather than ignored. That is deliberate and must
 * stay: the slug is the half already printed on a sticker, and renaming it turns
 * every code in the field into a dead link with no way to notice.
 *
 * ## `renderOptions` is a partial patch, merged into the stored document
 *
 * Sending `{renderOptions: {margin: 8}}` changes the margin and leaves the
 * colours alone. That takes two cooperating pieces — a `.partial()` sub-schema
 * so the patch is not silently completed with defaults, and
 * `QrCodeModel.mergeableJsonbColumns` so the write is a `||` merge rather than a
 * replacement. See the notes on both.
 *
 * @module routes/qr-code/admin/update
 */

import {
    PermissionEnum,
    QrCodeAdminSchema,
    QrCodeIdSchema,
    QrCodeUpdateHttpSchema,
    type QrCodeUpdateInput,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/**
 * PATCH /api/v1/admin/qr-codes/{id}
 *
 * Partially updates a QR code. Only the fields present in the body are touched.
 */
export const adminUpdateQrCodeRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update a QR code (admin)',
    description:
        'Updates a redirectable QR code. Retargeting `targetUrl` is the point of the entity: the printed slug never changes and is refused in the body. `renderOptions` is merged key by key, so sending one drawing option leaves the others as they were.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_UPDATE],
    requestParams: { id: QrCodeIdSchema },
    requestBody: QrCodeUpdateHttpSchema,
    responseSchema: QrCodeAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: the route factory hands the handler an untyped
        // `Record<string, unknown>`; the body was already validated against
        // `QrCodeUpdateHttpSchema` by the factory, and the service re-validates
        // it against the domain update schema — which is what refuses a slug.
        const result = await qrCodeService.update(
            actor,
            params.id as string,
            // TYPE-WORKAROUND: untyped factory body, already validated against
            // the HTTP update schema and re-validated by the service.
            body as unknown as QrCodeUpdateInput
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'QR code not found');
        }

        return result.data;
    }
});
