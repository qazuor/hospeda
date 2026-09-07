/**
 * The rendered QR sheet (HOS-982).
 *
 * ---
 * WHAT THESE TESTS CAN AND CANNOT SEE
 *
 * They assert the FILE, not its appearance: that it parses back as one A4 page,
 * that the copy asked for is in the content stream, that the symbol drawn is the
 * one the caller asked for and at the physical size the design promises, that
 * every ink on the page is a grey, and that two runs are byte-identical. Whether
 * a phone actually scans the printed result is a smoke, not a unit test — it
 * needs a printer and a camera, and CI has neither.
 *
 * ## The one trap this suite is written around
 *
 * HOS-1137: the brochure's QR test measured what got drawn by re-running
 * `renderQrMatrix` — the very engine that draws it. A mutation of the engine
 * moved both sides of the comparison and the test stayed green. So the
 * assertions here about WHAT was drawn are made against
 *
 * - a GOLDEN count ({@link GOLDEN_DARK_RUNS}) recorded once and written down as
 *   a literal, and
 * - GEOMETRY read back out of the PDF's own path operators,
 *
 * neither of which asks `renderQrMatrix` anything. `renderQrMatrix` is not
 * imported by this file at all, which is the mechanical form of that rule.
 *
 * @module test/services/listing-qr-sheet-render
 */

import { inflateSync } from 'node:zlib';
import { PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { ListingQrSheetContent } from '../../src/services/listing-qr-sheet/qr-sheet-content.js';
import {
    QR_ERROR_CORRECTION,
    QR_SIZE,
    renderListingQrSheetPdf
} from '../../src/services/listing-qr-sheet/qr-sheet-render.js';

/**
 * What the QR encodes: the platform's own redirect, never the ficha's address.
 * The two are deliberately different strings throughout this file — a test that
 * passed the same value for both could not tell which one got drawn.
 */
const QR_URL = 'https://hospeda.com.ar/qr/K7Qm2XbT/';

/** A much longer redirect — a different QR version, so a different symbol. */
const OTHER_QR_URL = `https://hospeda.com.ar/qr/${'K7Qm2XbT'.repeat(8)}/`;

/**
 * Merged horizontal dark runs the symbol for {@link QR_URL} produces, recorded
 * once from a verified run and written down as a LITERAL.
 *
 * This is the number that makes the suite blind-proof: it does not move when the
 * QR engine moves, so a change to the encoder, to the error-correction level, or
 * to WHICH string gets encoded fails here instead of quietly agreeing with
 * itself (HOS-1137).
 *
 * It is therefore also the number that fails on a legitimate `qrcode` version
 * bump. That is the intended cost: a bump that changes this count changes the
 * symbol on every sheet already taped to a door, and somebody should look at it
 * rather than re-record the number reflexively. To re-record: render with
 * {@link QR_URL}, count the black filled paths, and say in the commit message
 * why the symbol changed.
 */
const GOLDEN_DARK_RUNS = 284;

/** A4 in points, and the margin the design promises. Literals, not imports. */
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 48;

/** Points per millimetre, for stating the physical claims in physical units. */
const MM = 72 / 25.4;

/** A sheet with an accent in every field a reader would notice. */
function content(overrides: Partial<ListingQrSheetContent> = {}): ListingQrSheetContent {
    return {
        listingName: 'La Parrilla del Puerto',
        headline: 'Escaneá el código',
        invite: 'Apuntá la cámara de tu teléfono al código para ver la ficha completa.',
        brand: 'Hospeda',
        brandTagline: 'Alojamientos, gastronomía y experiencias del Litoral',
        url: 'https://hospeda.com.ar/es/gastronomia/la-parrilla-del-puerto/',
        ...overrides
    };
}

/**
 * Every content stream in the file, inflated and concatenated.
 *
 * `pdf-lib` Flate-compresses page content, so the drawn text is not greppable in
 * the raw bytes. Nothing here reaches into the library's internals: the streams
 * are located by their PDF delimiters and inflated with `zlib`, which is what
 * any reader does.
 */
function inflatedStreams(bytes: Uint8Array): Buffer {
    const raw = Buffer.from(bytes);
    const chunks: Buffer[] = [];
    let cursor = 0;
    for (;;) {
        const start = raw.indexOf('stream', cursor);
        if (start === -1) break;
        const end = raw.indexOf('endstream', start);
        if (end === -1) break;
        // Skip `stream` plus its mandatory EOL (CRLF or LF).
        let from = start + 'stream'.length;
        if (raw[from] === 0x0d) from += 1;
        if (raw[from] === 0x0a) from += 1;
        try {
            chunks.push(inflateSync(raw.subarray(from, end)));
        } catch {
            // Not a Flate stream. Not our business here.
        }
        cursor = end + 1;
    }
    return Buffer.concat(chunks);
}

/**
 * Whether the document draws `text`.
 *
 * Standard-font text is written as a hex string of WinAnsi bytes, so the search
 * term is the hex of the Latin-1 encoding — which is exactly how a viewer finds
 * it too.
 */
function drawsText(bytes: Uint8Array, text: string): boolean {
    const hex = Buffer.from(text, 'latin1').toString('hex');
    return inflatedStreams(bytes).toString('latin1').toLowerCase().includes(hex.toLowerCase());
}

/** One filled rectangle, in PDF (bottom-left origin) page coordinates. */
interface DrawnRect {
    readonly fill: readonly [number, number, number];
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * Reads every filled rectangle back out of the page's own operators.
 *
 * `pdf-lib` emits a rectangle as a `q … Q` group: a fill colour, a `cm`
 * translation to the rectangle's corner, then a path of `m`/`l` points closed
 * with `h` and filled with `f`. So the absolute box is the translation plus the
 * path's own extent — read from the file, derived from nothing this repo
 * computes.
 */
function drawnRects(bytes: Uint8Array): DrawnRect[] {
    const stream = inflatedStreams(bytes).toString('latin1');
    const rects: DrawnRect[] = [];

    for (const block of stream.split('q\n')) {
        if (!block.includes('\nh\nf\n')) continue;
        const fill = block.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) rg/);
        // The FIRST `cm` in the block is the translation to the corner; the two
        // that follow are identities pdf-lib emits unconditionally.
        const cm = block.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm/);
        const points = [...block.matchAll(/(-?[\d.]+) (-?[\d.]+) [ml]\n/g)];
        if (!fill || !cm || points.length === 0) continue;

        const xs = points.map((point) => Number(point[1]));
        const ys = points.map((point) => Number(point[2]));
        rects.push({
            fill: [Number(fill[1]), Number(fill[2]), Number(fill[3])],
            x: Number(cm[1]) + Math.min(...xs),
            y: Number(cm[2]) + Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        });
    }
    return rects;
}

/**
 * Vertical extent of a line of type, as a fraction of the font size.
 *
 * ---
 * THE BLINDNESS THIS EXISTS TO REMOVE
 *
 * `drawnRects` above only ever sees FILLS — it keeps blocks containing `\nh\nf\n`
 * — and pdf-lib writes text as `BT`/`Tf`/`Tm`/`Tj`/`ET`, which matches nothing
 * there. So "nothing may enter the quiet zone" and "nothing is drawn inside the
 * margin" both used to mean "no RECTANGLE does", while the renderer's own
 * docblock claims the reserve exists so that no headline or invitation can creep
 * in. Text is precisely what those two assertions were not looking at.
 *
 * A quiet zone is about INK, so the box below is the glyph box and not the
 * typeset line box: 0.75em above the baseline and 0.25em below it. Both numbers
 * are deliberately larger than the faces this sheet uses (Helvetica and
 * Helvetica-Bold reach 0.718 and 0.207), so the box over-states what is drawn
 * and the check errs toward complaining. Written as literals rather than read
 * off the font for the same reason `GOLDEN_DARK_RUNS` is a literal: an
 * assertion that re-derives its expectation from the thing under test moves
 * with it.
 */
const GLYPH_ASCENT = 0.75;
const GLYPH_DESCENT = 0.25;

/** One drawn line of type, in PDF (bottom-left origin) page coordinates. */
interface DrawnText {
    readonly text: string;
    readonly size: number;
    readonly bold: boolean;
    /** Left edge of the drawn line. */
    readonly x: number;
    /** Baseline, from the bottom of the page. */
    readonly baseline: number;
}

/**
 * Reads every line of type back out of the page's own text operators.
 *
 * pdf-lib emits one `q … BT … ET … Q` group per line: a fill colour, a
 * `/<face> <size> Tf`, a `1 0 0 1 x y Tm` placing the baseline, and the string
 * as a hex-encoded WinAnsi literal. All read from the file — nothing here asks
 * the renderer where it thinks it drew anything.
 */
function drawnTexts(bytes: Uint8Array): DrawnText[] {
    const stream = inflatedStreams(bytes).toString('latin1');
    const texts: DrawnText[] = [];

    for (const block of stream.split('BT\n')) {
        const face = block.match(/\/(\S+?) ([\d.]+) Tf/);
        const tm = block.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/);
        const shown = block.match(/<([0-9A-Fa-f]*)> Tj/);
        if (!face || !tm || !shown) continue;

        texts.push({
            text: Buffer.from(shown[1] as string, 'hex').toString('latin1'),
            size: Number(face[2]),
            bold: (face[1] as string).includes('Bold'),
            x: Number(tm[1]),
            baseline: Number(tm[2])
        });
    }
    return texts;
}

/**
 * The two standard faces, embedded in a THROWAWAY document.
 *
 * Only their metrics are wanted, and taking them from a document this file
 * creates keeps the width measurement independent of the renderer's own
 * centring arithmetic: the test computes where the line reaches from the
 * baseline it read out of the file, not from anything the layout told it.
 */
async function faces(): Promise<{ regular: PDFFont; bold: PDFFont }> {
    const doc = await PDFDocument.create();
    return {
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold)
    };
}

/** Every drawn line of type as a box, in the same shape as {@link DrawnRect}. */
async function textBoxes(bytes: Uint8Array): Promise<DrawnRect[]> {
    const { regular, bold } = await faces();
    return drawnTexts(bytes).map((run) => {
        const font = run.bold ? bold : regular;
        return {
            // Ink, not paper: every line on this sheet is drawn in a grey, and
            // the fill is only used to exclude the white ground.
            fill: [0, 0, 0] as const,
            x: run.x,
            y: run.baseline - run.size * GLYPH_DESCENT,
            width: font.widthOfTextAtSize(run.text, run.size),
            height: run.size * (GLYPH_ASCENT + GLYPH_DESCENT)
        };
    });
}

/**
 * EVERYTHING drawn on the page: filled rectangles and lines of type alike.
 *
 * This is what the two geometric guarantees below have to be stated over. A
 * check that reads only one of the two families is not a weaker check, it is a
 * different one — and the one it turned out to be was not the one advertised.
 */
async function drawnBoxes(bytes: Uint8Array): Promise<DrawnRect[]> {
    return [...drawnRects(bytes), ...(await textBoxes(bytes))];
}

/** The dark modules — the only pure-black filled rectangles on the page. */
function darkModuleRects(bytes: Uint8Array): DrawnRect[] {
    return drawnRects(bytes).filter(
        (rect) => rect.fill[0] === 0 && rect.fill[1] === 0 && rect.fill[2] === 0
    );
}

/** The symbol's drawn bounding box. Its border rows/cols are always dark. */
function symbolBox(bytes: Uint8Array): { width: number; height: number; x: number; y: number } {
    const rects = darkModuleRects(bytes);
    const left = Math.min(...rects.map((rect) => rect.x));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.min(...rects.map((rect) => rect.y));
    const top = Math.max(...rects.map((rect) => rect.y + rect.height));
    return { x: left, y: bottom, width: right - left, height: top - bottom };
}

/** Loads the produced file back and reports what a reader sees. */
async function reread(bytes: Uint8Array) {
    const doc = await PDFDocument.load(bytes);
    return {
        pages: doc.getPageCount(),
        size: doc.getPage(0).getSize(),
        title: doc.getTitle()
    };
}

describe('the QR sheet file (HOS-982)', () => {
    it('is a one-page A4 PDF titled with the business name', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });

        expect(Buffer.from(bytes).subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(Buffer.from(bytes).toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);

        const seen = await reread(bytes);
        expect(seen.pages).toBe(1);
        expect(seen.size.width).toBeCloseTo(A4_WIDTH, 2);
        expect(seen.size.height).toBeCloseTo(A4_HEIGHT, 2);
        expect(seen.title).toBe('La Parrilla del Puerto');
    });

    it('draws the four things the sheet exists to carry', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });

        expect(drawsText(bytes, 'La Parrilla del Puerto')).toBe(true);
        expect(drawsText(bytes, 'Escane\xe1 el c\xf3digo')).toBe(true);
        expect(drawsText(bytes, 'Apunt\xe1 la c\xe1mara')).toBe(true);
        expect(drawsText(bytes, 'Hospeda')).toBe(true);
    });

    it('is byte-identical across runs, so a reprint matches the sheet on the door', async () => {
        const first = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const second = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    });

    it('stays on ONE page even for a name far longer than the sheet was designed for', async () => {
        const bytes = await renderListingQrSheetPdf({
            content: content({
                listingName:
                    'Restaurante Parrilla Pescadería y Salón de Eventos del Puerto de Concepción del Uruguay, Entre Ríos'
            }),
            qrUrl: QR_URL
        });

        // A second page would put the code on a sheet nobody prints.
        expect((await reread(bytes)).pages).toBe(1);
        // And the symbol keeps its full size rather than being squeezed.
        expect(symbolBox(bytes).width).toBeCloseTo(QR_SIZE, 1);
    });

    it('prints a name this font cannot draw instead of answering an error', async () => {
        // A standard face covers WinAnsi and no more, and pdf-lib raises rather
        // than guessing — an uncaught raise is a 500 on a download.
        const bytes = await renderListingQrSheetPdf({
            content: content({ listingName: 'Sushi 漢 del Puerto' }),
            qrUrl: QR_URL
        });

        expect((await reread(bytes)).pages).toBe(1);
        expect(drawsText(bytes, 'Sushi ? del Puerto')).toBe(true);
    });
});

describe('what the QR encodes (HOS-982)', () => {
    it('draws the golden symbol for a known redirect', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });

        // The literal is the point — see GOLDEN_DARK_RUNS. A mutation of the
        // engine, of the error-correction level, or of WHICH string is encoded
        // moves this and nothing moves with it.
        expect(darkModuleRects(bytes).length).toBe(GOLDEN_DARK_RUNS);
    });

    it('ignores content.url, which the sheet draws nowhere', async () => {
        const short = await renderListingQrSheetPdf({
            content: content({ url: 'https://hospeda.com.ar/es/gastronomia/a/' }),
            qrUrl: QR_URL
        });
        const long = await renderListingQrSheetPdf({
            content: content({
                url: `https://hospeda.com.ar/es/gastronomia/${'un-slug-larguisimo-'.repeat(6)}/`
            }),
            qrUrl: QR_URL
        });

        // Nothing on the sheet depends on the ficha's address — not the symbol
        // and not the readable line — so a different one must change nothing.
        expect(Buffer.from(short).equals(Buffer.from(long))).toBe(true);
    });

    it('follows qrUrl: a different redirect is a different symbol', async () => {
        const first = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const second = await renderListingQrSheetPdf({ content: content(), qrUrl: OTHER_QR_URL });

        expect(darkModuleRects(second).length).not.toBe(darkModuleRects(first).length);
        // Still the same physical square: a longer payload buys more modules,
        // not a bigger code.
        expect(symbolBox(second).width).toBeCloseTo(QR_SIZE, 1);
    });

    it('prints the bare domain, never the ficha address and never the opaque slug', async () => {
        const bytes = await renderListingQrSheetPdf({
            content: content({ url: 'https://hospeda.com.ar/es/gastronomia/la-parrilla/' }),
            qrUrl: QR_URL
        });

        expect(drawsText(bytes, 'hospeda.com.ar')).toBe(true);
        // The deep path is the half that would rot the day the ficha moves.
        expect(drawsText(bytes, 'https://hospeda.com.ar/es/gastronomia/la-parrilla/')).toBe(false);
        expect(drawsText(bytes, '/es/gastronomia/')).toBe(false);
        // Nor the redirect identifier, which nobody can type or remember.
        expect(drawsText(bytes, 'K7Qm2XbT')).toBe(false);
    });

    it('falls back to the platform domain when the redirect cannot be parsed', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: 'not a url' });
        expect(drawsText(bytes, 'hospeda.com.ar')).toBe(true);
    });
});

describe('the sheet has to survive a home printer (HOS-982)', () => {
    it('sets the code at 113mm, sized for a scan from a metre away', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const box = symbolBox(bytes);

        // Read back out of the file's own path operators, not from the constant.
        expect(box.width / MM).toBeGreaterThanOrEqual(100);
        expect(box.width).toBeCloseTo(box.height, 1);
        expect(box.width).toBeCloseTo(QR_SIZE, 1);
    });

    it('keeps every module comfortably above what a home printer can hold', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: OTHER_QR_URL });
        // The narrowest dark rectangle is exactly one module wide.
        const module = Math.min(...darkModuleRects(bytes).map((rect) => rect.width));

        // ~0.3mm is a consumer printer's floor; scanners want more. Asserted on
        // the LONGEST payload of this suite, which is the densest symbol.
        expect(module / MM).toBeGreaterThan(1);
    });

    it('uses error correction Q, so a covered corner still scans', () => {
        // Frozen deliberately: dropping to M is invisible in every other
        // assertion here except the golden count, and this names the reason.
        expect(QR_ERROR_CORRECTION).toBe('Q');
    });

    it('draws nothing — rectangle OR line of type — inside the printer’s margin', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const boxes = await drawnBoxes(bytes);

        // Vacuity check: the sheet draws six lines of type (a one-line name,
        // the headline, one line of invitation for this fixture, the brand, the
        // tagline and the domain). If the text parser stops matching, this says
        // so rather than letting the loop pass over rectangles alone — which is
        // exactly how this assertion read for its first four commits.
        expect(drawnTexts(bytes).length).toBeGreaterThanOrEqual(6);

        for (const box of boxes) {
            expect(box.x).toBeGreaterThanOrEqual(MARGIN);
            expect(box.y).toBeGreaterThanOrEqual(MARGIN);
            expect(box.x + box.width).toBeLessThanOrEqual(A4_WIDTH - MARGIN);
            expect(box.y + box.height).toBeLessThanOrEqual(A4_HEIGHT - MARGIN);
        }
    });

    it('leaves the symbol at least four modules of white on every side', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const box = symbolBox(bytes);
        const module = Math.min(...darkModuleRects(bytes).map((rect) => rect.width));
        const quiet = module * 4;

        // Nothing else drawn on the page may enter the quiet zone — a code
        // without one is a code many scanners simply refuse. The white ground
        // itself is excluded: it IS the quiet zone. TEXT is in scope here and
        // was not: the renderer reserves this space so that "no headline or
        // invitation can creep into it", and a headline is not a rectangle.
        const intruders = (await drawnBoxes(bytes)).filter((rect) => {
            const isWhiteGround = rect.fill[0] === 1 && rect.fill[1] === 1 && rect.fill[2] === 1;
            if (isWhiteGround) return false;
            const overlapsX =
                rect.x < box.x + box.width + quiet && rect.x + rect.width > box.x - quiet;
            const overlapsY =
                rect.y < box.y + box.height + quiet && rect.y + rect.height > box.y - quiet;
            const isModule =
                rect.x >= box.x - 0.01 &&
                rect.y >= box.y - 0.01 &&
                rect.x + rect.width <= box.x + box.width + 0.01 &&
                rect.y + rect.height <= box.y + box.height + 0.01;
            return overlapsX && overlapsY && !isModule;
        });

        expect(intruders).toEqual([]);
    });

    /**
     * What the assertion above is worth, in points.
     *
     * A pass proves nothing intrudes TODAY; it does not say by how much, and a
     * clearance of a tenth of a point would read exactly the same. So the gap
     * between the code's silence and the nearest ink above it is measured and
     * pinned to a floor — which is also what makes the check above demonstrably
     * non-vacuous, since the number it produces moves with the layout.
     */
    it('keeps the nearest line of type a real distance clear of the silence', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const box = symbolBox(bytes);
        const module = Math.min(...darkModuleRects(bytes).map((rect) => rect.width));
        const quietTop = box.y + box.height + module * 4;

        const above = (await textBoxes(bytes)).filter((run) => run.y >= quietTop);
        expect(above.length).toBeGreaterThan(0);
        const clearance = Math.min(...above.map((run) => run.y - quietTop));

        // The headline's descenders stop here. `GAP_HEADLINE_TO_QR` is what
        // buys this, so shrinking that constant shrinks this number one for
        // one — and taking it below zero is what actually pushes ink into the
        // silence, which the assertion above then catches.
        expect(clearance).toBeGreaterThan(1);
    });

    it('is printed entirely in greys, so a black-and-white printer loses nothing', async () => {
        const bytes = await renderListingQrSheetPdf({ content: content(), qrUrl: QR_URL });
        const stream = inflatedStreams(bytes).toString('latin1');
        const fills = [...stream.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) rg/g)];

        // Vacuity check first: a page that set no colour at all would satisfy
        // the loop below without proving anything.
        expect(fills.length).toBeGreaterThan(100);
        for (const fill of fills) {
            expect(fill[2]).toBe(fill[1]);
            expect(fill[3]).toBe(fill[1]);
        }
    });
});
