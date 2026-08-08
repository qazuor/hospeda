/**
 * @file avif-mime-image-service.ts
 * @description Astro image service that fixes the `Content-Type` served for
 * AVIF (HOS-369).
 *
 * THE BUG (upstream, Astro 7.1.6)
 * `/_image/?...&f=avif` responds with `Content-Type: image/heif` instead of
 * `image/avif`. The chain:
 *
 *   1. `astro/dist/assets/services/sharp.js` ends `transform()` with
 *      `format: info.format`, i.e. whatever sharp reports about the buffer it
 *      produced. Sharp calls AVIF output `'heif'`, because AVIF is a profile of
 *      the HEIF container — technically defensible, but it is not the media
 *      type the file should be served as.
 *   2. `astro/dist/assets/endpoint/generic.js` then does
 *      `mime.lookup(format) ?? \`image/${format}\``. `mrmime` maps `avif` to
 *      `image/avif` correctly; it just never sees `avif`, it sees `heif`.
 *
 * Astro's own docs are explicit that this field is the one that decides the
 * header: "You must return a `format` to ensure that the proper MIME type is
 * served to users for on-demand rendering and development mode."
 * (https://docs.astro.build/en/reference/image-service-reference/#hooks)
 *
 * THE FIX
 * A decorator around the built-in sharp service. Every hook is passed through
 * untouched; `transform()` is wrapped to correct that ONE field, and only when
 * the caller actually asked for AVIF — so a genuine HEIF/HEIC passthrough is
 * never relabelled. No encoding behaviour changes.
 *
 * WHY IT MATTERS (and why it is small)
 * `<picture>` selects sources by the `type` ATTRIBUTE, not by the response
 * header, and browsers sniff the bytes anyway — so nothing was visibly broken.
 * What a wrong media type does affect is anything downstream that trusts the
 * header instead of the bytes: CDN/proxy content negotiation, `Vary` handling,
 * asset pipelines, and monitoring that buckets responses by type.
 *
 * NOTE ON THE DEFAULT EXPORT
 * The repo rule is named exports only. Astro's image service contract requires
 * the service object to be the module's DEFAULT export (`InvalidImageService`
 * is raised otherwise), so this file is a framework-mandated exception. The
 * testable logic lives in the named {@link resolveOutputFormat} below.
 */

import type { LocalImageService } from 'astro';
import sharpService from 'astro/assets/services/sharp';

/** What sharp reports for AVIF output, because AVIF rides in a HEIF container. */
const SHARP_AVIF_FORMAT = 'heif';

/**
 * Decide the `format` to report for a completed transform.
 *
 * Narrow on purpose: it only rewrites `heif` → `avif`, and only when AVIF was
 * what the caller requested. Any other combination — including a real HEIF
 * source passed through, or a fallback where sharp bailed and returned the
 * input buffer in its original format — is returned untouched.
 *
 * @param params.requestedFormat - The `format` the caller asked for (`f=` in the
 *   endpoint URL), or `undefined` when the source format was kept.
 * @param params.reportedFormat - The format the underlying service reported.
 * @returns The format to report, which is what drives the `Content-Type`.
 */
export function resolveOutputFormat({
    requestedFormat,
    reportedFormat
}: {
    readonly requestedFormat: string | undefined;
    readonly reportedFormat: string;
}): string {
    if (requestedFormat === 'avif' && reportedFormat === SHARP_AVIF_FORMAT) {
        return 'avif';
    }
    return reportedFormat;
}

const service: LocalImageService = {
    ...sharpService,
    async transform(inputBuffer, transformOptions, imageConfig) {
        const result = await sharpService.transform(inputBuffer, transformOptions, imageConfig);
        return {
            ...result,
            format: resolveOutputFormat({
                requestedFormat: (transformOptions as { format?: string }).format,
                reportedFormat: result.format
            }) as typeof result.format
        };
    }
};

export default service;
