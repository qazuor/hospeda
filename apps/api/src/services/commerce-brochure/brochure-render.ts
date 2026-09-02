/**
 * Lays a {@link BrochureContent} out on A4 and returns the PDF bytes
 * (HOS-1058).
 *
 * ---
 * WHAT THIS PAGE IS FOR
 *
 * It is not a web page on paper. It is the thing that sits on a hotel counter,
 * in a cabin's welcome folder, and in the pile at the tourism office — the
 * channel that still moves half the Litoral and that a commerce currently has
 * to pay a designer to enter. So the page is built around two jobs, in this
 * order: be readable at arm's length on a rack, and get the reader back online
 * through the QR.
 *
 * Everything else follows from that. One column, because a folded or
 * photocopied two-column layout loses its second column. Generous type, because
 * the reader is standing. The QR last and large, because it is the only part of
 * the sheet that is a link.
 *
 * ## Determinism
 *
 * Same listing, same locale, same bytes. Nothing here reads the clock or
 * randomness, and {@link PdfDocument} writes no `CreationDate` — so a caching
 * layer, an ETag, or a test can compare two runs directly.
 *
 * @module services/commerce-brochure/brochure-render
 */

import QRCode from 'qrcode';
import { measureText, type PdfFontName, wrapText } from '../../utils/pdf/helvetica.js';
import {
    A4_HEIGHT,
    A4_WIDTH,
    type PdfColor,
    PdfDocument,
    type PdfJpeg
} from '../../utils/pdf/pdf-document.js';
import type { BrochureContent } from './brochure-content.js';

/** Page margin, in points. ~17mm, inside every desktop printer's dead zone. */
const MARGIN = 48;

/** Usable column width. */
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

/** Height of the coloured header band. */
const HEADER_HEIGHT = 96;

/** Print palette. Dark ink on white — a colour brochure must survive a b/w copier. */
const HEADER_BG: PdfColor = [0.08, 0.22, 0.25];
const HEADER_FG: PdfColor = [1, 1, 1];
const BODY_FG: PdfColor = [0.13, 0.13, 0.13];
const MUTED_FG: PdfColor = [0.38, 0.38, 0.38];
const RULE_FG: PdfColor = [0.85, 0.85, 0.85];

/** Type scale, in points. */
const TITLE_SIZE = 24;
const SUBTITLE_SIZE = 11;
const HEADING_SIZE = 12;
const BODY_SIZE = 10;
const SMALL_SIZE = 8.5;

/** Line height as a multiple of font size. */
const LEADING = 1.35;

/** Side of the printed QR, in points. ~32mm — scans from a phone at arm's length. */
const QR_SIZE = 92;

/** Error correction of the printed QR: paper gets folded, scuffed and copied. */
const QR_ERROR_CORRECTION = 'M';

/** Max height of the cover photo. Leaves room for text on the same page. */
const COVER_MAX_HEIGHT = 180;

/** Everything the renderer needs beyond the content itself. */
export interface BrochureRenderInput {
    readonly content: BrochureContent;
    /**
     * The cover photo, already fetched and validated as an embeddable JPEG, or
     * `null`. Fetching happens outside so this function stays synchronous,
     * deterministic and trivially testable.
     */
    readonly cover: PdfJpeg | null;
}

/** A cursor walking down the page, opening new ones as it runs out. */
class PageCursor {
    private y: number;

    constructor(
        private readonly doc: PdfDocument,
        startY: number
    ) {
        this.y = startY;
    }

    /** Current vertical position, in points from the page top. */
    get top(): number {
        return this.y;
    }

    /** Moves down without drawing. */
    advance(input: { by: number }): void {
        this.y += input.by;
    }

    /**
     * Ensures `height` points are available, opening a page if not.
     *
     * @returns `true` when a new page was opened, so the caller can re-emit a
     *   heading if it wants to.
     */
    reserve(input: { height: number }): boolean {
        if (this.y + input.height <= A4_HEIGHT - MARGIN) {
            return false;
        }
        this.doc.addPage();
        this.y = MARGIN;
        return true;
    }
}

/** Draws one wrapped paragraph and moves the cursor past it. */
function drawParagraph(input: {
    doc: PdfDocument;
    cursor: PageCursor;
    text: string;
    font: PdfFontName;
    size: number;
    color: PdfColor;
}): void {
    const { doc, cursor, size } = input;
    const lines = wrapText({
        text: input.text,
        font: input.font,
        size,
        maxWidth: CONTENT_WIDTH
    });
    const lineHeight = size * LEADING;
    for (const line of lines) {
        cursor.reserve({ height: lineHeight });
        // `y` is the baseline: sit it at the bottom of the line box.
        doc.drawText({
            text: line,
            x: MARGIN,
            y: cursor.top + size,
            font: input.font,
            size,
            color: input.color
        });
        cursor.advance({ by: lineHeight });
    }
}

/**
 * Draws the QR as filled rectangles.
 *
 * Vector rather than a raster image: a QR is the one graphic where resampling
 * costs scans, and the module grid is cheaper to express as rectangles than as
 * an embedded bitmap. Horizontal runs of dark modules are merged into a single
 * rectangle, which roughly halves the operator count.
 */
function drawQr(input: {
    doc: PdfDocument;
    url: string;
    x: number;
    y: number;
    size: number;
}): void {
    const { doc, x, y, size } = input;
    const qr = QRCode.create(input.url, { errorCorrectionLevel: QR_ERROR_CORRECTION });
    const count = qr.modules.size;
    const data = qr.modules.data;
    const module = size / count;

    // White ground: the quiet zone is drawn by the caller's layout, but a
    // scanner needs the symbol itself on white even if the page ever gains a
    // tinted panel behind it.
    doc.drawRect({ x, y, width: size, height: size, color: [1, 1, 1] });

    for (let row = 0; row < count; row += 1) {
        let runStart = -1;
        for (let col = 0; col <= count; col += 1) {
            const dark = col < count && data[row * count + col] === 1;
            if (dark && runStart === -1) {
                runStart = col;
            } else if (!dark && runStart !== -1) {
                doc.drawRect({
                    x: x + runStart * module,
                    y: y + row * module,
                    width: (col - runStart) * module,
                    height: module,
                    color: [0, 0, 0]
                });
                runStart = -1;
            }
        }
    }
}

/**
 * Renders a brochure.
 *
 * @param input.content - What to print.
 * @param input.cover - The cover photo, or `null` to print without one.
 * @returns The complete PDF file.
 */
export function renderBrochurePdf(input: BrochureRenderInput): Uint8Array<ArrayBuffer> {
    const { content, cover } = input;
    const doc = new PdfDocument();
    doc.setTitle({ title: content.title });
    doc.addPage();

    // ── Header band ────────────────────────────────────────────────────────
    doc.drawRect({ x: 0, y: 0, width: A4_WIDTH, height: HEADER_HEIGHT, color: HEADER_BG });

    // The title is the one string allowed to shrink rather than wrap: a
    // two-line name pushes the subtitle out of the band.
    let titleSize = TITLE_SIZE;
    while (
        titleSize > 13 &&
        measureText({ text: content.title, font: 'Helvetica-Bold', size: titleSize }) >
            CONTENT_WIDTH
    ) {
        titleSize -= 1;
    }
    doc.drawText({
        text: content.title,
        x: MARGIN,
        y: 52,
        font: 'Helvetica-Bold',
        size: titleSize,
        color: HEADER_FG
    });
    if (content.subtitle) {
        doc.drawText({
            text: content.subtitle,
            x: MARGIN,
            y: 74,
            font: 'Helvetica',
            size: SUBTITLE_SIZE,
            color: HEADER_FG
        });
    }

    const cursor = new PageCursor(doc, HEADER_HEIGHT + 24);

    // ── Cover photo ────────────────────────────────────────────────────────
    if (cover) {
        const scale = Math.min(CONTENT_WIDTH / cover.width, COVER_MAX_HEIGHT / cover.height);
        const width = cover.width * scale;
        const height = cover.height * scale;
        const handle = doc.addJpeg({ jpeg: cover });
        doc.drawImage({
            image: handle,
            // Centred: a portrait photo letterboxes rather than stretches, and
            // a stretched storefront is worse than a narrow one.
            x: MARGIN + (CONTENT_WIDTH - width) / 2,
            y: cursor.top,
            width,
            height
        });
        cursor.advance({ by: height + 20 });
    }

    // ── Price ──────────────────────────────────────────────────────────────
    if (content.price) {
        drawParagraph({
            doc,
            cursor,
            text: content.price,
            font: 'Helvetica-Bold',
            size: HEADING_SIZE,
            color: BODY_FG
        });
        cursor.advance({ by: 6 });
    }

    // ── Intro ──────────────────────────────────────────────────────────────
    if (content.intro) {
        drawParagraph({
            doc,
            cursor,
            text: content.intro,
            font: 'Helvetica',
            size: BODY_SIZE,
            color: BODY_FG
        });
        cursor.advance({ by: 14 });
    }

    // ── Sections ───────────────────────────────────────────────────────────
    for (const section of content.sections) {
        // Keep a heading with at least its first line: a heading alone at the
        // foot of a page reads as a section with nothing in it.
        cursor.reserve({ height: HEADING_SIZE * LEADING + BODY_SIZE * LEADING });
        doc.drawRect({
            x: MARGIN,
            y: cursor.top,
            width: CONTENT_WIDTH,
            height: 0.6,
            color: RULE_FG
        });
        cursor.advance({ by: 10 });
        drawParagraph({
            doc,
            cursor,
            text: section.heading,
            font: 'Helvetica-Bold',
            size: HEADING_SIZE,
            color: BODY_FG
        });
        cursor.advance({ by: 2 });
        for (const line of section.lines) {
            drawParagraph({
                doc,
                cursor,
                text: line,
                font: 'Helvetica',
                size: BODY_SIZE,
                color: BODY_FG
            });
        }
        cursor.advance({ by: 14 });
    }

    // ── QR block ───────────────────────────────────────────────────────────
    // Reserved as one unit: the code and the sentence explaining it must not
    // land on different sheets.
    cursor.reserve({ height: QR_SIZE + 24 });
    const qrTop = cursor.top;
    drawQr({ doc, url: content.url, x: MARGIN, y: qrTop, size: QR_SIZE });

    const textX = MARGIN + QR_SIZE + 18;
    const textWidth = CONTENT_WIDTH - QR_SIZE - 18;
    let textY = qrTop + 6;
    for (const line of wrapText({
        text: content.qrHint,
        font: 'Helvetica-Bold',
        size: BODY_SIZE,
        maxWidth: textWidth
    })) {
        doc.drawText({
            text: line,
            x: textX,
            y: textY + BODY_SIZE,
            font: 'Helvetica-Bold',
            size: BODY_SIZE,
            color: BODY_FG
        });
        textY += BODY_SIZE * LEADING;
    }
    textY += 4;
    for (const line of wrapText({
        text: content.url,
        font: 'Helvetica',
        size: SMALL_SIZE,
        maxWidth: textWidth
    })) {
        doc.drawText({
            text: line,
            x: textX,
            y: textY + SMALL_SIZE,
            font: 'Helvetica',
            size: SMALL_SIZE,
            color: MUTED_FG
        });
        textY += SMALL_SIZE * LEADING;
    }
    cursor.advance({ by: QR_SIZE + 18 });

    // ── Footer ─────────────────────────────────────────────────────────────
    doc.drawText({
        text: content.footer,
        x: MARGIN,
        y: A4_HEIGHT - MARGIN + 8,
        font: 'Helvetica',
        size: SMALL_SIZE,
        color: MUTED_FG
    });

    return doc.toBytes();
}
