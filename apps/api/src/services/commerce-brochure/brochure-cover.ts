/**
 * Fetches a listing's cover photo for embedding in its brochure (HOS-1058).
 *
 * ---
 * BEST-EFFORT, ON PURPOSE
 *
 * Every failure here returns `null` and the brochure prints without a photo. A
 * timeout, a 404, a WebP, a progressive JPEG, an oversized file — none of them
 * may cost the owner the document. The photo is the best part of a printed
 * folleto and still not worth a 500.
 *
 * ## Why the URL is transformed rather than used as stored
 *
 * `DCTDecode` embeds JPEG bytes verbatim, so the file we fetch has to BE a
 * baseline JPEG — and what a listing stores is whatever the owner uploaded:
 * PNG, WebP, HEIC, a 12MP original. Routing the URL through
 * {@link getMediaUrl} with an explicit `f_jpg` asks the CDN for the one format
 * this writer can embed, at a width sized for print rather than for the
 * original camera. It also caps what an unbounded fetch could pull into memory
 * long before {@link MAX_COVER_BYTES} has to.
 *
 * A non-Cloudinary URL passes through untouched and is simply fetched; if it
 * turns out not to be an embeddable JPEG, {@link readJpeg} says so and the
 * brochure goes out without it.
 *
 * @module services/commerce-brochure/brochure-cover
 */

import { getMediaUrl } from '@repo/media';
import { apiLogger } from '../../utils/logger.js';
import { readJpeg } from '../../utils/pdf/jpeg.js';
import type { PdfJpeg } from '../../utils/pdf/pdf-document.js';

/**
 * Cloudinary transform requested for the cover.
 *
 * `w_1200,c_limit` never upscales; 1200px across a ~500pt column is ~170dpi,
 * which is past what an office printer resolves.
 */
const COVER_TRANSFORM = 'f_jpg,q_auto:good,w_1200,c_limit';

/** Hard ceiling on the fetched image. A brochure is not a photo album. */
const MAX_COVER_BYTES = 3_000_000;

/**
 * Fetch budget. Short: the owner is waiting on a download, and the page is
 * strictly better late-without-photo than slow.
 */
const FETCH_TIMEOUT_MS = 4_000;

/**
 * Fetches and validates the cover photo.
 *
 * @param input.url - The image URL from the listing's PUBLIC media payload.
 * @returns An embeddable JPEG, or `null` for every failure mode.
 */
export async function loadBrochureCover(input: { url: string | null }): Promise<PdfJpeg | null> {
    const source = input.url;
    if (!source) {
        return null;
    }

    let requestUrl: string;
    try {
        requestUrl = getMediaUrl(source, { raw: COVER_TRANSFORM });
    } catch {
        // A URL shape `getMediaUrl` refuses to transform is still fetchable.
        requestUrl = source;
    }

    // Only ever http(s), and never a URL the caller could aim at the metadata
    // service: the value comes from our own media column, but the check costs
    // nothing and makes that fact local.
    let parsed: URL;
    try {
        parsed = new URL(requestUrl);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(parsed.toString(), {
            signal: controller.signal,
            redirect: 'follow'
        });
        if (!response.ok) {
            return null;
        }

        const declaredLength = Number(response.headers.get('content-length') ?? '0');
        if (declaredLength > MAX_COVER_BYTES) {
            return null;
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_COVER_BYTES) {
            return null;
        }

        return readJpeg({ bytes: new Uint8Array(buffer) });
    } catch (error) {
        apiLogger.warn(
            {
                url: parsed.origin + parsed.pathname,
                error: error instanceof Error ? error.message : String(error)
            },
            'brochure cover image could not be fetched — printing without it'
        );
        return null;
    } finally {
        clearTimeout(timer);
    }
}
