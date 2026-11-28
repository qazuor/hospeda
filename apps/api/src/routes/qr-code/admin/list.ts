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
 * HOS-2679 added `utmCampaign` (exact match on the stored target's parsed
 * param) and `tagIds` (any of), and each row now carries `tags`, `scanUrl` and
 * `scanUtm` — see `QrCodeAdminListItemSchema` and {@link toQrCodeAdminListItem}.
 *
 * @module routes/qr-code/admin/list
 */

import { readUtmParams } from '@repo/analytics';
import {
    PermissionEnum,
    type QrCode,
    type QrCodeAdminListItem,
    QrCodeAdminListItemSchema,
    QrCodeAdminSearchSchema,
    type QrCodeTagRef
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { buildQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { buildQrRedirectTarget } from '../../../utils/qr-attribution';
import { createAdminListRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/**
 * Decorates one code for the admin table (HOS-2679).
 *
 * `scanUrl` comes from the same `buildQrScanUrl` the download endpoint encodes,
 * and `scanUtm` from the same `buildQrRedirectTarget` the public redirect
 * answers with — so what the panel shows is what the printed symbol encodes and
 * what a scanner lands with, never a second copy of either rule.
 *
 * @param input.code - The code, with the tags the service attached.
 * @param input.siteUrl - `HOSPEDA_SITE_URL`.
 * @returns The list row.
 */
export function toQrCodeAdminListItem(input: {
    readonly code: QrCode & { readonly tags?: readonly QrCodeTagRef[] };
    readonly siteUrl: string;
}): QrCodeAdminListItem {
    const { code, siteUrl } = input;
    const landing = buildQrRedirectTarget({
        targetUrl: code.targetUrl,
        entityType: code.entityType,
        purpose: code.purpose,
        siteUrl
    });
    return {
        ...code,
        tags: [...(code.tags ?? [])],
        scanUrl: buildQrScanUrl({ qrSlug: code.slug, siteUrl }),
        scanUtm: readUtmParams({ url: landing })
    };
}

/**
 * GET /api/v1/admin/qr-codes
 *
 * Paginated list of every QR code, filterable by source, entity, purpose, active
 * flag, stored `utm_campaign` and tags.
 */
export const adminListQrCodesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List QR codes (admin)',
    description:
        'Returns a paginated list of redirectable QR codes. Supports free-text search over label, slug and target URL, plus filters by source, entity reference, purpose, active status, the stored UTM campaign (exact) and tags (any of). Each row carries its tags, the URL the symbol encodes and the UTMs a scan lands with.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    requestQuery: QrCodeAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: QrCodeAdminListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await qrCodeService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        return {
            items: (result.data?.items ?? []).map((code) =>
                toQrCodeAdminListItem({ code, siteUrl: env.HOSPEDA_SITE_URL })
            ),
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
