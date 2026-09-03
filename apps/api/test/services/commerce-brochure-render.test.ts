/**
 * The rendered brochure file (HOS-1058).
 *
 * ---
 * WHAT THESE TESTS CAN AND CANNOT SEE
 *
 * They assert the FILE, not its appearance: that it parses back as A4, that the
 * copy we asked for is in the page's content stream, that the cover photo
 * really became an image XObject, and that two runs are byte-identical. Whether
 * the sheet is legible was verified out of band with poppler — `pdfinfo`
 * reported A4/1 page, `pdftotext` round-tripped every accent and the `·`
 * separator, `pdfimages -list` reported the cover as an embedded image, and a
 * `pdftoppm` raster showed the photo drawn rather than blank. CI has no poppler,
 * so none of that is re-run here: a change that keeps the bytes valid and makes
 * the layout unreadable would pass.
 *
 * ## The fixtures are the point of the whole change
 *
 * `cover-progressive.jpg` is a PROGRESSIVE JPEG (SOF2) — the format Cloudinary
 * serves and the one the hand-written writer this replaced refused outright,
 * printing the sheet with no photo at all. `cover-alpha.png` is a PNG with an
 * alpha channel, which that writer could not carry in any form. Both are
 * asserted to embed. If either fixture is ever regenerated as something else,
 * the format assertions below say so instead of the coverage quietly
 * evaporating.
 *
 * @module test/services/commerce-brochure-render
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { BrochureContent } from '../../src/services/commerce-brochure/brochure-content.js';
import {
    type BrochureCover,
    detectCoverFormat
} from '../../src/services/commerce-brochure/brochure-cover.js';
import {
    renderBrochurePdf,
    toDrawableText,
    wrapText
} from '../../src/services/commerce-brochure/brochure-render.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

/** A progressive JPEG: the case that motivated replacing the hand-written writer. */
const PROGRESSIVE_JPEG = new Uint8Array(readFileSync(join(FIXTURES, 'cover-progressive.jpg')));

/** The same picture, baseline — the only shape the old writer accepted. */
const BASELINE_JPEG = new Uint8Array(readFileSync(join(FIXTURES, 'cover-baseline.jpg')));

/** A PNG with transparency, which the old writer could not carry at all. */
const ALPHA_PNG = new Uint8Array(readFileSync(join(FIXTURES, 'cover-alpha.png')));

/** A brochure with an accent in every field a reader would notice. */
function content(overrides: Partial<BrochureContent> = {}): BrochureContent {
    return {
        title: 'La Parrilla del Puerto',
        subtitle: 'Parrilla · Concepción del Uruguay',
        price: '$$ — precio medio',
        intro: 'Parrilla a la vista sobre el río Uruguay, con pescado de la zona.',
        sections: [{ heading: 'Horarios', lines: ['Martes: 12:00 a 15:30', 'Miércoles: cerrado'] }],
        url: 'https://hospeda.com.ar/es/gastronomia/la-parrilla-del-puerto/',
        qrHint: 'Escaneá para ver la ficha completa',
        footer: 'Hospeda · hospeda.com.ar',
        coverImageUrl: null,
        ...overrides
    } as BrochureContent;
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
        if (start === -1) {
            break;
        }
        const end = raw.indexOf('endstream', start);
        if (end === -1) {
            break;
        }
        // Skip `stream` plus its mandatory EOL (CRLF or LF).
        let from = start + 'stream'.length;
        if (raw[from] === 0x0d) {
            from += 1;
        }
        if (raw[from] === 0x0a) {
            from += 1;
        }
        try {
            chunks.push(inflateSync(raw.subarray(from, end)));
        } catch {
            // Not a Flate stream (an embedded JPEG, say). Not our business here.
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
    const streams = inflatedStreams(bytes).toString('latin1').toLowerCase();
    return streams.includes(hex.toLowerCase());
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

describe('the fixtures are what they claim to be (HOS-1058)', () => {
    it('ships a genuinely PROGRESSIVE jpeg, the case the old writer refused', () => {
        // SOF2 (0xFFC2) is what makes a JPEG progressive; SOF0 is baseline.
        expect(Buffer.from(PROGRESSIVE_JPEG).includes(Buffer.from([0xff, 0xc2]))).toBe(true);
        expect(Buffer.from(BASELINE_JPEG).includes(Buffer.from([0xff, 0xc2]))).toBe(false);
    });

    it('names each fixture by its magic number, not by its extension', () => {
        expect(detectCoverFormat({ bytes: PROGRESSIVE_JPEG })).toBe('jpeg');
        expect(detectCoverFormat({ bytes: BASELINE_JPEG })).toBe('jpeg');
        expect(detectCoverFormat({ bytes: ALPHA_PNG })).toBe('png');
    });

    it('refuses a format no PDF can carry, and a file too short to tell', () => {
        // 'RIFF....WEBP' — what `f_auto` would have answered.
        const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
        expect(detectCoverFormat({ bytes: webp })).toBeNull();
        expect(detectCoverFormat({ bytes: new Uint8Array([0xff, 0xd8]) })).toBeNull();
        expect(detectCoverFormat({ bytes: new Uint8Array() })).toBeNull();
    });
});

describe('the brochure file (HOS-1058)', () => {
    it('is an A4 PDF of one page carrying the listing name as its title', async () => {
        const bytes = await renderBrochurePdf({ content: content(), cover: null });

        expect(Buffer.from(bytes).subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(Buffer.from(bytes).toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);

        const seen = await reread(bytes);
        expect(seen.pages).toBe(1);
        expect(seen.size.width).toBeCloseTo(595.28, 2);
        expect(seen.size.height).toBeCloseTo(841.89, 2);
        expect(seen.title).toBe('La Parrilla del Puerto');
    });

    it('draws the copy it was given, accents and separators included', async () => {
        const bytes = await renderBrochurePdf({ content: content(), cover: null });

        expect(drawsText(bytes, 'La Parrilla del Puerto')).toBe(true);
        expect(drawsText(bytes, 'Parrilla \xb7 Concepci\xf3n del Uruguay')).toBe(true);
        expect(drawsText(bytes, 'Mi\xe9rcoles: cerrado')).toBe(true);
        expect(drawsText(bytes, 'Escane\xe1 para ver la ficha completa')).toBe(true);
    });

    it('is byte-identical across runs, so the same listing yields the same file', async () => {
        const first = await renderBrochurePdf({ content: content(), cover: null });
        const second = await renderBrochurePdf({ content: content(), cover: null });
        expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    });

    it('opens a second page rather than running copy off the first', async () => {
        const lines = Array.from({ length: 90 }, (_, index) => `Línea número ${index} del menú.`);
        const bytes = await renderBrochurePdf({
            content: content({ sections: [{ heading: 'Carta', lines }] }),
            cover: null
        });

        expect((await reread(bytes)).pages).toBeGreaterThan(1);
    });

    it('prints a name this font cannot draw instead of answering an error', async () => {
        // A standard face covers WinAnsi and no more, and pdf-lib raises rather
        // than guessing — an uncaught raise is a 500 on a download.
        const bytes = await renderBrochurePdf({
            content: content({ title: 'Sushi 漢 del Puerto' }),
            cover: null
        });

        expect((await reread(bytes)).pages).toBe(1);
        expect(drawsText(bytes, 'Sushi ? del Puerto')).toBe(true);
    });
});

describe('the cover photo (HOS-1058)', () => {
    /** How many image XObjects the file declares. */
    function imageCount(bytes: Uint8Array): number {
        const text = Buffer.from(bytes).toString('latin1');
        return (text.match(/\/Subtype\s*\/Image/g) ?? []).length;
    }

    async function renderWith(cover: BrochureCover | null): Promise<Uint8Array> {
        return renderBrochurePdf({ content: content(), cover });
    }

    it('embeds a PROGRESSIVE jpeg — the photo the old writer dropped on the floor', async () => {
        const bytes = await renderWith({ bytes: PROGRESSIVE_JPEG, format: 'jpeg' });
        expect(imageCount(bytes)).toBeGreaterThanOrEqual(1);
        // The JPEG travels verbatim, so its own bytes are in the file.
        expect(Buffer.from(bytes).includes(Buffer.from(PROGRESSIVE_JPEG))).toBe(true);
    });

    it('embeds a baseline jpeg too, which is the only thing that used to work', async () => {
        const bytes = await renderWith({ bytes: BASELINE_JPEG, format: 'jpeg' });
        expect(Buffer.from(bytes).includes(Buffer.from(BASELINE_JPEG))).toBe(true);
    });

    it('embeds a PNG, and its alpha channel as a soft mask', async () => {
        const bytes = await renderWith({ bytes: ALPHA_PNG, format: 'png' });
        // Two XObjects: the picture and the /SMask carrying its transparency.
        expect(imageCount(bytes)).toBe(2);
        expect(Buffer.from(bytes).toString('latin1')).toContain('/SMask');
    });

    it('prints the sheet without a photo rather than failing on bytes it cannot embed', async () => {
        const bytes = await renderWith({
            bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]),
            format: 'jpeg'
        });

        expect((await reread(bytes)).pages).toBe(1);
        expect(imageCount(bytes)).toBe(0);
        expect(drawsText(bytes, 'La Parrilla del Puerto')).toBe(true);
    });

    it('prints the sheet without a photo when there is none', async () => {
        const bytes = await renderWith(null);
        expect(imageCount(bytes)).toBe(0);
    });
});

describe('text fitting (HOS-1058)', () => {
    async function helvetica() {
        const doc = await PDFDocument.create();
        return doc.embedFont(StandardFonts.Helvetica);
    }

    it('keeps every line inside the column', async () => {
        const font = await helvetica();
        const text =
            'Parrilla a la vista sobre el río Uruguay, con pescado de la zona y carnes al asador.';
        const lines = wrapText({ text, font, size: 10, maxWidth: 120 });

        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines) {
            expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(120);
        }
        expect(lines.join(' ')).toBe(text);
    });

    it('breaks a single over-wide word instead of letting it run off the paper', async () => {
        const font = await helvetica();
        // The real case: a long URL in the contact block of a printed sheet.
        const url = 'https://hospeda.com.ar/es/gastronomia/un-slug-extremadamente-largo-de-verdad/';
        const lines = wrapText({ text: url, font, size: 8.5, maxWidth: 90 });

        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines) {
            expect(font.widthOfTextAtSize(line, 8.5)).toBeLessThanOrEqual(90);
        }
        expect(lines.join('')).toBe(url);
    });

    it('returns nothing for whitespace-only input', async () => {
        const font = await helvetica();
        expect(wrapText({ text: '   \n  ', font, size: 10, maxWidth: 100 })).toEqual([]);
    });

    it('keeps Spanish and Portuguese copy untouched and flattens a newline', async () => {
        const font = await helvetica();
        expect(toDrawableText({ text: 'ñáçã “—” · €', font })).toBe('ñáçã “—” · €');
        expect(toDrawableText({ text: 'a\nb\tc', font })).toBe('a b c');
    });

    it('replaces a character this font cannot draw rather than dropping it', async () => {
        const font = await helvetica();
        expect(toDrawableText({ text: 'a漢b', font })).toBe('a?b');
    });
});
