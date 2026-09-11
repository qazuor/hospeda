/**
 * Admin QR-code download endpoint (HOS-981 PR 3).
 *
 * ```
 * GET /api/v1/admin/qr-codes/{id}/download?format=SVG|PNG
 * ```
 *
 * ## What gets drawn
 *
 * The symbol encodes `{HOSPEDA_SITE_URL}/qr/{slug}/` — the platform's own
 * indirection — and NEVER `targetUrl`. Encoding the target would put the
 * destination in the ink and take the feature away: the code could no longer be
 * retargeted, which is the only reason the table exists.
 *
 * ## How it gets drawn
 *
 * Through {@link renderQr}, the one engine (`utils/qr-render.ts`), fed the code's
 * OWN stored `renderOptions`. There is no second renderer here and no local set
 * of defaults: a downloaded code that differs from what the panel previewed is a
 * code somebody prints and only discovers is wrong once it is on a wall.
 *
 * `format` is the single override the query accepts, because it is the one
 * choice that belongs to the download rather than to the code — the same
 * configured symbol as a vector for a print shop and as a raster for an email
 * client. Everything else comes from the row.
 *
 * ## Why the image travels as JSON
 *
 * Because the endpoint is AUTHENTICATED and the panel is served from a different
 * origin. An `image/svg+xml` body would be consumed with
 * `<img src=".../download">`, and a browser sends no credentials on that
 * request — the preview would render broken for every operator, every time. A
 * `data:` URL fetched by the app's own API client carries the session and works.
 * The secondary benefit is that the panel shows a preview NEXT TO a download
 * button, so one response serves both instead of fetching identical bytes twice.
 *
 * It is NOT an injection argument, and an earlier version of this comment
 * claimed it was. Nothing operator-typed reaches the markup: every
 * `renderOptions` field is bounded by a regex, an enum or an integer range, and
 * the only string encoded into the symbol is `/qr/{slug}/` with the slug
 * confined to the QR alphabet — `targetUrl` never appears in the SVG at all. A
 * comment that gives a false reason for a correct decision is an invitation to
 * revert the decision as soon as somebody checks the reason.
 *
 * @module routes/qr-code/admin/download
 */

import {
    PermissionEnum,
    QrCodeDownloadQuerySchema,
    QrCodeDownloadResponseSchema,
    QrCodeFormatEnum,
    QrCodeIdSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { buildQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { renderQr } from '../../../utils/qr-render';
import { createAdminRoute } from '../../../utils/route-factory';
import { qrCodeService } from './_singletons';

/** `data:` URL prefix for an inline SVG document. */
const SVG_DATA_URL_PREFIX = 'data:image/svg+xml;base64,';

/**
 * GET /api/v1/admin/qr-codes/{id}/download
 *
 * Renders one code with its stored options and returns it ready to embed or save.
 */
export const adminDownloadQrCodeRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/download',
    summary: 'Download a QR code image (admin)',
    description:
        'Renders the code with its own stored render options and returns the image as a data URL (plus raw SVG markup when the format is vector). `format` may override SVG/PNG for this one download; every other drawing option comes from the stored configuration.',
    tags: ['QrCodes'],
    requiredPermissions: [PermissionEnum.QR_CODE_VIEW],
    requestParams: { id: QrCodeIdSchema },
    requestQuery: QrCodeDownloadQuerySchema.shape,
    responseSchema: QrCodeDownloadResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await qrCodeService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const qrCode = result.data;
        if (!qrCode) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'QR code not found');
        }

        const format =
            (query?.format as QrCodeFormatEnum | undefined) ?? qrCode.renderOptions.format;

        // `utils/entity-qr` is the one place `/qr/{slug}/` is spelled in this
        // app. This endpoint used to carry its own copy of the builder, which
        // agreed with it — a second spelling never fails, it just starts
        // routing one family of printed codes to a 404 the day it drifts.
        const scanUrl = buildQrScanUrl({ qrSlug: qrCode.slug, siteUrl: env.HOSPEDA_SITE_URL });

        // The stored options, with only `format` overridden. Spreading the row
        // rather than rebuilding an option set is what keeps a download
        // byte-identical to the preview the operator approved.
        const rendered = await renderQr({
            data: scanUrl,
            options: { ...qrCode.renderOptions, format }
        });

        if (rendered.format === QrCodeFormatEnum.PNG) {
            return {
                format: QrCodeFormatEnum.PNG,
                filename: `qr-${qrCode.slug}.png`,
                scanUrl,
                dataUrl: rendered.dataUrl,
                svg: null
            };
        }

        return {
            format: QrCodeFormatEnum.SVG,
            filename: `qr-${qrCode.slug}.svg`,
            scanUrl,
            // Base64 rather than a percent-encoded `utf8` data URL: the markup
            // carries `#` in every colour, and an unescaped `#` truncates a
            // `data:` URL at the fragment — the download would save a file that
            // ends mid-attribute.
            dataUrl: `${SVG_DATA_URL_PREFIX}${Buffer.from(rendered.svg, 'utf-8').toString('base64')}`,
            svg: rendered.svg
        };
    },
    options: { customRateLimit: { requests: 60, windowMs: 60_000 } }
});
