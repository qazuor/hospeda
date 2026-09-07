/**
 * Lays a {@link ListingQrSheetContent} out on A4 and returns the PDF bytes
 * (HOS-982).
 *
 * ---
 * WHAT THIS PAGE IS FOR
 *
 * It goes on a door, on a counter, or on a table, and it is read by somebody
 * walking past. That single fact decides every constant in this file, so they
 * are written down here rather than left as taste.
 *
 * ## The QR's size, and the distance it is meant to work at
 *
 * A QR is read when its smallest feature — one module — survives the camera's
 * resolution at the reading distance. The working rule of thumb in the printing
 * trade is that a symbol scans reliably at about TEN TIMES its own side: a 30mm
 * code at 30cm, a 100mm code at a metre.
 *
 * The distance this sheet has to work at is "somebody standing in front of a
 * door, phone in hand" — call it 1.0m to 1.2m. Ten times gives 100-120mm, so
 * {@link QR_SIZE} is 320pt ≈ 113mm, the largest square that leaves room on A4
 * for a name big enough to read from the same distance. That is roughly three
 * and a half times the brochure's 92pt code, which is correct: the brochure is
 * held at arm's length and this is not.
 *
 * The second floor is the printer's, not the reader's: a home inkjet or laser
 * cannot hold a feature much under 0.3mm, and a scanner wants a module of at
 * least ~0.5mm to be safe. The redirect this encodes is short (roughly
 * `https://hospeda.com.ar/qr/XXXXXXXX/`, ~35 bytes), which at level Q lands
 * around a 37-module symbol — so 320pt / 37 ≈ 8.6pt ≈ 3mm per module, six times
 * the safe floor. There is no realistic slug length that brings it near it.
 *
 * ## Error correction: Q, where the brochure uses M
 *
 * {@link QR_ERROR_CORRECTION} is Q (~25% recoverable) rather than the M
 * (~15%) that goes on paper handed to a person. This sheet gets taped up, rained
 * on through a doorway, scuffed by a passing shoulder, and eventually has a
 * corner covered by whatever else gets stuck to the same door. Level Q is what
 * survives a covered corner.
 *
 * It costs nothing here. A denser symbol only matters when the modules are
 * getting small, and at 320pt they are not: the whole reason M is the sensible
 * default elsewhere is that a 92pt brochure code cannot afford the extra
 * modules.
 *
 * ## It has to work in black and white
 *
 * Most of these are printed on whatever printer the business has. So there is no
 * colour in this file at all — every ink below is black or a grey — and the
 * design carries its structure through SIZE and WEIGHT rather than through
 * colour. A page that leans on a coloured band goes flat grey on a laser and
 * takes the code's contrast down with it, which is the one failure that makes
 * the sheet useless rather than ugly.
 *
 * ## Quiet zone
 *
 * `renderQrMatrix` returns the symbol WITHOUT its quiet zone — that is the
 * caller's problem, because only the caller knows what is behind the code. Here
 * it is four modules of white on every side, reserved in the layout so no
 * headline or invitation can creep into it. A code with no quiet zone is a code
 * many scanners simply refuse.
 *
 * ## Determinism
 *
 * Same listing, same locale, same bytes. Nothing here reads the clock or a
 * random source, and the document's dates are pinned to the epoch — so a caching
 * layer, an ETag, or a test can compare two runs directly.
 *
 * @module services/listing-qr-sheet/qr-sheet-render
 */

import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { PageSizes, PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { type QrModuleMatrix, renderQrMatrix } from '../../utils/qr-render.js';
// `wrapText` is imported rather than re-implemented: it is generic PDF text
// mechanics (greedy wrapping with a character-level break for an over-wide
// token), not brochure policy, and a second copy would drift the first time
// either page learned something about fitting text.
import { wrapText } from '../commerce-brochure/brochure-render.js';
import type { ListingQrSheetContent } from './qr-sheet-content.js';
import {
    A4_WIDTH,
    CONTENT_HEIGHT,
    CONTENT_WIDTH,
    drawCentredLine,
    drawRectTopDown,
    MARGIN,
    withEllipsis
} from './qr-sheet-page.js';

/**
 * Side of the printed QR, in points. 320pt ≈ 113mm — see the module docblock
 * for the scan distance this is sized for.
 */
export const QR_SIZE = 320;

/** Error correction of the printed QR. See the module docblock for why Q. */
export const QR_ERROR_CORRECTION = QrCodeErrorCorrectionLevelEnum.Q;

/** Quiet zone around the symbol, in MODULES. Four is the specification's floor. */
const QR_QUIET_MODULES = 4;

/** Every ink on this page is black or a grey — see "black and white" above. */
const INK = rgb(0, 0, 0);
const MUTED_INK = rgb(0.35, 0.35, 0.35);
const RULE_INK = rgb(0.75, 0.75, 0.75);
const PAPER = rgb(1, 1, 1);

/** Type scale, in points. */
const NAME_SIZE_MAX = 30;
const NAME_SIZE_MIN = 15;
const HEADLINE_SIZE = 18;
const INVITE_SIZE = 12;
const BRAND_SIZE = 15;
const TAGLINE_SIZE = 9;
const DOMAIN_SIZE = 11;

/** Line height as a multiple of font size. */
const LEADING = 1.35;

/** The name may take two lines and no more; past that it shrinks instead. */
const NAME_MAX_LINES = 2;

/** The invitation is a sentence, not a paragraph. */
const INVITE_MAX_LINES = 3;

/** Column the invitation wraps inside — narrower than the page, so it reads as a caption. */
const INVITE_WIDTH = 380;

/** Gaps between the blocks, in points. */
const GAP_NAME_TO_HEADLINE = 14;
const GAP_HEADLINE_TO_QR = 18;
const GAP_QR_TO_INVITE = 18;
const GAP_INVITE_TO_RULE = 26;
const GAP_RULE_TO_BRAND = 14;
const GAP_BRAND_TO_TAGLINE = 2;
const GAP_TAGLINE_TO_DOMAIN = 6;

/** Thickness of the hairline above the brand block. */
const RULE_HEIGHT = 0.8;

/**
 * What the readable line at the foot says when `qrUrl` cannot be parsed.
 *
 * A printed sheet must carry something rather than a blank line, and this is the
 * one string on the page that is true regardless of any row in any table.
 */
const FALLBACK_PRINTED_DOMAIN = 'hospeda.com.ar';

/** The two faces the sheet uses. */
interface SheetFonts {
    readonly regular: PDFFont;
    readonly bold: PDFFont;
}

/** Everything the renderer needs beyond the copy itself. */
export interface ListingQrSheetRenderInput {
    readonly content: ListingQrSheetContent;
    /**
     * What the QR encodes: `{site}/qr/{qrSlug}/`, the platform's own redirect
     * (HOS-981).
     *
     * Separate from `content.url`, which is the ficha's real address and is
     * where this redirect LANDS. Nothing on this sheet draws `content.url`:
     * paper is not correctable, and a deep address printed beside a redirectable
     * symbol ages differently from it. Resolving this one needs the database, so
     * it is passed in rather than derived here — the renderer stays a pure
     * function of its inputs.
     */
    readonly qrUrl: string;
}

/**
 * The bare domain printed at the foot of the sheet.
 *
 * DELIBERATELY the domain and NOT the ficha's address — the same decision the
 * brochure made (HOS-1129) and for the same reason. The symbol above it is
 * correctable, because it encodes `/qr/{slug}/` and we own the row that resolves
 * it; the ink is not. Printing the deep address makes the two AGE DIFFERENTLY:
 * the day the ficha moves, the code keeps working and the line under it is dead,
 * on the same piece of paper, with nothing to say which half to trust.
 *
 * Printing `/qr/{slug}/` instead would remove that asymmetry and cost the reader
 * who cannot scan — nobody types or remembers an opaque identifier. The bare
 * domain keeps that reader and cannot die, because it points at nothing that can
 * move.
 *
 * Derived from `qrUrl` rather than from `content.url`, so the ficha's real
 * address never travels into the renderer merely to be printed.
 */
function printedDomain(qrUrl: string): string {
    try {
        return new URL(qrUrl).host;
    } catch {
        return FALLBACK_PRINTED_DOMAIN;
    }
}

/**
 * The largest size at which the name fits in {@link NAME_MAX_LINES} lines.
 *
 * A business name is owner-typed and can be three words or fifteen. Wrapping it
 * without a floor would push the QR off the page; shrinking it without a floor
 * would print a name nobody can read from the distance the code is sized for. So
 * it shrinks to {@link NAME_SIZE_MIN} and then wraps, which is the failure that
 * still yields a usable sheet.
 *
 * Past that floor the name is CUT, and the cut is marked — see
 * {@link withEllipsis}. Two lines at {@link NAME_SIZE_MIN} hold ~132 characters
 * of Latin script, so a name has to be longer than that to reach it.
 */
function fitNameLines(input: { name: string; font: PDFFont }): {
    readonly size: number;
    readonly lines: readonly string[];
} {
    for (let size = NAME_SIZE_MAX; size > NAME_SIZE_MIN; size -= 1) {
        const lines = wrapText({
            text: input.name,
            font: input.font,
            size,
            maxWidth: CONTENT_WIDTH
        });
        if (lines.length <= NAME_MAX_LINES) {
            return { size, lines };
        }
    }

    const wrapped = wrapText({
        text: input.name,
        font: input.font,
        size: NAME_SIZE_MIN,
        maxWidth: CONTENT_WIDTH
    });
    if (wrapped.length <= NAME_MAX_LINES) {
        return { size: NAME_SIZE_MIN, lines: wrapped };
    }

    const kept = wrapped.slice(0, NAME_MAX_LINES);
    kept[NAME_MAX_LINES - 1] = withEllipsis({
        line: kept[NAME_MAX_LINES - 1] ?? '',
        font: input.font,
        size: NAME_SIZE_MIN
    });
    return { size: NAME_SIZE_MIN, lines: kept };
}

/**
 * Draws the QR as filled rectangles, centred on the page.
 *
 * Vector rather than a raster image: a QR is the one graphic where resampling
 * costs scans, and the module grid is cheaper to express as rectangles than as
 * an embedded bitmap. Horizontal runs of dark modules are merged into a single
 * rectangle, which roughly halves the operator count.
 *
 * The grid comes from `utils/qr-render.ts`, the ONE module in this repo allowed
 * to import the encoder package (HOS-1129, enforced by
 * `scripts/check-qrcode-engine-isolation.sh`). What is drawn is `qrUrl` — the
 * platform's own redirect, never the ficha's final URL.
 *
 * The matrix is PASSED IN rather than encoded here. It used to be encoded
 * twice per download, once by {@link qrBlockHeight} to place the page and once
 * here to draw it: two independent calls, so the symbol on the page and the
 * height the whole layout was built around came from different invocations.
 * Harmless while the encoder is deterministic, and not a property worth relying
 * on when one shared value costs nothing.
 */
function drawQr(input: { page: PDFPage; qr: QrModuleMatrix; top: number; size: number }): void {
    const { page, qr, top, size } = input;
    const count = qr.size;
    const module = size / count;
    const quiet = module * QR_QUIET_MODULES;
    const left = (A4_WIDTH - size) / 2;

    // The quiet zone, painted rather than assumed. The page is white today, so
    // this changes no pixel — it is here so that the day anything is drawn
    // behind the code, the four modules of silence survive it.
    drawRectTopDown({
        page,
        x: left - quiet,
        y: top - quiet,
        width: size + quiet * 2,
        height: size + quiet * 2,
        color: PAPER
    });

    for (let row = 0; row < count; row += 1) {
        let runStart = -1;
        for (let col = 0; col <= count; col += 1) {
            const dark = qr.isDark(row, col);
            if (dark && runStart === -1) {
                runStart = col;
            } else if (!dark && runStart !== -1) {
                drawRectTopDown({
                    page,
                    x: left + runStart * module,
                    y: top + row * module,
                    width: (col - runStart) * module,
                    height: module,
                    color: INK
                });
                runStart = -1;
            }
        }
    }
}

/**
 * Height the QR block occupies, symbol plus its quiet zone on both sides.
 *
 * Takes the SAME matrix `drawQr` will draw — see there for why it is not
 * re-encoded.
 */
function qrBlockHeight(input: { qr: QrModuleMatrix; size: number }): number {
    return input.size + (input.size / input.qr.size) * QR_QUIET_MODULES * 2;
}

/**
 * Renders a listing's printable QR sheet.
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

    const fonts: SheetFonts = {
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold)
    };
    const page = doc.addPage(PageSizes.A4);

    const name = fitNameLines({ name: content.listingName, font: fonts.bold });
    const inviteLines = wrapText({
        text: content.invite,
        font: fonts.regular,
        size: INVITE_SIZE,
        maxWidth: INVITE_WIDTH
    }).slice(0, INVITE_MAX_LINES);

    // Encoded ONCE, then used both to size the page and to draw the symbol.
    const qr = renderQrMatrix({ data: qrUrl, errorCorrectionLevel: QR_ERROR_CORRECTION });

    const nameHeight = name.lines.length * name.size * LEADING;
    const inviteHeight = inviteLines.length * INVITE_SIZE * LEADING;
    const qrHeight = qrBlockHeight({ qr, size: QR_SIZE });

    const totalHeight =
        nameHeight +
        GAP_NAME_TO_HEADLINE +
        HEADLINE_SIZE * LEADING +
        GAP_HEADLINE_TO_QR +
        qrHeight +
        GAP_QR_TO_INVITE +
        inviteHeight +
        GAP_INVITE_TO_RULE +
        RULE_HEIGHT +
        GAP_RULE_TO_BRAND +
        BRAND_SIZE * LEADING +
        GAP_BRAND_TO_TAGLINE +
        TAGLINE_SIZE * LEADING +
        GAP_TAGLINE_TO_DOMAIN +
        DOMAIN_SIZE * LEADING;

    // Centred in the usable area when it fits, flush to the top margin when it
    // does not. `max(0, …)` is what keeps a very long name from pushing the
    // whole stack UP into the printer's dead zone.
    let y = MARGIN + Math.max(0, (CONTENT_HEIGHT - totalHeight) / 2);

    // ── The business's name ────────────────────────────────────────────────
    for (const line of name.lines) {
        drawCentredLine({
            page,
            text: line,
            // `y` is the baseline: sit it at the bottom of the line box.
            y: y + name.size,
            font: fonts.bold,
            size: name.size,
            color: INK
        });
        y += name.size * LEADING;
    }
    y += GAP_NAME_TO_HEADLINE;

    // ── The invitation, set large ──────────────────────────────────────────
    drawCentredLine({
        page,
        text: content.headline,
        y: y + HEADLINE_SIZE,
        font: fonts.bold,
        size: HEADLINE_SIZE,
        color: INK
    });
    y += HEADLINE_SIZE * LEADING + GAP_HEADLINE_TO_QR;

    // ── The code ───────────────────────────────────────────────────────────
    const quiet = (qrHeight - QR_SIZE) / 2;
    drawQr({ page, qr, top: y + quiet, size: QR_SIZE });
    y += qrHeight + GAP_QR_TO_INVITE;

    // ── What to do with it ─────────────────────────────────────────────────
    for (const line of inviteLines) {
        drawCentredLine({
            page,
            text: line,
            y: y + INVITE_SIZE,
            font: fonts.regular,
            size: INVITE_SIZE,
            color: INK
        });
        y += INVITE_SIZE * LEADING;
    }
    y += GAP_INVITE_TO_RULE;

    // ── The brand ──────────────────────────────────────────────────────────
    drawRectTopDown({
        page,
        x: MARGIN + CONTENT_WIDTH / 4,
        y,
        width: CONTENT_WIDTH / 2,
        height: RULE_HEIGHT,
        color: RULE_INK
    });
    y += RULE_HEIGHT + GAP_RULE_TO_BRAND;

    drawCentredLine({
        page,
        text: content.brand,
        y: y + BRAND_SIZE,
        font: fonts.bold,
        size: BRAND_SIZE,
        color: INK
    });
    y += BRAND_SIZE * LEADING + GAP_BRAND_TO_TAGLINE;

    drawCentredLine({
        page,
        text: content.brandTagline,
        y: y + TAGLINE_SIZE,
        font: fonts.regular,
        size: TAGLINE_SIZE,
        color: MUTED_INK
    });
    y += TAGLINE_SIZE * LEADING + GAP_TAGLINE_TO_DOMAIN;

    // The bare domain, not the ficha's address — see `printedDomain`.
    drawCentredLine({
        page,
        text: printedDomain(qrUrl),
        y: y + DOMAIN_SIZE,
        font: fonts.regular,
        size: DOMAIN_SIZE,
        color: INK
    });

    // A fresh, `ArrayBuffer`-backed copy: `Response` wants a `BufferSource`, and
    // the generically-backed `Uint8Array` `save()` returns is not assignable.
    return new Uint8Array(await doc.save());
}
