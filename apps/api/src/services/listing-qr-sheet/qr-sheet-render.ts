/**
 * Lays a {@link ListingQrSheetContent} out on A4 and returns the PDF bytes
 * (HOS-982, redesigned as a sticker in HOS-2688).
 *
 * ---
 * WHAT THIS PAGE IS FOR
 *
 * It is cut out and stuck on a door, a window or a counter, and it is read by
 * somebody who walks up to it. The page carries the owner's sticker artwork
 * («ENCONTRANOS EN HOSPEDA», the mascot, a white box and a blue pill), and the
 * renderer adds the two things that belong to ONE listing: the real QR, drawn
 * inside the white box, and the listing's name, set in the pill under
 * «ESCANEÁ PARA CONOCER».
 *
 * ## The page: A4, a 190mm sticker, cut marks
 *
 * The sticker is {@link STICKER_SIZE_MM}mm square, centred on A4 (owner
 * decision, HOS-2688). That leaves 10mm each side, enough for a home printer's
 * dead zone (3-6mm) and the 4mm cut marks at the four corners, set 1.5mm off
 * the sticker's edge so the cut itself never hits ink.
 *
 * ## The QR's size, and the distance it is meant to work at — stated honestly
 *
 * The rule of thumb in the printing trade is that a symbol scans reliably at
 * about TEN TIMES its own side. The white box in the artwork is ~73mm at this
 * sticker size; the symbol and its four-module quiet zone have to fit inside
 * it, so the symbol itself comes out at ~58mm for today's redirect (a 33-module
 * symbol: `https://hospeda.com.ar/qr/XXXXXXXX/` at level Q). That is a code
 * read from roughly 60cm — somebody standing at the door, not across the
 * street. The previous plain sheet printed a 113mm code for ~1.1m; the sticker
 * trades that distance for the design the owner chose, and that trade is the
 * owner's decision, not an accident of layout.
 *
 * The printer's floor is still far away: ~58mm / 33 modules ≈ 1.75mm per module,
 * against the ~0.5mm a scanner wants.
 *
 * ## Error correction: Q
 *
 * {@link QR_ERROR_CORRECTION} stays Q (~25% recoverable). A sticker on a door
 * gets scuffed, rained on and partly covered, and Q is what survives a covered
 * corner. The extra modules Q costs over M are affordable at this size: the
 * module stays more than three times the scanner's floor.
 *
 * ## Colour
 *
 * The artwork is a colour raster; everything this file draws as vector is
 * black or white. The modules are pure black on the artwork's white box (the
 * highest contrast a printer can give), and the pill's copy is white on the
 * artwork's blue. A black-and-white printer turns the pill grey and the copy
 * still reads; the code loses nothing.
 *
 * ## Quiet zone
 *
 * `renderQrMatrix` returns the symbol WITHOUT its quiet zone. Here it is four
 * modules of the box's own white on every side, reserved by sizing the symbol
 * so symbol + quiet zone fit the box. Nothing else is drawn in the box.
 *
 * ## Determinism
 *
 * Same listing, same locale, same bytes. Nothing here reads the clock or a
 * random source, and the document's dates are pinned to the epoch.
 *
 * @module services/listing-qr-sheet/qr-sheet-render
 */

import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { PageSizes, PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { type QrModuleMatrix, renderQrMatrix } from '../../utils/qr-render.js';
import type { ListingQrSheetContent } from './qr-sheet-content.js';
import { type FittedLine, fitLine, type WidthOf } from './qr-sheet-fit.js';
import { A4_HEIGHT, A4_WIDTH, drawLineTopDown, drawTextTopDown, measure } from './qr-sheet-page.js';
import { STICKER_ART_JPEG_BASE64, STICKER_ART_UNITS } from './sticker-art.data.js';

/** Points per millimetre. */
const MM = 72 / 25.4;

/** Side of the printed sticker, in millimetres (owner decision, HOS-2688). */
export const STICKER_SIZE_MM = 190;

/** Side of the printed sticker, in points. */
export const STICKER_SIZE = STICKER_SIZE_MM * MM;

/** Error correction of the printed QR. See the module docblock for why Q. */
export const QR_ERROR_CORRECTION = QrCodeErrorCorrectionLevelEnum.Q;

/** Quiet zone around the symbol, in MODULES. Four is the specification's floor. */
const QR_QUIET_MODULES = 4;

/** Gap between the sticker's edge and the start of each cut mark, in mm. */
const CROP_MARK_OFFSET_MM = 1.5;

/** Length of each cut mark, in mm. */
const CROP_MARK_LENGTH_MM = 4;

/** Stroke of the cut marks, in points. A hairline that still prints. */
const CROP_MARK_THICKNESS = 0.5;

/** The two vector inks. See "Colour" above. */
const INK = rgb(0, 0, 0);
const PILL_INK = rgb(1, 1, 1);

/** A box in the artwork's {@link STICKER_ART_UNITS} space. */
export interface ArtBox {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}

/**
 * The artwork's white rounded box, in art units — measured from the owner's
 * file (edges where the box's white meets the background).
 */
export const QR_BOX: ArtBox = { left: 641, top: 518, right: 1125, bottom: 994 };

/** The artwork's blue pill, in art units — measured the same way. */
export const PILL_BOX: ArtBox = { left: 579, top: 1006, right: 1182, bottom: 1132 };

/**
 * Horizontal padding inside the pill, in art units. Keeps the copy clear of the
 * pill's rounded ends (corner radius ≈ 25 units).
 */
export const PILL_PADDING_UNITS = 40;

/** Type scale of the pill, in points. */
const PILL_HEADLINE_SIZE_MAX = 14;
const PILL_HEADLINE_SIZE_MIN = 9;
export const PILL_NAME_SIZE_MAX = 20;
export const PILL_NAME_SIZE_MIN = 10;

/** Vertical gap between the two pill lines (baseline of line 1 to cap of line 2), in points. */
const PILL_LINE_GAP = 5;

/** Cap height of Helvetica-Bold as a fraction of the font size. */
const CAP_HEIGHT = 0.718;

/** The locale whose casing rules uppercase the pill's copy. */
const UPPERCASE_LOCALE = 'es-AR';

/** Everything the renderer needs beyond the copy itself. */
export interface ListingQrSheetRenderInput {
    readonly content: ListingQrSheetContent;
    /**
     * What the QR encodes: `{site}/qr/{qrSlug}/`, the platform's own redirect
     * (HOS-981).
     *
     * Separate from `content.url`, which is the ficha's real address and is
     * where this redirect LANDS. Nothing on this sheet draws `content.url`:
     * paper is not correctable. Resolving this one needs the database, so it is
     * passed in rather than derived here — the renderer stays a pure function
     * of its inputs.
     */
    readonly qrUrl: string;
}

/** Where the sticker sits on the page, top-down, in points. */
interface StickerFrame {
    readonly left: number;
    readonly top: number;
    /** Points per art unit. */
    readonly scale: number;
}

/** The sticker, centred on A4. */
function stickerFrame(): StickerFrame {
    return {
        left: (A4_WIDTH - STICKER_SIZE) / 2,
        top: (A4_HEIGHT - STICKER_SIZE) / 2,
        scale: STICKER_SIZE / STICKER_ART_UNITS
    };
}

/**
 * Usable width of the pill for one line of copy, in points, at the printed
 * sticker size.
 */
export const PILL_TEXT_WIDTH =
    (PILL_BOX.right - PILL_BOX.left - PILL_PADDING_UNITS * 2) * (STICKER_SIZE / STICKER_ART_UNITS);

/**
 * Draws the QR as filled rectangles, centred in the artwork's white box.
 *
 * Vector rather than a raster image: a QR is the one graphic where resampling
 * costs scans. Horizontal runs of dark modules are merged into one rectangle.
 *
 * The grid comes from `utils/qr-render.ts`, the ONE module in this repo allowed
 * to import the encoder package (HOS-1129, enforced by
 * `scripts/check-qrcode-engine-isolation.sh`). What is drawn is `qrUrl` — the
 * platform's own redirect, never the ficha's final URL.
 *
 * The symbol plus its {@link QR_QUIET_MODULES}-module quiet zone fill the
 * shorter side of the box; the box's own white IS the quiet zone.
 */
function drawQr(input: { page: PDFPage; qr: QrModuleMatrix; frame: StickerFrame }): void {
    const { page, qr, frame } = input;
    const boxSide = Math.min(QR_BOX.right - QR_BOX.left, QR_BOX.bottom - QR_BOX.top) * frame.scale;
    const count = qr.size;
    const module = boxSide / (count + QR_QUIET_MODULES * 2);
    const size = module * count;
    const centreX = frame.left + ((QR_BOX.left + QR_BOX.right) / 2) * frame.scale;
    const centreY = frame.top + ((QR_BOX.top + QR_BOX.bottom) / 2) * frame.scale;
    const left = centreX - size / 2;
    const top = centreY - size / 2;

    for (let row = 0; row < count; row += 1) {
        let runStart = -1;
        for (let col = 0; col <= count; col += 1) {
            const dark = qr.isDark(row, col);
            if (dark && runStart === -1) {
                runStart = col;
            } else if (!dark && runStart !== -1) {
                page.drawRectangle({
                    x: left + runStart * module,
                    y: A4_HEIGHT - (top + (row + 1) * module),
                    width: (col - runStart) * module,
                    height: module,
                    color: INK,
                    borderWidth: 0
                });
                runStart = -1;
            }
        }
    }
}

/**
 * Fits a listing name into the pill: uppercased, shrunk between
 * {@link PILL_NAME_SIZE_MAX} and {@link PILL_NAME_SIZE_MIN}, cut with «…» past
 * the floor.
 *
 * @param input - Input parameters.
 * @param input.name - The listing's name as typed by its owner.
 * @param input.widthOf - Width measurement of the pill's face.
 * @param input.maxWidth - The usable width, in points. Defaults to
 *   {@link PILL_TEXT_WIDTH}.
 * @returns The text and size to draw, and whether it was cut.
 */
export function fitPillName(input: {
    readonly name: string;
    readonly widthOf: WidthOf;
    readonly maxWidth?: number;
}): FittedLine {
    return fitLine({
        text: input.name.replace(/\s+/g, ' ').toLocaleUpperCase(UPPERCASE_LOCALE),
        maxWidth: input.maxWidth ?? PILL_TEXT_WIDTH,
        maxSize: PILL_NAME_SIZE_MAX,
        minSize: PILL_NAME_SIZE_MIN,
        widthOf: input.widthOf
    });
}

/**
 * Draws the two lines of the pill, centred in it: the fixed invitation on top,
 * the listing's name under it. Both uppercase, white, bold — the artwork's own
 * style. The name shrinks to {@link PILL_NAME_SIZE_MIN} and is then cut with
 * «…» (see `fitLine`), so it never leaves the pill.
 */
function drawPill(input: {
    page: PDFPage;
    font: PDFFont;
    frame: StickerFrame;
    headline: string;
    name: string;
}): void {
    const { page, font, frame } = input;
    const widthOf: WidthOf = ({ text, size }) => measure({ text, font, size });

    const headline = fitLine({
        text: input.headline.toLocaleUpperCase(UPPERCASE_LOCALE),
        maxWidth: PILL_TEXT_WIDTH,
        maxSize: PILL_HEADLINE_SIZE_MAX,
        minSize: PILL_HEADLINE_SIZE_MIN,
        widthOf
    });
    const name = fitPillName({ name: input.name, widthOf });

    const blockHeight = headline.size * CAP_HEIGHT + PILL_LINE_GAP + name.size * CAP_HEIGHT;
    const centreX = frame.left + ((PILL_BOX.left + PILL_BOX.right) / 2) * frame.scale;
    const centreY = frame.top + ((PILL_BOX.top + PILL_BOX.bottom) / 2) * frame.scale;
    const headlineBaseline = centreY - blockHeight / 2 + headline.size * CAP_HEIGHT;
    const nameBaseline = headlineBaseline + PILL_LINE_GAP + name.size * CAP_HEIGHT;

    for (const line of [
        { fitted: headline, baseline: headlineBaseline },
        { fitted: name, baseline: nameBaseline }
    ]) {
        const width = widthOf({ text: line.fitted.text, size: line.fitted.size });
        drawTextTopDown({
            page,
            text: line.fitted.text,
            x: centreX - width / 2,
            y: line.baseline,
            font,
            size: line.fitted.size,
            color: PILL_INK
        });
    }
}

/**
 * Draws the eight cut marks: two per corner, along the sticker's edges
 * extended outward, starting {@link CROP_MARK_OFFSET_MM}mm off the corner.
 */
function drawCropMarks(input: { page: PDFPage; frame: StickerFrame }): void {
    const { page, frame } = input;
    const offset = CROP_MARK_OFFSET_MM * MM;
    const length = CROP_MARK_LENGTH_MM * MM;
    const right = frame.left + STICKER_SIZE;
    const bottom = frame.top + STICKER_SIZE;

    for (const x of [frame.left, right]) {
        for (const y of [frame.top, bottom]) {
            const outX = x === frame.left ? -1 : 1;
            const outY = y === frame.top ? -1 : 1;
            // Vertical mark, on the extension of the vertical edge.
            drawLineTopDown({
                page,
                x1: x,
                y1: y + outY * offset,
                x2: x,
                y2: y + outY * (offset + length),
                thickness: CROP_MARK_THICKNESS,
                color: INK
            });
            // Horizontal mark, on the extension of the horizontal edge.
            drawLineTopDown({
                page,
                x1: x + outX * offset,
                y1: y,
                x2: x + outX * (offset + length),
                y2: y,
                thickness: CROP_MARK_THICKNESS,
                color: INK
            });
        }
    }
}

/**
 * Renders a listing's printable QR sticker sheet.
 *
 * @param input - Input parameters.
 * @param input.content - What to print.
 * @param input.qrUrl - The platform redirect the symbol encodes.
 * @returns The complete PDF file, one A4 page.
 */
export async function renderListingQrSheetPdf(
    input: ListingQrSheetRenderInput
): Promise<Uint8Array<ArrayBuffer>> {
    const { content, qrUrl } = input;
    const doc = await PDFDocument.create();
    doc.setTitle(content.listingName);
    doc.setProducer('Hospeda');
    doc.setCreator('Hospeda');
    // Pinned rather than `now`: see "Determinism" above.
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const art = await doc.embedJpg(Buffer.from(STICKER_ART_JPEG_BASE64, 'base64'));
    const page = doc.addPage(PageSizes.A4);
    const frame = stickerFrame();

    page.drawImage(art, {
        x: frame.left,
        y: A4_HEIGHT - (frame.top + STICKER_SIZE),
        width: STICKER_SIZE,
        height: STICKER_SIZE
    });

    const qr = renderQrMatrix({ data: qrUrl, errorCorrectionLevel: QR_ERROR_CORRECTION });
    drawQr({ page, qr, frame });
    drawPill({
        page,
        font: bold,
        frame,
        headline: content.pillHeadline,
        name: content.listingName
    });
    drawCropMarks({ page, frame });

    // A fresh, `ArrayBuffer`-backed copy: `Response` wants a `BufferSource`, and
    // the generically-backed `Uint8Array` `save()` returns is not assignable.
    return new Uint8Array(await doc.save());
}
