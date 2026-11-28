/**
 * The rendered QR sticker sheet (HOS-982, redesigned in HOS-2688).
 *
 * ---
 * WHAT THESE TESTS CAN AND CANNOT SEE
 *
 * They assert the FILE, not its appearance: that it parses back as one A4 page,
 * that the sticker artwork is placed at 190mm and centred, that the cut marks
 * are where a cutter needs them, that the copy asked for is drawn inside the
 * pill, and that the symbol drawn is the one the caller asked for, inside the
 * artwork's white box. Whether a phone actually scans the printed result is a
 * smoke, not a unit test — it needs a printer and a camera, and CI has neither.
 * (The PR that introduced the sticker decoded rasterised renders with zxing;
 * see its description.)
 *
 * ## The one trap this suite is written around
 *
 * HOS-1137: the brochure's QR test measured what got drawn by re-running
 * `renderQrMatrix` — the very engine that draws it. A mutation of the engine
 * moved both sides of the comparison and the test stayed green. So the
 * assertions here about WHAT was drawn are made against a GOLDEN count
 * ({@link GOLDEN_DARK_RUNS}) written down as a literal, and against GEOMETRY
 * read back out of the PDF's own operators. `renderQrMatrix` is not imported by
 * this file at all.
 *
 * @module test/services/listing-qr-sheet-render
 */

import { PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { ListingQrSheetContent } from '../../src/services/listing-qr-sheet/qr-sheet-content.js';
import {
    PILL_BOX,
    PILL_NAME_SIZE_MIN,
    QR_BOX,
    QR_ERROR_CORRECTION,
    renderListingQrSheetPdf
} from '../../src/services/listing-qr-sheet/qr-sheet-render.js';
import { inflatedStreams } from '../helpers/pdf-text.ts';

/** What the QR encodes: the platform's own redirect, never the ficha's address. */
const QR_URL = 'https://hospeda.com.ar/qr/K7Qm2XbT/';

/** A much longer redirect — a different QR version, so a different symbol. */
const OTHER_QR_URL = `https://hospeda.com.ar/qr/${'K7Qm2XbT'.repeat(8)}/`;

/**
 * Merged horizontal dark runs the symbol for {@link QR_URL} produces, recorded
 * once from a verified run and written down as a LITERAL. It does not move when
 * the QR engine moves, so a change to the encoder, to the error-correction
 * level, or to WHICH string gets encoded fails here (HOS-1137). The value is the
 * same one the pre-sticker sheet recorded: the symbol did not change, only
 * where it is drawn.
 */
const GOLDEN_DARK_RUNS = 284;

/** A4 in points. Literals, not imports. */
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/** Points per millimetre, for stating the physical claims in physical units. */
const MM = 72 / 25.4;

/** The sticker's promised side (owner decision): ~190mm. */
const STICKER_MM = 190;

/** Art units across the sticker. Literal, matching the asset's 1254px side. */
const ART_UNITS = 1254;

const LONG_NAME =
    'Restaurante Parrilla Pescadería Cervecería y Salón de Eventos del Puerto de Concepción del Uruguay, Entre Ríos';

function content(overrides: Partial<ListingQrSheetContent> = {}): ListingQrSheetContent {
    return {
        listingName: 'La Parrilla del Puerto',
        pillHeadline: 'Escaneá para conocer',
        url: 'https://hospeda.com.ar/es/comer-y-salir/la-parrilla-del-puerto/',
        ...overrides
    };
}

/** A box in PDF (bottom-left origin) page coordinates. */
interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** One filled rectangle and its fill colour. */
interface DrawnRect extends Box {
    readonly fill: readonly [number, number, number];
}

/** Reads every filled rectangle back out of the page's own operators. */
function drawnRects(bytes: Uint8Array): DrawnRect[] {
    const stream = inflatedStreams(bytes).toString('latin1');
    const rects: DrawnRect[] = [];
    for (const block of stream.split('q\n')) {
        if (!block.includes('\nh\nf\n')) continue;
        const fill = block.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) rg/);
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

/** One stroked line segment. */
interface DrawnLine {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
}

/** Reads every stroked line back out of the page's operators. */
function drawnLines(bytes: Uint8Array): DrawnLine[] {
    const stream = inflatedStreams(bytes).toString('latin1');
    const lines: DrawnLine[] = [];
    for (const block of stream.split('q\n')) {
        if (!block.includes('\nS\n')) continue;
        const start = block.match(/(-?[\d.]+) (-?[\d.]+) m\n/);
        const end = block.match(/(-?[\d.]+) (-?[\d.]+) l\n/);
        if (!start || !end) continue;
        lines.push({
            x1: Number(start[1]),
            y1: Number(start[2]),
            x2: Number(end[1]),
            y2: Number(end[2])
        });
    }
    return lines;
}

/** Where the (single) image is placed: the `cm` scale and translation before `Do`. */
function drawnImage(bytes: Uint8Array): Box {
    const stream = inflatedStreams(bytes).toString('latin1');
    const block = stream.split('q\n').find((candidate) => candidate.includes(' Do\n'));
    expect(block).toBeDefined();
    const translate = (block as string).match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm/);
    // pdf-lib also emits identity `1 0 0 1 0 0 cm`s; the scale is the one that is not.
    const scale = [...(block as string).matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm/g)].find(
        (match) => Number(match[1]) !== 1
    );
    expect(translate).not.toBeNull();
    expect(scale).toBeDefined();
    return {
        x: Number(translate?.[1]),
        y: Number(translate?.[2]),
        width: Number(scale?.[1]),
        height: Number(scale?.[2])
    };
}

/** One drawn line of type. */
interface DrawnText {
    readonly text: string;
    readonly size: number;
    readonly fill: readonly [number, number, number];
    readonly x: number;
    readonly baseline: number;
}

/** Reads every line of type back out of the page's own text operators. */
function drawnTexts(bytes: Uint8Array): DrawnText[] {
    const stream = inflatedStreams(bytes).toString('latin1');
    const texts: DrawnText[] = [];
    for (const block of stream.split('q\n')) {
        const face = block.match(/\/(\S+?) ([\d.]+) Tf/);
        const tm = block.match(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/);
        const shown = block.match(/<([0-9A-Fa-f]*)> Tj/);
        const fill = block.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) rg/);
        if (!face || !tm || !shown || !fill) continue;
        texts.push({
            text: Buffer.from(shown[1] as string, 'hex').toString('latin1'),
            size: Number(face[2]),
            fill: [Number(fill[1]), Number(fill[2]), Number(fill[3])],
            x: Number(tm[1]),
            baseline: Number(tm[2])
        });
    }
    return texts;
}

/** Helvetica-Bold from a THROWAWAY document, for measuring what was drawn. */
async function boldFace(): Promise<PDFFont> {
    const doc = await PDFDocument.create();
    return doc.embedFont(StandardFonts.HelveticaBold);
}

/** The dark modules — the only pure-black filled rectangles on the page. */
function darkModuleRects(bytes: Uint8Array): DrawnRect[] {
    return drawnRects(bytes).filter(
        (rect) => rect.fill[0] === 0 && rect.fill[1] === 0 && rect.fill[2] === 0
    );
}

/** The symbol's drawn bounding box. Its border rows/cols are always dark. */
function symbolBox(bytes: Uint8Array): Box {
    const rects = darkModuleRects(bytes);
    const left = Math.min(...rects.map((rect) => rect.x));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.min(...rects.map((rect) => rect.y));
    const top = Math.max(...rects.map((rect) => rect.y + rect.height));
    return { x: left, y: bottom, width: right - left, height: top - bottom };
}

/** An art-unit box converted to PDF page coordinates, given where the image sits. */
function artToPage(input: {
    image: Box;
    art: { left: number; top: number; right: number; bottom: number };
}): Box {
    const scale = input.image.width / ART_UNITS;
    const top = input.image.y + input.image.height;
    return {
        x: input.image.x + input.art.left * scale,
        y: top - input.art.bottom * scale,
        width: (input.art.right - input.art.left) * scale,
        height: (input.art.bottom - input.art.top) * scale
    };
}

function render(overrides: Partial<ListingQrSheetContent> = {}, qrUrl = QR_URL) {
    return renderListingQrSheetPdf({ content: content(overrides), qrUrl });
}

describe('the QR sticker sheet file (HOS-2688)', () => {
    it('is a one-page A4 PDF titled with the business name', async () => {
        const bytes = await render();
        expect(Buffer.from(bytes).subarray(0, 5).toString('latin1')).toBe('%PDF-');

        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        expect(doc.getPage(0).getSize().width).toBeCloseTo(A4_WIDTH, 2);
        expect(doc.getPage(0).getSize().height).toBeCloseTo(A4_HEIGHT, 2);
        expect(doc.getTitle()).toBe('La Parrilla del Puerto');
    });

    it('places the sticker artwork at 190mm, centred on the page', async () => {
        const image = drawnImage(await render());

        expect(image.width / MM).toBeCloseTo(STICKER_MM, 1);
        expect(image.height / MM).toBeCloseTo(STICKER_MM, 1);
        expect(image.x + image.width / 2).toBeCloseTo(A4_WIDTH / 2, 1);
        expect(image.y + image.height / 2).toBeCloseTo(A4_HEIGHT / 2, 1);
    });

    it('draws eight cut marks, two per corner, outside the sticker and inside the page', async () => {
        const bytes = await render();
        const image = drawnImage(bytes);
        const lines = drawnLines(bytes);
        expect(lines).toHaveLength(8);

        const corners = [
            [image.x, image.y],
            [image.x + image.width, image.y],
            [image.x, image.y + image.height],
            [image.x + image.width, image.y + image.height]
        ] as const;
        for (const [cx, cy] of corners) {
            // One vertical mark on the corner's x, one horizontal on its y,
            // each nearer the corner than 10mm and never touching it.
            const near = lines.filter((line) => {
                const vertical = Math.abs(line.x1 - cx) < 0.01 && Math.abs(line.x2 - cx) < 0.01;
                const horizontal = Math.abs(line.y1 - cy) < 0.01 && Math.abs(line.y2 - cy) < 0.01;
                if (vertical === horizontal) return false;
                const d1 = Math.hypot(line.x1 - cx, line.y1 - cy);
                const d2 = Math.hypot(line.x2 - cx, line.y2 - cy);
                return Math.min(d1, d2) > 0.5 * MM && Math.max(d1, d2) < 10 * MM;
            });
            expect(near).toHaveLength(2);
        }
        for (const line of lines) {
            for (const [x, y] of [
                [line.x1, line.y1],
                [line.x2, line.y2]
            ] as const) {
                // Never inside the sticker...
                const inside =
                    x > image.x + 0.01 &&
                    x < image.x + image.width - 0.01 &&
                    y > image.y + 0.01 &&
                    y < image.y + image.height - 0.01;
                expect(inside).toBe(false);
                // ...and at least 3mm from the paper's edge.
                expect(x).toBeGreaterThanOrEqual(3 * MM);
                expect(x).toBeLessThanOrEqual(A4_WIDTH - 3 * MM);
            }
        }
    });

    it('is byte-identical across runs, so a reprint matches the sticker on the door', async () => {
        const first = await render();
        const second = await render();
        expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    });
});

describe('the pill (HOS-2688)', () => {
    it('sets the invitation and the name, uppercase, white', async () => {
        const texts = drawnTexts(await render());

        expect(texts.map((run) => run.text)).toEqual([
            'ESCANE\xc1 PARA CONOCER',
            'LA PARRILLA DEL PUERTO'
        ]);
        for (const run of texts) {
            expect(run.fill).toEqual([1, 1, 1]);
        }
    });

    it('keeps every line of type inside the pill, even a name far too long for it', async () => {
        const face = await boldFace();
        for (const listingName of ['La Parrilla del Puerto', LONG_NAME]) {
            const bytes = await render({ listingName });
            const pill = artToPage({ image: drawnImage(bytes), art: PILL_BOX });
            const texts = drawnTexts(bytes);
            expect(texts).toHaveLength(2);

            for (const run of texts) {
                // Read back as latin1, the WinAnsi ellipsis is \x85; map it back
                // to U+2026 so the face can measure it.
                const width = face.widthOfTextAtSize(run.text.replace(/\x85/g, '\u2026'), run.size);
                expect(run.x).toBeGreaterThan(pill.x);
                expect(run.x + width).toBeLessThan(pill.x + pill.width);
                expect(run.baseline - run.size * 0.25).toBeGreaterThan(pill.y);
                expect(run.baseline + run.size * 0.9).toBeLessThan(pill.y + pill.height);
            }
        }
    });

    it('cuts a name it cannot fit, at the minimum size, and marks the cut', async () => {
        const name = drawnTexts(await render({ listingName: LONG_NAME }))[1];

        expect(name?.size).toBe(PILL_NAME_SIZE_MIN);
        // U+2026 is WinAnsi byte 0x85, which reads back through latin1 as \x85.
        expect(name?.text.endsWith('\x85')).toBe(true);
        expect(name?.text.startsWith('RESTAURANTE PARRILLA')).toBe(true);
    });

    it('prints a name this font cannot draw instead of answering an error', async () => {
        const bytes = await render({ listingName: 'Sushi 漢 del Puerto' });
        expect(drawnTexts(bytes)[1]?.text).toBe('SUSHI ? DEL PUERTO');
    });
});

describe('what the QR encodes (HOS-982)', () => {
    it('draws the golden symbol for a known redirect', async () => {
        expect(darkModuleRects(await render()).length).toBe(GOLDEN_DARK_RUNS);
    });

    it('ignores content.url, which the sheet draws nowhere', async () => {
        const short = await render({ url: 'https://hospeda.com.ar/es/comer-y-salir/a/' });
        const long = await render({
            url: `https://hospeda.com.ar/es/comer-y-salir/${'un-slug-larguisimo-'.repeat(6)}/`
        });
        expect(Buffer.from(short).equals(Buffer.from(long))).toBe(true);
    });

    it('follows qrUrl: a different redirect is a different symbol', async () => {
        const first = await render();
        const second = await render({}, OTHER_QR_URL);
        expect(darkModuleRects(second).length).not.toBe(darkModuleRects(first).length);
    });
});

describe('the code has to scan off a door (HOS-2688)', () => {
    it('sits inside the artwork’s white box with four modules of quiet zone', async () => {
        for (const qrUrl of [QR_URL, OTHER_QR_URL]) {
            const bytes = await render({}, qrUrl);
            const box = artToPage({ image: drawnImage(bytes), art: QR_BOX });
            const symbol = symbolBox(bytes);
            const module = Math.min(...darkModuleRects(bytes).map((rect) => rect.width));
            const quiet = module * 4 - 0.01;

            expect(symbol.width).toBeCloseTo(symbol.height, 1);
            expect(symbol.x - box.x).toBeGreaterThanOrEqual(quiet);
            expect(box.x + box.width - (symbol.x + symbol.width)).toBeGreaterThanOrEqual(quiet);
            expect(symbol.y - box.y).toBeGreaterThanOrEqual(quiet);
            expect(box.y + box.height - (symbol.y + symbol.height)).toBeGreaterThanOrEqual(quiet);
        }
    });

    it('prints the code at ~58mm for today’s redirect, a scan from about 60cm', async () => {
        const symbol = symbolBox(await render());
        expect(symbol.width / MM).toBeGreaterThan(55);
        expect(symbol.width / MM).toBeLessThan(62);
    });

    it('keeps every module comfortably above what a home printer can hold', async () => {
        const bytes = await render({}, OTHER_QR_URL);
        const module = Math.min(...darkModuleRects(bytes).map((rect) => rect.width));
        expect(module / MM).toBeGreaterThan(1);
    });

    it('uses error correction Q, so a covered corner still scans', () => {
        expect(QR_ERROR_CORRECTION).toBe('Q');
    });

    it('draws every vector ink in black or white — the colour lives in the artwork', async () => {
        const stream = inflatedStreams(await render()).toString('latin1');
        const fills = [...stream.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (rg|RG)/g)];
        expect(fills.length).toBeGreaterThan(100);
        for (const fill of fills) {
            expect(['0 0 0', '1 1 1']).toContain(`${fill[1]} ${fill[2]} ${fill[3]}`);
        }
    });
});
