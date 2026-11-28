/**
 * The A4 page the QR sheet is drawn on, and the primitives that draw on it
 * (HOS-982).
 *
 * ---
 * WHY THIS IS A FILE OF ITS OWN
 *
 * Only to keep `qr-sheet-render.ts` under the repo's 500-line ceiling. There is
 * no second consumer and no abstraction being claimed here: everything below is
 * page mechanics, and every DECISION about the sheet — how big the code is, what
 * error correction it carries, where the sticker sits — stays next to the
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
import { toDrawableText } from '../listing-brochure/brochure-render.js';

/** A4 in points, as PDF measures it. */
export const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4;

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
 * Draws a straight line between two points given top-down.
 *
 * Used for the cut marks. A stroke rather than a thin filled rectangle, so the
 * marks are never mistaken for part of the symbol by anything that reads the
 * page's filled paths back.
 *
 * @param input - Input parameters.
 * @param input.page - The page to draw on.
 * @param input.x1 - Start, in points from the page's left.
 * @param input.y1 - Start, in points from the page's TOP.
 * @param input.x2 - End, in points from the page's left.
 * @param input.y2 - End, in points from the page's TOP.
 * @param input.thickness - Stroke width, in points.
 * @param input.color - Stroke colour.
 */
export function drawLineTopDown(input: {
    readonly page: PDFPage;
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly thickness: number;
    readonly color: Color;
}): void {
    input.page.drawLine({
        start: { x: input.x1, y: A4_HEIGHT - input.y1 },
        end: { x: input.x2, y: A4_HEIGHT - input.y2 },
        thickness: input.thickness,
        color: input.color
    });
}
