/**
 * The A4 page the QR sheet is drawn on, and the four primitives that draw on it
 * (HOS-982).
 *
 * ---
 * WHY THIS IS A FILE OF ITS OWN
 *
 * Only to keep `qr-sheet-render.ts` under the repo's 500-line ceiling. There is
 * no second consumer and no abstraction being claimed here: everything below is
 * page mechanics, and every DECISION about the sheet — how big the code is, what
 * error correction it carries, what order the blocks come in — stays next to the
 * argument for it, in the renderer.
 *
 * ## Coordinates
 *
 * The layout is written top-down — `y` grows toward the foot of the page, which
 * is how a document reads — while PDF's own origin is the bottom-left corner.
 * These helpers are the ONLY place that flips, so no layout constant anywhere
 * else has to be read upside down. Same convention the brochure uses.
 *
 * @module services/listing-qr-sheet/qr-sheet-page
 */

import { type Color, PageSizes, type PDFFont, type PDFPage } from 'pdf-lib';
import { toDrawableText } from '../commerce-brochure/brochure-render.js';

/** A4 in points, as PDF measures it. */
export const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4;

/**
 * Page margin, in points. 48pt ≈ 17mm.
 *
 * Home printers do not print to the edge — the unprintable border is typically
 * 3-6mm and can reach 10mm at the foot — so nothing is placed nearer than this.
 * A sheet whose code is clipped by the printer's dead zone is a sheet that
 * cannot be scanned at all.
 */
export const MARGIN = 48;

/** Usable column width. */
export const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

/** Usable column height. */
export const CONTENT_HEIGHT = A4_HEIGHT - MARGIN * 2;

/**
 * Width of `text` in points, after the substitutions `toDrawableText` makes.
 *
 * Measuring the SUBSTITUTED string rather than the raw one matters: a name
 * carrying characters the standard faces cannot encode is drawn as `?`, and
 * measuring the original would centre it wrong by however many it replaced.
 *
 * @param input - Input parameters.
 * @param input.text - The string that will be drawn.
 * @param input.font - The face it will be drawn with.
 * @param input.size - Font size, in points.
 * @returns The drawn width, in points.
 */
export function measure(input: {
    readonly text: string;
    readonly font: PDFFont;
    readonly size: number;
}): number {
    return input.font.widthOfTextAtSize(
        toDrawableText({ text: input.text, font: input.font }),
        input.size
    );
}

/**
 * Draws text whose `y` is the baseline measured from the TOP of the page.
 *
 * @param input - Input parameters.
 * @param input.page - The page to draw on.
 * @param input.text - The copy to draw.
 * @param input.x - Left edge, in points from the page's left.
 * @param input.y - Baseline, in points from the page's TOP.
 * @param input.font - The face to draw with.
 * @param input.size - Font size, in points.
 * @param input.color - Fill colour.
 */
export function drawTextTopDown(input: {
    readonly page: PDFPage;
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly font: PDFFont;
    readonly size: number;
    readonly color: Color;
}): void {
    input.page.drawText(toDrawableText({ text: input.text, font: input.font }), {
        x: input.x,
        y: A4_HEIGHT - input.y,
        size: input.size,
        font: input.font,
        color: input.color
    });
}

/**
 * Draws one line centred on the page, `y` being its baseline from the top.
 *
 * @param input - Input parameters.
 * @param input.page - The page to draw on.
 * @param input.text - The copy to draw.
 * @param input.y - Baseline, in points from the page's TOP.
 * @param input.font - The face to draw with.
 * @param input.size - Font size, in points.
 * @param input.color - Fill colour.
 */
export function drawCentredLine(input: {
    readonly page: PDFPage;
    readonly text: string;
    readonly y: number;
    readonly font: PDFFont;
    readonly size: number;
    readonly color: Color;
}): void {
    const width = measure({ text: input.text, font: input.font, size: input.size });
    drawTextTopDown({
        page: input.page,
        text: input.text,
        x: (A4_WIDTH - width) / 2,
        y: input.y,
        font: input.font,
        size: input.size,
        color: input.color
    });
}

/**
 * Draws a filled rectangle whose `y` is its TOP edge.
 *
 * @param input - Input parameters.
 * @param input.page - The page to draw on.
 * @param input.x - Left edge, in points from the page's left.
 * @param input.y - TOP edge, in points from the page's top.
 * @param input.width - Width, in points.
 * @param input.height - Height, in points.
 * @param input.color - Fill colour.
 */
export function drawRectTopDown(input: {
    readonly page: PDFPage;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color: Color;
}): void {
    input.page.drawRectangle({
        x: input.x,
        y: A4_HEIGHT - (input.y + input.height),
        width: input.width,
        height: input.height,
        color: input.color,
        borderWidth: 0
    });
}
