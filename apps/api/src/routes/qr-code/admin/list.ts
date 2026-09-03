/**
 * Admin QR-code list endpoint (HOS-981 PR 3).
 *
 * ```
 * GET /api/v1/admin/qr-codes
 * ```
 *
 * Pagination is `page` + `pageSize`, never `limit`: `createAdminListRoute`
 * rejects any query parameter it does not know, so a `limit` would come back a
 * 400 rather than being quietly ignored.
 *
 * Free-text `search` matches `label`, `slug` and `targetUrl` — the override in
 * `QrCodeService.getSearchableColumns()`. That override is what makes this
 * endpoint filter at all: the base default names a `name` column `qr_codes` does
 * not have, and an unknown column is dropped SILENTLY, which would answer every
 * search with the whole table.
 *
 * @module routes/qr-code/admin/list
 */

import { PermissionEnum, QrCodeAdminSchema, QrCodeAdminSearchSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/**
 * GET /api/v1/admin/qr-codes
 *
 * Paginated list of every QR code, filterable by source, entity and active flag.
 */
export const adminListQrCodesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List QR codes (admin)',
    description:
        'Returns a paginated list of redirectable QR codes. Supports free-text search over label, slug and target URL, plus filters by source, entity reference and active status.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    requestQuery: QrCodeAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: QrCodeAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await qrCodeService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
