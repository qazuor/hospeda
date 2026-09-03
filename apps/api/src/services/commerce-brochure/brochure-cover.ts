/**
 * Fetches a listing's cover photo for embedding in its brochure (HOS-1058).
 *
 * ---
 * BEST-EFFORT, ON PURPOSE
 *
 * Every failure here returns `null` and the brochure prints without a photo. A
 * timeout, a 404, a WebP, an oversized file — none of them may cost the owner
 * the document. The photo is the best part of a printed folleto and still not
 * worth a 500.
 *
 * ## What this module decides, and what it deliberately does not
 *
 * It decides only two things: that the bytes arrived, and which of the two
 * formats `pdf-lib` can embed they are. It does NOT parse the frame header —
 * that was the hand-written writer's job, and the reason that job existed was
 * that `DCTDecode` pass-through only ever received bytes we had vetted
 * ourselves. `pdf-lib` parses the JPEG and the PNG itself and throws on
 * anything it cannot embed, so a second decoder here would only be a second
 * thing to get wrong.
 *
 * The class this stops losing is a *progressive* JPEG, which the old reader
 * refused outright (`SOF2` → `null` → no photo). It embeds and renders now, and
 * that is not a small detail: Cloudinary serves progressive JPEGs, so the
 * refusal was aimed squarely at our own CDN.
 *
 * ## Why the URL is still transformed
 *
 * What a listing stores is whatever the owner uploaded: PNG, WebP, HEIC, a 12MP
 * original. Routing the URL through {@link getMediaUrl} with an explicit
 * `f_jpg` asks the CDN for a format a PDF can carry, at a width sized for print
 * rather than for the original camera — and caps what an unbounded fetch could
 * pull into memory long before {@link MAX_COVER_BYTES} has to. `f_auto` would
 * be wrong here: it answers WebP/AVIF, which no PDF can carry.
 *
 * A non-Cloudinary URL passes through untouched and is simply fetched; JPEG and
 * PNG are both accepted on that path, and anything else is `null`.
 *
 * @module services/commerce-brochure/brochure-cover
 */

import { getMediaUrl } from '@repo/media';
import { apiLogger } from '../../utils/logger.js';

/** The two raster formats a PDF can carry, and `pdf-lib` can embed. */
export type BrochureCoverFormat = 'jpeg' | 'png';

/** A cover photo, fetched and typed, ready to hand to `pdf-lib`. */
export interface BrochureCover {
    readonly bytes: Uint8Array;
    readonly format: BrochureCoverFormat;
}

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

/** `FF D8 FF` — SOI followed by the first marker of any JPEG. */
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

/** The eight-byte PNG signature, which no other format shares. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** Tests a magic-number prefix. */
function startsWith(input: { bytes: Uint8Array; signature: readonly number[] }): boolean {
    const { bytes, signature } = input;
    if (bytes.length < signature.length) {
        return false;
    }
    return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Names the format from the file's magic number.
 *
 * The `Content-Type` header is not consulted on purpose: a CDN mislabelling a
 * body is a real thing, and the first bytes are not.
 *
 * @param input.bytes - The fetched file.
 * @returns The format, or `null` for anything a PDF cannot carry.
 */
export function detectCoverFormat(input: { bytes: Uint8Array }): BrochureCoverFormat | null {
    if (startsWith({ bytes: input.bytes, signature: JPEG_SIGNATURE })) {
        return 'jpeg';
    }
    if (startsWith({ bytes: input.bytes, signature: PNG_SIGNATURE })) {
        return 'png';
    }
    return null;
}

/**
 * Fetches and types the cover photo.
 *
 * @param input.url - The image URL from the listing's PUBLIC media payload.
 * @returns An embeddable image, or `null` for every failure mode.
 */
export async function loadBrochureCover(input: {
    url: string | null;
}): Promise<BrochureCover | null> {
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

        const bytes = new Uint8Array(buffer);
        const format = detectCoverFormat({ bytes });
        return format === null ? null : { bytes, format };
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
