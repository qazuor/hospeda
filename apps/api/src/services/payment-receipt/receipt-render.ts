/**
 * Lays a payment receipt out on one portrait A4 page (HOS-2566, redesigned with
 * Hospeda's identity in HOS-2682).
 *
 * Structure, taken from the references the owner chose: a header with the logo
 * and a colour band, a big title, two columns (who paid / number and dates), a
 * concepts table with a coloured header row, a totals block with the total on a
 * highlighted band, a payment-details section, and a footer with Hospeda's
 * contact data.
 *
 * What the page SAYS comes from {@link buildReceiptContent}; this module only
 * places it. Colours are the brand's own, from `@repo/design-tokens` (through
 * the email palette `@repo/email` re-exports, the hex form of those tokens);
 * the mark is the owner's isotipo. The faces are the standard Helvetica pair:
 * the brand's Roboto/Geologica would need a font-embedding dependency the API
 * does not carry.
 *
 * The mechanism is the one every printable this API emits uses: `pdf-lib`, one
 * page. `toDrawableText` and `wrapText` are IMPORTED from the brochure renderer,
 * not copied: the WinAnsi substitution rule is a correctness property (a payer
 * name the face cannot encode would raise inside `pdf-lib` and answer a 500).
 *
 * Determinism: same receipt, same bytes. Nothing reads the clock; the document
 * dates are pinned to the epoch.
 *
 * @module services/payment-receipt/receipt-render
 */

import { emailPalette } from '@repo/email';
import {
    PageSizes,
    PDFDocument,
    type PDFFont,
    type PDFImage,
    type PDFPage,
    type RGB,
    rgb,
    StandardFonts
} from 'pdf-lib';
import { toDrawableText, wrapText } from '../listing-brochure/brochure-render.js';
import { buildReceiptContent, type ReceiptContent } from './receipt-content.js';
import { RECEIPT_COPY, RECEIPT_NON_FISCAL_NOTICE } from './receipt-copy.js';
import { EMPTY_RECEIPT_DETAILS, type ReceiptDetails } from './receipt-details-read.js';
import { getReceiptLogoPng } from './receipt-logo.js';
import type { OwnReceipt } from './receipt-read.js';

const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LEADING = 1.35;

function hex(value: string): RGB {
    const n = Number.parseInt(value.slice(1), 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Brand colours, all from the design tokens. */
const COLOR = {
    band: hex(emailPalette.brandStrong),
    accent: hex(emailPalette.brand),
    teal: hex(emailPalette.accentTeal),
    orange: hex(emailPalette.accentOrange),
    text: hex(emailPalette.text),
    muted: hex(emailPalette.mutedText),
    rule: hex(emailPalette.userFooterRule),
    tint: hex(emailPalette.userFooterBackground),
    onBand: hex(emailPalette.surface)
} as const;

interface Fonts {
    readonly regular: PDFFont;
    readonly bold: PDFFont;
}

interface Pen {
    readonly page: PDFPage;
    readonly fonts: Fonts;
}

interface TextInput {
    readonly value: string;
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly bold?: boolean;
    readonly color?: RGB;
    readonly align?: 'left' | 'right' | 'center';
}

/** Draws one line; `y` is measured from the TOP of the page, at the baseline. */
function text(pen: Pen, input: TextInput): void {
    const font = input.bold ? pen.fonts.bold : pen.fonts.regular;
    const drawable = toDrawableText({ text: input.value, font });
    const width = font.widthOfTextAtSize(drawable, input.size);
    const x =
        input.align === 'right'
            ? input.x - width
            : input.align === 'center'
              ? input.x - width / 2
              : input.x;
    pen.page.drawText(drawable, {
        x,
        y: PAGE_HEIGHT - input.y,
        size: input.size,
        font,
        color: input.color ?? COLOR.text
    });
}

/** A filled rectangle; `y` is its TOP edge measured from the top of the page. */
function box(
    pen: Pen,
    input: { x: number; y: number; width: number; height: number; color: RGB }
): void {
    pen.page.drawRectangle({
        x: input.x,
        y: PAGE_HEIGHT - input.y - input.height,
        width: input.width,
        height: input.height,
        color: input.color
    });
}

function rule(pen: Pen, input: { x: number; y: number; width: number; color?: RGB }): void {
    pen.page.drawLine({
        start: { x: input.x, y: PAGE_HEIGHT - input.y },
        end: { x: input.x + input.width, y: PAGE_HEIGHT - input.y },
        thickness: 0.75,
        color: input.color ?? COLOR.rule
    });
}

/** Wraps and caps a value, ending a cut one with an ellipsis so nothing runs off. */
function fitLines(
    pen: Pen,
    input: { value: string; size: number; maxWidth: number; maxLines: number; bold?: boolean }
): string[] {
    const font = input.bold ? pen.fonts.bold : pen.fonts.regular;
    const lines = wrapText({
        text: input.value,
        font,
        size: input.size,
        maxWidth: input.maxWidth
    });
    if (lines.length <= input.maxLines) return lines;
    const kept = lines.slice(0, input.maxLines);
    let last = kept[input.maxLines - 1] ?? '';
    const tooWide = (candidate: string) =>
        font.widthOfTextAtSize(toDrawableText({ text: `${candidate}…`, font }), input.size) >
        input.maxWidth;
    while (last.length > 1 && tooWide(last)) last = last.slice(0, -1);
    kept[input.maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
}

/** Header: colour band, isotipo, wordmark, tagline, title and number. */
function drawHeader(pen: Pen, input: { content: ReceiptContent; logo: PDFImage }): number {
    box(pen, { x: 0, y: 0, width: PAGE_WIDTH, height: 14, color: COLOR.band });
    box(pen, { x: PAGE_WIDTH - 150, y: 0, width: 90, height: 14, color: COLOR.teal });
    box(pen, { x: PAGE_WIDTH - 60, y: 0, width: 60, height: 14, color: COLOR.orange });

    const logoSize = 50;
    pen.page.drawImage(input.logo, {
        x: MARGIN,
        y: PAGE_HEIGHT - 44 - logoSize,
        width: logoSize,
        height: logoSize
    });
    const wordX = MARGIN + logoSize + 10;
    text(pen, {
        value: RECEIPT_COPY.brand,
        x: wordX,
        y: 72,
        size: 24,
        bold: true,
        color: COLOR.band
    });
    text(pen, { value: RECEIPT_COPY.tagline, x: wordX + 1, y: 88, size: 9.5, color: COLOR.muted });

    const right = PAGE_WIDTH - MARGIN;
    text(pen, { value: RECEIPT_COPY.title, x: right, y: 70, size: 22, bold: true, align: 'right' });
    text(pen, {
        value: input.content.numberLabel,
        x: right,
        y: 90,
        size: 12,
        bold: true,
        color: COLOR.accent,
        align: 'right'
    });

    box(pen, { x: MARGIN, y: 112, width: CONTENT_WIDTH, height: 3, color: COLOR.accent });
    return 142;
}

/** Two columns: who paid on the left, number and dates on the right. */
function drawParties(pen: Pen, input: { content: ReceiptContent; top: number }): number {
    const leftWidth = CONTENT_WIDTH * 0.56;
    const rightX = MARGIN + leftWidth + 24;
    const rightWidth = PAGE_WIDTH - MARGIN - rightX;

    let left = input.top;
    const block = (label: string, lines: readonly string[]) => {
        if (lines.length === 0) return;
        text(pen, {
            value: label.toUpperCase(),
            x: MARGIN,
            y: left,
            size: 9,
            bold: true,
            color: COLOR.accent
        });
        left += 18;
        lines.forEach((value, index) => {
            const first = index === 0;
            const size = first ? 12.5 : 10;
            for (const line of fitLines(pen, {
                value,
                size,
                maxWidth: leftWidth,
                maxLines: 2,
                bold: first
            })) {
                text(pen, {
                    value: line,
                    x: MARGIN,
                    y: left,
                    size,
                    bold: first,
                    color: first ? COLOR.text : COLOR.muted
                });
                left += size * LEADING;
            }
            left += 2;
        });
        left += 10;
    };
    block(RECEIPT_COPY.paidBy, input.content.paidBy);
    block(RECEIPT_COPY.account, input.content.account);

    let right = input.top;
    for (const field of input.content.meta) {
        text(pen, { value: field.label, x: rightX, y: right, size: 9.5, color: COLOR.muted });
        text(pen, {
            value: field.value,
            x: PAGE_WIDTH - MARGIN,
            y: right,
            size: 10.5,
            bold: true,
            align: 'right'
        });
        right += 6;
        rule(pen, { x: rightX, y: right, width: rightWidth });
        right += 15;
    }
    return Math.max(left, right) + 8;
}

/** Concepts table: coloured header row and the one concept row. */
function drawTable(pen: Pen, input: { content: ReceiptContent; top: number }): number {
    const { line } = input.content;
    const conceptWidth = CONTENT_WIDTH * 0.5;
    const periodX = MARGIN + conceptWidth + 12;
    const amountRight = PAGE_WIDTH - MARGIN - 12;
    const onBand = { size: 10, bold: true, color: COLOR.onBand } as const;

    box(pen, { x: MARGIN, y: input.top, width: CONTENT_WIDTH, height: 26, color: COLOR.band });
    const headY = input.top + 17;
    text(pen, { value: RECEIPT_COPY.tableConcept, x: MARGIN + 12, y: headY, ...onBand });
    text(pen, { value: RECEIPT_COPY.tablePeriod, x: periodX, y: headY, ...onBand });
    text(pen, {
        value: RECEIPT_COPY.tableAmount,
        x: amountRight,
        y: headY,
        ...onBand,
        align: 'right'
    });

    const innerWidth = conceptWidth - 12;
    const titleLines = fitLines(pen, {
        value: line.title,
        size: 11,
        maxWidth: innerWidth,
        maxLines: 2,
        bold: true
    });
    const subtitleLines = line.subtitle
        ? fitLines(pen, { value: line.subtitle, size: 9.5, maxWidth: innerWidth, maxLines: 2 })
        : [];
    const rowHeight = Math.max(40, 16 + titleLines.length * 15 + subtitleLines.length * 13);
    const rowTop = input.top + 26;
    box(pen, { x: MARGIN, y: rowTop, width: CONTENT_WIDTH, height: rowHeight, color: COLOR.tint });

    let y = rowTop + 20;
    for (const value of titleLines) {
        text(pen, { value, x: MARGIN + 12, y, size: 11, bold: true });
        y += 15;
    }
    for (const value of subtitleLines) {
        text(pen, { value, x: MARGIN + 12, y, size: 9.5, color: COLOR.muted });
        y += 13;
    }
    if (line.period) text(pen, { value: line.period, x: periodX, y: rowTop + 20, size: 10 });
    if (line.amount) {
        text(pen, {
            value: line.amount,
            x: amountRight,
            y: rowTop + 20,
            size: 11,
            bold: true,
            align: 'right'
        });
    }
    rule(pen, { x: MARGIN, y: rowTop + rowHeight, width: CONTENT_WIDTH, color: COLOR.band });
    return rowTop + rowHeight + 22;
}

/** Totals: breakdown lines and the total on a highlighted band. */
function drawTotals(pen: Pen, input: { content: ReceiptContent; top: number }): number {
    const width = 270;
    const x = PAGE_WIDTH - MARGIN - width;
    let y = input.top;
    for (const field of input.content.breakdown) {
        text(pen, { value: field.value, x: x + width - 12, y: y + 4, size: 10.5, align: 'right' });
        for (const label of fitLines(pen, {
            value: field.label,
            size: 10,
            maxWidth: width - 120,
            maxLines: 2
        })) {
            text(pen, { value: label, x: x + 12, y: y + 4, size: 10, color: COLOR.muted });
            y += 13;
        }
        y += 6;
    }
    const { total } = input.content;
    box(pen, { x, y, width, height: 34, color: COLOR.band });
    text(pen, {
        value: total.label,
        x: x + 12,
        y: y + 21,
        size: 11,
        bold: true,
        color: COLOR.onBand
    });
    if (total.value) {
        text(pen, {
            value: total.value,
            x: x + width - 12,
            y: y + 22,
            size: 14,
            bold: true,
            color: COLOR.onBand,
            align: 'right'
        });
    }
    box(pen, { x, y: y + 34, width, height: 3, color: COLOR.orange });
    return y + 60;
}

/** "Datos del pago" and the non-fiscal notice. */
function drawPayment(pen: Pen, input: { content: ReceiptContent; top: number }): void {
    const labelWidth = 120;
    text(pen, {
        value: RECEIPT_COPY.paymentDetails,
        x: MARGIN,
        y: input.top,
        size: 13,
        bold: true,
        color: COLOR.band
    });
    rule(pen, { x: MARGIN, y: input.top + 8, width: CONTENT_WIDTH });
    let y = input.top + 28;
    for (const field of input.content.payment) {
        text(pen, { value: field.label, x: MARGIN, y, size: 10, color: COLOR.muted });
        const lines = fitLines(pen, {
            value: field.value,
            size: 10.5,
            maxWidth: CONTENT_WIDTH - labelWidth,
            maxLines: 2,
            bold: true
        });
        for (const value of lines) {
            text(pen, { value, x: MARGIN + labelWidth, y, size: 10.5, bold: true });
            y += 10.5 * LEADING;
        }
        y += 5;
    }

    y += 12;
    const noticeLines = wrapText({
        text: RECEIPT_NON_FISCAL_NOTICE,
        font: pen.fonts.regular,
        size: 9.5,
        maxWidth: CONTENT_WIDTH - 32
    });
    const noticeHeight = 30 + noticeLines.length * 13;
    box(pen, { x: MARGIN, y, width: CONTENT_WIDTH, height: noticeHeight, color: COLOR.tint });
    box(pen, { x: MARGIN, y, width: 4, height: noticeHeight, color: COLOR.accent });
    text(pen, {
        value: RECEIPT_COPY.noticeTitle,
        x: MARGIN + 18,
        y: y + 18,
        size: 10,
        bold: true,
        color: COLOR.band
    });
    let noticeY = y + 33;
    for (const value of noticeLines) {
        text(pen, { value, x: MARGIN + 18, y: noticeY, size: 9.5 });
        noticeY += 13;
    }
}

/** Footer: thank-you line and the contact band. */
function drawFooter(pen: Pen, input: { content: ReceiptContent }): void {
    const bandHeight = 44;
    const bandTop = PAGE_HEIGHT - bandHeight;
    const center = PAGE_WIDTH / 2;
    text(pen, {
        value: RECEIPT_COPY.thanks,
        x: center,
        y: bandTop - 18,
        size: 11,
        bold: true,
        color: COLOR.band,
        align: 'center'
    });
    box(pen, { x: 0, y: bandTop, width: PAGE_WIDTH, height: bandHeight, color: COLOR.band });
    box(pen, { x: 0, y: bandTop, width: 60, height: 4, color: COLOR.orange });
    box(pen, { x: 60, y: bandTop, width: 90, height: 4, color: COLOR.teal });
    text(pen, {
        value: input.content.contact.join('   ·   '),
        x: center,
        y: bandTop + 27,
        size: 10,
        color: COLOR.onBand,
        align: 'center'
    });
}

/**
 * Renders a receipt as a PDF.
 *
 * @param input.receipt - The receipt to print.
 * @param input.details - What else is known about the payment; omitted, the
 *   document prints what the receipt row alone carries.
 * @returns The complete PDF file.
 */
export async function renderReceiptPdf(input: {
    readonly receipt: OwnReceipt;
    readonly details?: ReceiptDetails;
}): Promise<Uint8Array<ArrayBuffer>> {
    const content = buildReceiptContent({
        receipt: input.receipt,
        details: input.details ?? EMPTY_RECEIPT_DETAILS
    });

    const doc = await PDFDocument.create();
    doc.setTitle(`${RECEIPT_COPY.title} ${content.numberLabel}`);
    doc.setAuthor(RECEIPT_COPY.brand);
    doc.setProducer(RECEIPT_COPY.brand);
    doc.setCreator(RECEIPT_COPY.brand);
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));

    const fonts: Fonts = {
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold)
    };
    const logo = await doc.embedPng(getReceiptLogoPng());
    const pen: Pen = { page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), fonts };

    const afterHeader = drawHeader(pen, { content, logo });
    const afterParties = drawParties(pen, { content, top: afterHeader });
    const afterTable = drawTable(pen, { content, top: afterParties });
    const afterTotals = drawTotals(pen, { content, top: afterTable });
    drawPayment(pen, { content, top: afterTotals });
    drawFooter(pen, { content });

    // A fresh, ArrayBuffer-backed copy: `Response` wants a BufferSource.
    return new Uint8Array(await doc.save());
}
