/**
 * @file qr-png.ts
 * @description Client-side SVG→PNG conversion for the gastronomy menu QR
 * download button (HOS-1044 §6.6, §11 OQ-3).
 *
 * The API renders the code as SVG only (`renderQrSvg`,
 * `apps/api/src/utils/qr-render.ts` — `scripts/check-qrcode-engine-isolation.sh`
 * keeps `qrcode` isolated there, NG-1). PNG is a VIEW-side conversion of that
 * same markup, done entirely in the browser: OQ-3 narrows the download format
 * to "PNG only, no printable PDF" (the PDF is HOS-982's), so no new API
 * surface is worth adding for a format decision this small.
 *
 * Mirrors the injectable-seam shape of `lib/media/compress-image.ts`: the
 * default implementation uses real browser APIs (`Image` + `canvas`), and
 * every failure mode (decode failure, no canvas support) resolves to `null`
 * rather than throwing — converting a QR for download is an enhancement, and
 * the caller falls back to the raw SVG instead of blocking the click.
 */

/** Default raster size (px, square) for the exported PNG. */
export const DEFAULT_QR_PNG_SIZE_PX = 1024;

/**
 * Builds a `data:image/svg+xml` URL from raw SVG markup.
 *
 * Pure — no browser API — so it is safe to unit-test directly.
 *
 * @param svg - The raw SVG markup
 * @returns A `data:` URL encoding that markup
 */
export function buildSvgDataUrl(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Decodes an SVG data URL into a drawable image element. */
export type LoadQrImageFn = (dataUrl: string) => Promise<HTMLImageElement>;

/** Draws a loaded image onto a canvas of the given size and encodes it as PNG. */
export type EncodeQrPngFn = (params: {
    readonly image: HTMLImageElement;
    readonly sizePx: number;
}) => Promise<Blob | null>;

/**
 * Default image loader: a plain `<img>`, resolved on `load`, rejected on
 * `error` (e.g. malformed SVG markup the browser refuses to decode).
 */
function defaultLoadQrImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('qr-png: failed to decode SVG'));
        image.src = dataUrl;
    });
}

/**
 * Default encode step: draw onto a detached `<canvas>` and export via
 * `toBlob`. Resolves `null` when the DOM/canvas is unavailable rather than
 * throwing — the same "optimization, never a requirement" contract
 * `compress-image.ts` uses.
 */
function defaultEncodeQrPng({
    image,
    sizePx
}: {
    readonly image: HTMLImageElement;
    readonly sizePx: number;
}): Promise<Blob | null> {
    if (typeof document === 'undefined') {
        return Promise.resolve(null);
    }
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return Promise.resolve(null);
    }
    ctx.drawImage(image, 0, 0, sizePx, sizePx);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Input for {@link renderSvgToPngBlob}. */
export interface RenderSvgToPngBlobInput {
    readonly svg: string;
    /** @default {@link DEFAULT_QR_PNG_SIZE_PX} */
    readonly sizePx?: number;
    /** Test seam — defaults to a real `<img>` load. */
    readonly loadImage?: LoadQrImageFn;
    /** Test seam — defaults to canvas-based encoding. */
    readonly encodePng?: EncodeQrPngFn;
}

/**
 * Converts QR SVG markup into a square PNG `Blob`, entirely client-side.
 *
 * Never throws: a decode or encode failure resolves to `null` so a download
 * click can fall back to the raw SVG instead of doing nothing.
 *
 * @param input - The SVG markup, plus optional size/test overrides
 * @returns A PNG `Blob`, or `null` if conversion is unavailable
 */
export async function renderSvgToPngBlob(input: RenderSvgToPngBlobInput): Promise<Blob | null> {
    const {
        svg,
        sizePx = DEFAULT_QR_PNG_SIZE_PX,
        loadImage = defaultLoadQrImage,
        encodePng = defaultEncodeQrPng
    } = input;

    let image: HTMLImageElement;
    try {
        image = await loadImage(buildSvgDataUrl(svg));
    } catch {
        return null;
    }

    try {
        return await encodePng({ image, sizePx });
    } catch {
        return null;
    }
}
