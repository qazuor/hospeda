import {
    QR_CODE_DEFAULT_BACKGROUND_COLOR,
    QR_CODE_DEFAULT_FOREGROUND_COLOR,
    QR_CODE_DEFAULT_MARGIN,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    type QrCodeRenderOptions
} from '@repo/schemas';
import QRCode from 'qrcode';

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
 * The centre logo is deliberately NOT here yet: it needs SVG composition plus a
 * check that the composed result still scans, and it is built alongside the
 * panel that configures it (PR 3). `render_options` is `jsonb`, so adding it
 * later costs no migration.
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
        backgroundColor: options.backgroundColor ?? QR_CODE_DEFAULT_BACKGROUND_COLOR
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

    return QRCode.toString(input.data, {
        type: 'svg',
        ...toLibraryOptions(options)
    });
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

    return QRCode.toBuffer(input.data, {
        type: 'png',
        ...toLibraryOptions(options)
    });
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
