/**
 * Lays a {@link CertificateContent} out on a landscape A4 sheet (HOS-1057).
 *
 * ---
 * WHAT THIS PAGE IS FOR
 *
 * A brochure is read at arm's length off a rack; a certificate is looked at
 * once, close up, and then pinned to a wall. So the two documents share a
 * mechanism and share almost no layout decision. This one is landscape, centred
 * on a single axis, and has exactly one thing the eye lands on: the name.
 * Everything above and below it is smaller than it, deliberately, including the
 * word "Certificado".
 *
 * ## The mechanism is HOS-1058's, and the primitives are literally its own
 *
 * `pdf-lib`, one A4 page, standard faces, the same vector QR. `toDrawableText`
 * and `wrapText` are IMPORTED from `commerce-brochure/brochure-render` rather
 * than copied: the WinAnsi substitution rule is a correctness property of every
 * PDF this API emits (a name the face cannot encode raises inside `pdf-lib` and
 * would answer a 500 to a download), and two copies of it would drift.
 *
 * ## Determinism
 *
 * Same certificate, same locale, same bytes. Nothing here reads the clock or
 * randomness; the document dates are pinned to the epoch, exactly as the
 * brochure's are, so a test can compare two runs directly.
 *
 * @module services/experience-certificate/certificate-render
 */

import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import {
    type Color,
    PageSizes,
    PDFDocument,
    type PDFFont,
    type PDFPage,
    rgb,
    StandardFonts
} from 'pdf-lib';
import { renderQrMatrix } from '../../utils/qr-render.js';
import { toDrawableText, wrapText } from '../commerce-brochure/brochure-render.js';
import type { CertificateContent } from './certificate-content.js';

/**
 * A4 in points, LANDSCAPE.
 *
 * `PageSizes.A4` is portrait, so the pair is swapped here once rather than at
 * every call site.
 */
const [A4_SHORT, A4_LONG] = PageSizes.A4;
const PAGE_WIDTH = A4_LONG;
const PAGE_HEIGHT = A4_SHORT;
const LANDSCAPE_A4: [number, number] = [PAGE_WIDTH, PAGE_HEIGHT];

/** Page margin, in points. Inside every desktop printer's dead zone. */
const MARGIN = 48;

/** Inset of the decorative rule from the page edge. */
const FRAME_INSET = 28;

/** Thickness of that rule. */
const FRAME_WIDTH = 2;

/** Usable width for centred copy. */
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Print palette.
 *
 * The same dark teal the brochure's header band uses, so the two documents read
 * as coming from one platform, and everything else is ink on white — a
 * certificate is photocopied and faxed more often than it is reprinted.
 */
const ACCENT = rgb(0.08, 0.22, 0.25);
const BODY_FG = rgb(0.13, 0.13, 0.13);
const MUTED_FG = rgb(0.38, 0.38, 0.38);
const QR_LIGHT = rgb(1, 1, 1);
const QR_DARK = rgb(0, 0, 0);

/** Type scale, in points. */
const TITLE_SIZE = 30;
const NAME_SIZE = 40;
const NAME_MIN_SIZE = 18;
const SUBJECT_SIZE = 20;
const BODY_SIZE = 12;
const SMALL_SIZE = 9;

/** Line height as a multiple of font size. */
const LEADING = 1.35;

/** Side of the printed QR, in points. ~25mm — small; the sheet is not a flyer. */
const QR_SIZE = 72;

/** Error correction of the printed QR: paper gets folded, scuffed and copied. */
const QR_ERROR_CORRECTION = QrCodeErrorCorrectionLevelEnum.M;

/** The two faces the sheet uses. */
interface CertificateFonts {
    readonly regular: PDFFont;
    readonly bold: PDFFont;
}

/** Width of `text` in points, after the substitutions `toDrawableText` makes. */
function measure(input: { text: string; font: PDFFont; size: number }): number {
    return input.font.widthOfTextAtSize(
        toDrawableText({ text: input.text, font: input.font }),
        input.size
    );
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
        y: PAGE_HEIGHT - input.y,
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
        y: PAGE_HEIGHT - (input.y + input.height),
        width: input.width,
        height: input.height,
        color: input.color,
        borderWidth: 0
    });
}

/**
 * Draws one line centred on the page, and returns the height it consumed.
 *
 * Centring is done by measuring rather than by a text-align option, because
 * `pdf-lib` has none: it positions a baseline at an `x`, and everything on this
 * page hangs off the page's own centre line.
 */
function drawCentredLine(input: {
    page: PDFPage;
    text: string;
    y: number;
    font: PDFFont;
    size: number;
    color: Color;
}): number {
    const width = measure({ text: input.text, font: input.font, size: input.size });
    drawTextTopDown({
        page: input.page,
        text: input.text,
        x: (PAGE_WIDTH - width) / 2,
        y: input.y + input.size,
        font: input.font,
        size: input.size,
        color: input.color
    });
    return input.size * LEADING;
}

/**
 * Draws a centred paragraph, wrapping inside the content column.
 *
 * @returns The total height it consumed.
 */
function drawCentredParagraph(input: {
    page: PDFPage;
    text: string;
    y: number;
    font: PDFFont;
    size: number;
    color: Color;
    maxWidth?: number;
}): number {
    const lines = wrapText({
        text: input.text,
        font: input.font,
        size: input.size,
        maxWidth: input.maxWidth ?? CONTENT_WIDTH
    });
    let consumed = 0;
    for (const line of lines) {
        consumed += drawCentredLine({
            page: input.page,
            text: line,
            y: input.y + consumed,
            font: input.font,
            size: input.size,
            color: input.color
        });
    }
    return consumed;
}

/**
 * Draws the QR as filled rectangles.
 *
 * Vector rather than a raster image, for the reason the brochure's own QR is:
 * a QR is the one graphic where resampling costs scans. Horizontal runs of dark
 * modules are merged into a single rectangle.
 *
 * The grid comes from `utils/qr-render.ts`, the one module in this repo allowed
 * to import `qrcode` (HOS-1129), and what it encodes is the platform's own
 * `/qr/{slug}/` redirect rather than the experience's public URL. A framed
 * certificate is the least correctable printed surface there is.
 */
function drawQr(input: { page: PDFPage; url: string; x: number; y: number; size: number }): void {
    const { page, x, y, size } = input;
    const qr = renderQrMatrix({
        data: input.url,
        errorCorrectionLevel: QR_ERROR_CORRECTION
    });
    const count = qr.size;
    const module = size / count;

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
 * Draws the four rules that frame the page.
 *
 * Four thin filled rectangles rather than a stroked rectangle, so the corners
 * meet exactly and the thickness is not affected by `pdf-lib`'s stroke
 * centring.
 */
function drawFrame(page: PDFPage): void {
    const width = PAGE_WIDTH - FRAME_INSET * 2;
    const height = PAGE_HEIGHT - FRAME_INSET * 2;
    const sides = [
        { x: FRAME_INSET, y: FRAME_INSET, width, height: FRAME_WIDTH },
        { x: FRAME_INSET, y: FRAME_INSET + height - FRAME_WIDTH, width, height: FRAME_WIDTH },
        { x: FRAME_INSET, y: FRAME_INSET, width: FRAME_WIDTH, height },
        { x: FRAME_INSET + width - FRAME_WIDTH, y: FRAME_INSET, width: FRAME_WIDTH, height }
    ];
    for (const side of sides) {
        drawRectTopDown({ page, ...side, color: ACCENT });
    }
}

/**
 * Renders a certificate.
 *
 * @param input.content - What to print.
 * @param input.qrUrl - What the QR encodes: `{site}/qr/{qrSlug}/`, the
 *   platform's own redirect (HOS-1129). Distinct from `content.publicUrl`,
 *   which is where that redirect LANDS. Resolving it needs the database, so it
 *   is passed in and this function stays a pure function of its inputs.
 * @returns The complete PDF file.
 */
export async function renderCertificatePdf(input: {
    content: CertificateContent;
    qrUrl: string;
}): Promise<Uint8Array<ArrayBuffer>> {
    const { content, qrUrl } = input;

    const doc = await PDFDocument.create();
    doc.setTitle(`${content.title} — ${content.recipientName}`);
    doc.setProducer('Hospeda');
    doc.setCreator('Hospeda');
    // Pinned rather than `now`: see "Determinism" above.
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    const fonts: CertificateFonts = {
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold)
    };

    const page = doc.addPage(LANDSCAPE_A4);
    drawFrame(page);

    let y = 96;

    y += drawCentredLine({
        page,
        text: content.title,
        y,
        font: fonts.bold,
        size: TITLE_SIZE,
        color: ACCENT
    });
    y += 26;

    y += drawCentredParagraph({
        page,
        text: content.preamble,
        y,
        font: fonts.regular,
        size: BODY_SIZE,
        color: MUTED_FG
    });
    y += 16;

    // The name is the one string allowed to SHRINK rather than wrap. A wrapped
    // name reads as two people, and the field is bounded at 120 characters, so
    // shrinking always terminates well above the floor.
    let nameSize = NAME_SIZE;
    while (
        nameSize > NAME_MIN_SIZE &&
        measure({ text: content.recipientName, font: fonts.bold, size: nameSize }) > CONTENT_WIDTH
    ) {
        nameSize -= 1;
    }
    y += drawCentredParagraph({
        page,
        text: content.recipientName,
        y,
        font: fonts.bold,
        size: nameSize,
        color: BODY_FG
    });
    y += 22;

    y += drawCentredParagraph({
        page,
        text: content.connector,
        y,
        font: fonts.regular,
        size: BODY_SIZE,
        color: MUTED_FG
    });
    y += 10;

    y += drawCentredParagraph({
        page,
        text: content.experienceName,
        y,
        font: fonts.bold,
        size: SUBJECT_SIZE,
        color: ACCENT
    });
    y += 18;

    y += drawCentredParagraph({
        page,
        text: content.dateLine,
        y,
        font: fonts.regular,
        size: BODY_SIZE,
        color: BODY_FG
    });

    // ── QR and footer ──────────────────────────────────────────────────────
    // Anchored to the FOOT of the page rather than to the flowing cursor: the
    // block above varies in height with the name and the issuer line, and a QR
    // that moves up and down between two certificates of the same provider
    // looks like two different documents.
    const qrTop = PAGE_HEIGHT - MARGIN - QR_SIZE;
    const qrLeft = PAGE_WIDTH - MARGIN - QR_SIZE;
    drawQr({ page, url: qrUrl, x: qrLeft, y: qrTop, size: QR_SIZE });

    drawTextTopDown({
        page,
        text: content.qrHint,
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN - QR_SIZE + SMALL_SIZE,
        font: fonts.regular,
        size: SMALL_SIZE,
        color: MUTED_FG
    });
    drawTextTopDown({
        page,
        text: content.footer,
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN,
        font: fonts.bold,
        size: SMALL_SIZE,
        color: ACCENT
    });

    // A fresh, `ArrayBuffer`-backed copy: `Response` wants a `BufferSource`, and
    // the generically-backed `Uint8Array` `save()` returns is not assignable.
    return new Uint8Array(await doc.save());
}
