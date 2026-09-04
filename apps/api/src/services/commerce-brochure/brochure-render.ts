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
 * ## Why `pdf-lib` and not a writer of our own
 *
 * There was one, and it worked until it met the CDN. Its JPEG path embedded the
 * file verbatim as `DCTDecode` and therefore had to vet the frame header first,
 * which meant refusing every *progressive* JPEG — the format Cloudinary
 * actually serves — and printing the sheet with no photo at all. PNG it could
 * not carry in any form. `pdf-lib` parses both, is pure JavaScript with no
 * native build, bundles cleanly through esbuild, and brings its own types; what
 * it replaces is ~900 lines of writer, Adobe metric table and marker parser.
 *
 * ## Coordinates
 *
 * The layout below is written top-down — `y` grows toward the foot of the page,
 * which is how a document reads — while PDF's own origin is the bottom-left
 * corner. The two `drawTextTopDown` / `drawRectTopDown` helpers are the only
 * places that flip, so no layout constant has to be read upside down.
 *
 * ## Determinism
 *
 * Same listing, same locale, same bytes. Nothing here reads the clock or
 * randomness, and the document's dates are pinned to the epoch rather than
 * taken from `Date.now()` — so a caching layer, an ETag, or a test can compare
 * two runs directly.
 *
 * @module services/commerce-brochure/brochure-render
 */

import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import {
    type Color,
    PageSizes,
    PDFDocument,
    type PDFFont,
    type PDFImage,
    type PDFPage,
    rgb,
    StandardFonts
} from 'pdf-lib';
import { apiLogger } from '../../utils/logger.js';
import { renderQrMatrix } from '../../utils/qr-render.js';
import type { BrochureContent } from './brochure-content.js';
import type { BrochureCover } from './brochure-cover.js';

/** A4 in points, as PDF measures it. */
const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4;

/** Page margin, in points. ~17mm, inside every desktop printer's dead zone. */
const MARGIN = 48;

/** Usable column width. */
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

/** Height of the coloured header band. */
const HEADER_HEIGHT = 96;

/** Print palette. Dark ink on white — a colour brochure must survive a b/w copier. */
const HEADER_BG = rgb(0.08, 0.22, 0.25);
const HEADER_FG = rgb(1, 1, 1);
const BODY_FG = rgb(0.13, 0.13, 0.13);
const MUTED_FG = rgb(0.38, 0.38, 0.38);
const RULE_FG = rgb(0.85, 0.85, 0.85);
const QR_LIGHT = rgb(1, 1, 1);
const QR_DARK = rgb(0, 0, 0);

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
const QR_ERROR_CORRECTION = QrCodeErrorCorrectionLevelEnum.M;

/** Max height of the cover photo. Leaves room for text on the same page. */
const COVER_MAX_HEIGHT = 180;

/** What a character this font cannot draw is replaced with. */
const UNDRAWABLE = '?';

/** The two faces the sheet uses. */
interface BrochureFonts {
    readonly regular: PDFFont;
    readonly bold: PDFFont;
}

/** Everything the renderer needs beyond the content itself. */
export interface BrochureRenderInput {
    readonly content: BrochureContent;
    /**
     * The cover photo, already fetched and typed, or `null`. Fetching happens
     * outside so this function's only I/O is what `pdf-lib` does in memory.
     */
    readonly cover: BrochureCover | null;
    /**
     * What the QR encodes: `{site}/qr/{qrSlug}/`, the platform's own redirect
     * (HOS-1129).
     *
     * Separate from `content.url`, which is the listing's real address and is
     * where this redirect LANDS. Nothing on the sheet draws `content.url` any
     * more: the readable line beside the code is the bare domain, taken from
     * this value's host (see `printedDomain`). Resolving this one needs the
     * database, so it is passed in rather than derived here: the renderer stays
     * a pure function of its inputs.
     */
    readonly qrUrl: string;
}

/**
 * Remembers, per face, which characters the font can actually encode.
 *
 * The predicate is the library's own — `encodeText` throws for anything outside
 * WinAnsi — rather than a table of ours that could drift from it. Memoised
 * because a brochure repeats a hundred-odd distinct characters thousands of
 * times, and because the negative answer arrives as an exception.
 */
const encodableByFont = new WeakMap<PDFFont, Map<string, boolean>>();

/** Whether `font` can draw `char`. */
function canEncode(input: { font: PDFFont; char: string }): boolean {
    const { font, char } = input;
    let cache = encodableByFont.get(font);
    if (!cache) {
        cache = new Map();
        encodableByFont.set(font, cache);
    }
    const known = cache.get(char);
    if (known !== undefined) {
        return known;
    }
    let ok: boolean;
    try {
        font.encodeText(char);
        ok = true;
    } catch {
        ok = false;
    }
    cache.set(char, ok);
    return ok;
}

/**
 * Makes a string safe to draw with a standard font.
 *
 * A listing name is owner-typed and can carry anything; the standard faces
 * cover WinAnsi and no more, and `pdf-lib` raises rather than guessing — an
 * uncaught raise here would answer a 500 to a download. Dropping the character
 * would silently change a word, so it becomes a visible `?`, and a newline
 * becomes a space, since a literal newline positions nothing.
 *
 * @param input.text - Raw copy.
 * @param input.font - The face it will be drawn with.
 * @returns A string every character of which this face can encode.
 */
export function toDrawableText(input: { text: string; font: PDFFont }): string {
    let out = '';
    for (const char of input.text.replace(/[\r\n\t]/g, ' ')) {
        out += canEncode({ font: input.font, char }) ? char : UNDRAWABLE;
    }
    return out;
}

/** Width of `text` in points, after the substitutions {@link toDrawableText} makes. */
function measure(input: { text: string; font: PDFFont; size: number }): number {
    return input.font.widthOfTextAtSize(
        toDrawableText({ text: input.text, font: input.font }),
        input.size
    );
}

/**
 * Greedy word wrap inside `maxWidth`.
 *
 * A word that does not fit on a line of its own — a long URL in the contact
 * block — is broken by character rather than allowed to run off the paper.
 *
 * @param input.text - The paragraph to wrap.
 * @param input.font - The face it will be drawn with.
 * @param input.size - Font size, in points.
 * @param input.maxWidth - Column width, in points.
 * @returns One string per line; empty for whitespace-only input.
 */
export function wrapText(input: {
    text: string;
    font: PDFFont;
    size: number;
    maxWidth: number;
}): string[] {
    const { font, size, maxWidth } = input;
    const words = input.text.split(/\s+/).filter((word) => word.length > 0);
    const lines: string[] = [];
    let current = '';

    /** Splits an over-wide token, emitting every full line but the last. */
    const breakWord = (word: string): string => {
        let chunk = '';
        for (const char of word) {
            if (chunk && measure({ text: chunk + char, font, size }) > maxWidth) {
                lines.push(chunk);
                chunk = char;
            } else {
                chunk += char;
            }
        }
        return chunk;
    };

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (measure({ text: candidate, font, size }) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) {
            lines.push(current);
            current = '';
        }
        current = measure({ text: word, font, size }) > maxWidth ? breakWord(word) : word;
    }
    if (current) {
        lines.push(current);
    }
    return lines;
}

/** Draws text whose `y` is the baseline measured from the TOP of the page. */
function drawTextTopDown(input: {
    page: PDFPage;
    text: string;
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: Color;
}): void {
    input.page.drawText(toDrawableText({ text: input.text, font: input.font }), {
        x: input.x,
        y: A4_HEIGHT - input.y,
        size: input.size,
        font: input.font,
        color: input.color
    });
}

/** Draws a filled rectangle whose `y` is its TOP edge. */
function drawRectTopDown(input: {
    page: PDFPage;
    x: number;
    y: number;
    width: number;
    height: number;
    color: Color;
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

/** A cursor walking down the page, opening new ones as it runs out. */
class PageCursor {
    private y: number;
    private current: PDFPage;

    constructor(
        private readonly doc: PDFDocument,
        page: PDFPage,
        startY: number
    ) {
        this.current = page;
        this.y = startY;
    }

    /** The page being drawn on right now. */
    get page(): PDFPage {
        return this.current;
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
        this.current = this.doc.addPage(PageSizes.A4);
        this.y = MARGIN;
        return true;
    }
}

/** Draws one wrapped paragraph and moves the cursor past it. */
function drawParagraph(input: {
    cursor: PageCursor;
    text: string;
    font: PDFFont;
    size: number;
    color: Color;
}): void {
    const { cursor, font, size } = input;
    const lines = wrapText({ text: input.text, font, size, maxWidth: CONTENT_WIDTH });
    const lineHeight = size * LEADING;
    for (const line of lines) {
        cursor.reserve({ height: lineHeight });
        // `y` is the baseline: sit it at the bottom of the line box.
        drawTextTopDown({
            page: cursor.page,
            text: line,
            x: MARGIN,
            y: cursor.top + size,
            font,
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
 *
 * The grid comes from `utils/qr-render.ts`, the one module in this repo allowed
 * to import `qrcode` (HOS-1129). What is drawn is `content.qrUrl` — the
 * platform's own `/qr/{slug}/` redirect, never the listing's final URL: ink is
 * not editable, and a code that points at us is a code we can repoint and
 * count.
 */
/**
 * What the readable line beside the QR says, when `qrUrl` cannot be parsed.
 *
 * A brochure must print something rather than a blank line, and this is the one
 * string on the sheet that is true regardless of any row in any table.
 */
const FALLBACK_PRINTED_DOMAIN = 'hospeda.com.ar';

/**
 * The bare domain printed under the QR hint.
 *
 * DELIBERATELY the domain and NOT the listing's ficha — resist the urge to
 * "improve" this by putting the full URL back. The symbol beside it is
 * correctable (it encodes `/qr/{slug}/`, which we can repoint); the ink is not.
 * Printing the deep address makes the two AGE DIFFERENTLY: the day the ficha
 * moves the QR keeps working and the line under it is dead, on the same piece
 * of paper, with nothing on the page to say which half to trust.
 *
 * Printing `/qr/{slug}/` instead would remove that asymmetry and cost the whole
 * point of the line, which is the reader who cannot scan: nobody types,
 * remembers or recognises an opaque identifier. The bare domain keeps that
 * reader — the business's name is already set large at the top of the sheet, so
 * the domain is enough to get there — and cannot die, because it points at
 * nothing that can move. The accepted cost is that it stops being a direct
 * link.
 *
 * Derived from `qrUrl` rather than taken from `content.url`, so the listing's
 * real address no longer travels into the renderer merely to be printed.
 */
function printedDomain(qrUrl: string): string {
    try {
        return new URL(qrUrl).host;
    } catch {
        return FALLBACK_PRINTED_DOMAIN;
    }
}

function drawQr(input: { page: PDFPage; url: string; x: number; y: number; size: number }): void {
    const { page, x, y, size } = input;
    const qr = renderQrMatrix({
        data: input.url,
        errorCorrectionLevel: QR_ERROR_CORRECTION
    });
    const count = qr.size;
    const module = size / count;

    // White ground: the quiet zone is drawn by the caller's layout, but a
    // scanner needs the symbol itself on white even if the page ever gains a
    // tinted panel behind it.
    drawRectTopDown({ page, x, y, width: size, height: size, color: QR_LIGHT });

    for (let row = 0; row < count; row += 1) {
        let runStart = -1;
        for (let col = 0; col <= count; col += 1) {
            const dark = qr.isDark(row, col);
            if (dark && runStart === -1) {
                runStart = col;
            } else if (!dark && runStart !== -1) {
                drawRectTopDown({
                    page,
                    x: x + runStart * module,
                    y: y + row * module,
                    width: (col - runStart) * module,
                    height: module,
                    color: QR_DARK
                });
                runStart = -1;
            }
        }
    }
}

/**
 * Embeds the cover, or gives up on it.
 *
 * `pdf-lib` is the only thing that decides whether these bytes are embeddable,
 * and it says so by throwing. Same contract as the fetch: a photo is never
 * worth the document.
 */
async function embedCover(input: {
    doc: PDFDocument;
    cover: BrochureCover;
}): Promise<PDFImage | null> {
    const { doc, cover } = input;
    try {
        return cover.format === 'png'
            ? await doc.embedPng(cover.bytes)
            : await doc.embedJpg(cover.bytes);
    } catch (error) {
        apiLogger.warn(
            {
                format: cover.format,
                bytes: cover.bytes.byteLength,
                error: error instanceof Error ? error.message : String(error)
            },
            'brochure cover image could not be embedded — printing without it'
        );
        return null;
    }
}

/**
 * Renders a brochure.
 *
 * @param input.content - What to print.
 * @param input.cover - The cover photo, or `null` to print without one.
 * @returns The complete PDF file.
 */
export async function renderBrochurePdf(
    input: BrochureRenderInput
): Promise<Uint8Array<ArrayBuffer>> {
    const { content, cover, qrUrl } = input;
    const doc = await PDFDocument.create();
    doc.setTitle(content.title);
    doc.setProducer('Hospeda');
    doc.setCreator('Hospeda');
    // Pinned rather than `now`: see "Determinism" above.
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    const fonts: BrochureFonts = {
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold)
    };

    const image = cover ? await embedCover({ doc, cover }) : null;
    const page = doc.addPage(PageSizes.A4);

    // ── Header band ────────────────────────────────────────────────────────
    drawRectTopDown({ page, x: 0, y: 0, width: A4_WIDTH, height: HEADER_HEIGHT, color: HEADER_BG });

    // The title is the one string allowed to shrink rather than wrap: a
    // two-line name pushes the subtitle out of the band.
    let titleSize = TITLE_SIZE;
    while (
        titleSize > 13 &&
        measure({ text: content.title, font: fonts.bold, size: titleSize }) > CONTENT_WIDTH
    ) {
        titleSize -= 1;
    }
    drawTextTopDown({
        page,
        text: content.title,
        x: MARGIN,
        y: 52,
        font: fonts.bold,
        size: titleSize,
        color: HEADER_FG
    });
    if (content.subtitle) {
        drawTextTopDown({
            page,
            text: content.subtitle,
            x: MARGIN,
            y: 74,
            font: fonts.regular,
            size: SUBTITLE_SIZE,
            color: HEADER_FG
        });
    }

    const cursor = new PageCursor(doc, page, HEADER_HEIGHT + 24);

    // ── Cover photo ────────────────────────────────────────────────────────
    if (image) {
        const scale = Math.min(CONTENT_WIDTH / image.width, COVER_MAX_HEIGHT / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        cursor.page.drawImage(image, {
            // Centred: a portrait photo letterboxes rather than stretches, and
            // a stretched storefront is worse than a narrow one.
            x: MARGIN + (CONTENT_WIDTH - width) / 2,
            y: A4_HEIGHT - (cursor.top + height),
            width,
            height
        });
        cursor.advance({ by: height + 20 });
    }

    // ── Price ──────────────────────────────────────────────────────────────
    if (content.price) {
        drawParagraph({
            cursor,
            text: content.price,
            font: fonts.bold,
            size: HEADING_SIZE,
            color: BODY_FG
        });
        cursor.advance({ by: 6 });
    }

    // ── Intro ──────────────────────────────────────────────────────────────
    if (content.intro) {
        drawParagraph({
            cursor,
            text: content.intro,
            font: fonts.regular,
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
        drawRectTopDown({
            page: cursor.page,
            x: MARGIN,
            y: cursor.top,
            width: CONTENT_WIDTH,
            height: 0.6,
            color: RULE_FG
        });
        cursor.advance({ by: 10 });
        drawParagraph({
            cursor,
            text: section.heading,
            font: fonts.bold,
            size: HEADING_SIZE,
            color: BODY_FG
        });
        cursor.advance({ by: 2 });
        for (const line of section.lines) {
            drawParagraph({
                cursor,
                text: line,
                font: fonts.regular,
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
    drawQr({ page: cursor.page, url: qrUrl, x: MARGIN, y: qrTop, size: QR_SIZE });

    const textX = MARGIN + QR_SIZE + 18;
    const textWidth = CONTENT_WIDTH - QR_SIZE - 18;
    let textY = qrTop + 6;
    for (const line of wrapText({
        text: content.qrHint,
        font: fonts.bold,
        size: BODY_SIZE,
        maxWidth: textWidth
    })) {
        drawTextTopDown({
            page: cursor.page,
            text: line,
            x: textX,
            y: textY + BODY_SIZE,
            font: fonts.bold,
            size: BODY_SIZE,
            color: BODY_FG
        });
        textY += BODY_SIZE * LEADING;
    }
    textY += 4;
    // The bare domain, not the ficha's address — see `printedDomain`. Paper is
    // not correctable and a deep URL printed beside a redirectable symbol ages
    // differently from it.
    for (const line of wrapText({
        text: printedDomain(qrUrl),
        font: fonts.regular,
        size: SMALL_SIZE,
        maxWidth: textWidth
    })) {
        drawTextTopDown({
            page: cursor.page,
            text: line,
            x: textX,
            y: textY + SMALL_SIZE,
            font: fonts.regular,
            size: SMALL_SIZE,
            color: MUTED_FG
        });
        textY += SMALL_SIZE * LEADING;
    }
    cursor.advance({ by: QR_SIZE + 18 });

    // ── Footer ─────────────────────────────────────────────────────────────
    drawTextTopDown({
        page: cursor.page,
        text: content.footer,
        x: MARGIN,
        y: A4_HEIGHT - MARGIN + 8,
        font: fonts.regular,
        size: SMALL_SIZE,
        color: MUTED_FG
    });

    // A fresh, `ArrayBuffer`-backed copy: `Response` wants a `BufferSource`, and
    // the generically-backed `Uint8Array` `save()` returns is not assignable.
    return new Uint8Array(await doc.save());
}
