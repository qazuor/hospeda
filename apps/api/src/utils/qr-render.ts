import {
    QR_CODE_DEFAULT_BACKGROUND_COLOR,
    QR_CODE_DEFAULT_FOREGROUND_COLOR,
    QR_CODE_DEFAULT_MARGIN,
    QrCodeCenterLogoEnum,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    type QrCodeRenderOptions
} from '@repo/schemas';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';
import { paintCenterLogoOnPng, renderCenterLogoSvgFragment } from './qr-center-logo';

/**
 * The configurable QR render engine (HOS-981).
 *
 * One place that turns "this string, drawn this way" into an image, so that the
 * provider's static sticker, an admin-configured campaign code and whatever
 * comes next all render through the same code path with the same guarantees.
 *
 * The guarantee that matters is DETERMINISM: the same string plus the same
 * options must always produce the same bytes. Nothing here may read the clock,
 * call a random source, or depend on anything a redeploy could change. That is
 * inherited from `host-trade-qr.ts`, whose codes are already printed on vans and
 * delivery notes — a code that re-renders differently is a code that stops
 * matching the one in the field.
 *
 * The centre logo (PR 5) is drawn here, and it is the one option that DAMAGES
 * the symbol rather than restyling it: the plate blanks the modules under it
 * and the code survives on Reed-Solomon recovery alone. Two things follow.
 * First, the geometry lives in `./qr-center-logo` so the SVG and the PNG cover
 * the same modules — a mark drawn a module apart in the two formats is two
 * different amounts of damage wearing one configuration. Second, whether a mark
 * is affordable AT ALL is decided in `@repo/schemas`
 * (`qrCodeCenterLogoFits`), before anything reaches this file; this engine
 * draws what it is told, which is why a route must never hand it options that
 * did not come through the schema.
 *
 * @module utils/qr-render
 */

/** Options accepted by the engine. Every field is optional; defaults are the entity's. */
export type QrRenderOptionsInput = Partial<QrCodeRenderOptions>;

/** A rendered SVG document. */
export type QrRenderSvgResult = {
    readonly format: QrCodeFormatEnum.SVG;
    readonly svg: string;
};

/** A rendered PNG, as raw bytes plus a ready-to-embed data URL. */
export type QrRenderPngResult = {
    readonly format: QrCodeFormatEnum.PNG;
    readonly png: Buffer;
    readonly dataUrl: string;
};

export type QrRenderResult = QrRenderSvgResult | QrRenderPngResult;

/**
 * The symbol's raw module grid — what a QR *is*, before anybody decides how to
 * paint it.
 *
 * Exists because two consumers do not want an image at all: the brochure and
 * the certificate draw the dark modules as filled rectangles inside a PDF, so
 * that the code stays vector at any print size (a QR is the one graphic where
 * resampling costs scans). Handing them an SVG string to re-parse, or a PNG to
 * embed, would be strictly worse than handing them the grid.
 *
 * Publishing the grid here rather than letting each of them call `qrcode`
 * directly is the whole point: `qrcode` has exactly one importer in this repo,
 * enforced by `scripts/check-qrcode-engine-isolation.sh`. Two parallel
 * generators is not a hypothetical — it is what HOS-1129 was opened to undo.
 */
export type QrModuleMatrix = {
    /** Side of the square grid, in modules. Excludes the quiet zone. */
    readonly size: number;
    /** Whether the module at `(row, col)` is dark. Out-of-range reads as light. */
    readonly isDark: (row: number, col: number) => boolean;
};

/**
 * Fills in the defaults an omitted option takes.
 *
 * Kept separate and exported so a caller can see exactly what will be drawn
 * before drawing it (the admin preview in PR 3 needs precisely this).
 *
 * @param input - Options object (RO-RO).
 * @param input.options - Partial render options, or nothing.
 * @returns A fully-specified option set.
 */
export function resolveQrRenderOptions(input: {
    options?: QrRenderOptionsInput;
}): QrCodeRenderOptions {
    const options = input.options ?? {};

    return {
        errorCorrectionLevel: options.errorCorrectionLevel ?? QrCodeErrorCorrectionLevelEnum.M,
        format: options.format ?? QrCodeFormatEnum.SVG,
        margin: options.margin ?? QR_CODE_DEFAULT_MARGIN,
        size: options.size ?? null,
        foregroundColor: options.foregroundColor ?? QR_CODE_DEFAULT_FOREGROUND_COLOR,
        backgroundColor: options.backgroundColor ?? QR_CODE_DEFAULT_BACKGROUND_COLOR,
        centerLogo: options.centerLogo ?? QrCodeCenterLogoEnum.NONE
    };
}

/**
 * Translates the entity's options into the shape the `qrcode` library wants.
 *
 * `width` is only set when a size was actually asked for. Passing it
 * unconditionally would stamp `width`/`height` attributes onto every SVG, which
 * changes the bytes of codes that are already in production and takes away the
 * property that makes a vector worth using — that it scales to whatever box it
 * is dropped into.
 */
function toLibraryOptions(options: QrCodeRenderOptions): {
    margin: number;
    errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum;
    color: { dark: string; light: string };
    width?: number;
} {
    return {
        margin: options.margin,
        errorCorrectionLevel: options.errorCorrectionLevel,
        color: { dark: options.foregroundColor, light: options.backgroundColor },
        ...(options.size === null ? {} : { width: options.size })
    };
}

/**
 * Computes the module grid for `data`.
 *
 * Synchronous, unlike its three siblings: `QRCode.create` does no I/O, and
 * wrapping it in a promise would force every PDF drawing helper that consumes a
 * grid to become async for nothing.
 *
 * Only the error-correction level is accepted, and that is deliberate rather
 * than an oversight: a grid has no margin, no colours and no pixel size, so an
 * options bag that quietly ignored three of its five fields would be a
 * fail-open — a caller would set `margin` here, see no error, and print a code
 * with no quiet zone. The quiet zone is the CALLER's layout problem, because
 * only the caller knows what sits behind the symbol on the page.
 *
 * @param input - Options object (RO-RO).
 * @param input.data - The string the code encodes (usually a URL).
 * @param input.errorCorrectionLevel - Recovery level; defaults to the engine's.
 * @returns The module grid, identical for a given data + level pair.
 */
export function renderQrMatrix(input: {
    data: string;
    errorCorrectionLevel?: QrCodeErrorCorrectionLevelEnum;
}): QrModuleMatrix {
    const { errorCorrectionLevel } = resolveQrRenderOptions({
        options: { errorCorrectionLevel: input.errorCorrectionLevel }
    });

    const qr = QRCode.create(input.data, { errorCorrectionLevel });
    const size = qr.modules.size;
    const data = qr.modules.data;

    return {
        size,
        isDark: (row: number, col: number): boolean =>
            row >= 0 && row < size && col >= 0 && col < size && data[row * size + col] === 1
    };
}

/**
 * Renders `data` as an SVG document.
 *
 * @param input - Options object (RO-RO).
 * @param input.data - The string the code encodes (usually a URL).
 * @param input.options - Render options; anything omitted takes its default.
 * @returns The SVG markup, byte-identical for a given data + options pair.
 */
export async function renderQrSvg(input: {
    data: string;
    options?: QrRenderOptionsInput;
}): Promise<string> {
    const options = resolveQrRenderOptions({ options: input.options });

    const svg = await QRCode.toString(input.data, {
        type: 'svg',
        ...toLibraryOptions(options)
    });

    if (options.centerLogo === QrCodeCenterLogoEnum.NONE) return svg;

    const fragment = renderCenterLogoSvgFragment({
        moduleCount: renderQrMatrix({
            data: input.data,
            errorCorrectionLevel: options.errorCorrectionLevel
        }).size,
        margin: options.margin,
        foregroundColor: options.foregroundColor,
        backgroundColor: options.backgroundColor
    });

    // Appended rather than woven in: SVG paints in document order, so the mark
    // has to come after the modules it covers. The closing tag is the only
    // anchor in the library's output that is guaranteed to be there and to be
    // last, which is why the splice is on `</svg>` and not on the module path.
    return svg.replace('</svg>', `${fragment}</svg>`);
}

/**
 * Renders `data` as PNG bytes.
 *
 * @param input - Options object (RO-RO).
 * @param input.data - The string the code encodes.
 * @param input.options - Render options; anything omitted takes its default.
 * @returns The PNG buffer.
 */
export async function renderQrPng(input: {
    data: string;
    options?: QrRenderOptionsInput;
}): Promise<Buffer> {
    const options = resolveQrRenderOptions({ options: input.options });

    const buffer = await QRCode.toBuffer(input.data, {
        type: 'png',
        ...toLibraryOptions(options)
    });

    // The no-logo path returns the library's own bytes UNTOUCHED. Decoding and
    // re-encoding a PNG that needs no change would alter the bytes of every
    // code already printed — `host-trade-qr-byte-identity.test.ts` exists
    // because that is a production incident, not a diff.
    if (options.centerLogo === QrCodeCenterLogoEnum.NONE) return buffer;

    const png = PNG.sync.read(buffer);

    paintCenterLogoOnPng({
        png,
        moduleCount: renderQrMatrix({
            data: input.data,
            errorCorrectionLevel: options.errorCorrectionLevel
        }).size,
        margin: options.margin,
        foregroundColor: options.foregroundColor,
        backgroundColor: options.backgroundColor
    });

    return PNG.sync.write(png);
}

/**
 * Renders `data` in whichever format the options ask for.
 *
 * The discriminated return lets a caller branch on `format` without re-reading
 * the options it passed in.
 *
 * @param input - Options object (RO-RO).
 * @param input.data - The string the code encodes.
 * @param input.options - Render options; anything omitted takes its default.
 * @returns The rendered code, tagged with the format it came out as.
 */
export async function renderQr(input: {
    data: string;
    options?: QrRenderOptionsInput;
}): Promise<QrRenderResult> {
    const options = resolveQrRenderOptions({ options: input.options });

    if (options.format === QrCodeFormatEnum.PNG) {
        const png = await renderQrPng({ data: input.data, options });
        return {
            format: QrCodeFormatEnum.PNG,
            png,
            dataUrl: `data:image/png;base64,${png.toString('base64')}`
        };
    }

    return {
        format: QrCodeFormatEnum.SVG,
        svg: await renderQrSvg({ data: input.data, options })
    };
}
