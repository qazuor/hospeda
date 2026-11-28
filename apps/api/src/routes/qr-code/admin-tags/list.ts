/**
 * GET /api/v1/admin/qr-code-tags — the QR tag catalog (HOS-2679).
 *
 * Live tags by name, `page` + `pageSize` (max 100). The panel loads one page of
 * 100 into its pickers: the catalog is organisation for one team, not content.
 *
 * @module routes/qr-code/admin-tags/list
 */

import { PermissionEnum, QrCodeTagAdminSearchSchema, QrCodeTagSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';
import { qrCodeTagService } from '../admin/_singletons';

/** GET /api/v1/admin/qr-code-tags */
export const adminListQrCodeTagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List QR code tags (admin)',
    description: 'Returns the QR code tag catalog, paginated. `search` matches the tag name.',
    tags: ['QrCodeTags'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    requestQuery: QrCodeTagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: QrCodeTagSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await qrCodeTagService.adminList(actor, {
            sort: 'name:asc',
            ...(query || {})
        });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
