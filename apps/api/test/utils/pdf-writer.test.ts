/**
 * The PDF writer's primitives (HOS-1058).
 *
 * ---
 * WHAT THESE TESTS CAN AND CANNOT SEE
 *
 * They assert the FILE, not the rendering: structure, escaping, metrics and
 * marker parsing. Whether the resulting page is legible was verified out of
 * band with poppler (`pdfinfo` reported A4/1 page, `pdftotext` round-tripped
 * every accent and the `·` separator, `pdfimages -list` reported the embedded
 * photo as `800x533 rgb 3 8 jpeg`). None of that is re-run here, because CI has
 * no poppler — so a change that keeps the bytes valid and makes the layout
 * unreadable would pass. Read the assertions as "the file is well-formed and
 * says what we told it to", never as "the brochure looks right".
 *
 * @module test/utils/pdf-writer
 */

import { describe, expect, it } from 'vitest';
import { encodeWinAnsi, measureText, wrapText } from '../../src/utils/pdf/helvetica.js';
import { readJpeg } from '../../src/utils/pdf/jpeg.js';
import { escapePdfString, PdfDocument } from '../../src/utils/pdf/pdf-document.js';

/** Reads the whole document back as latin1 text, for structural assertions. */
function asText(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('latin1');
}

/** Builds a minimal JPEG: SOI, an APP0, one SOF, and an SOS. */
function makeJpeg(input: {
    sofMarker: number;
    width: number;
    height: number;
    components: number;
    precision?: number;
}): Uint8Array {
    const { sofMarker, width, height, components } = input;
    return new Uint8Array([
        0xff,
        0xd8, // SOI
        0xff,
        0xe0,
        0x00,
        0x04,
        0x00,
        0x00, // APP0, length 4
        0xff,
        sofMarker,
        0x00,
        0x0b,
        input.precision ?? 8,
        (height >> 8) & 0xff,
        height & 0xff,
        (width >> 8) & 0xff,
        width & 0xff,
        components,
        0x00,
        0x00,
        0xff,
        0xda // SOS
    ]);
}

describe('WinAnsi encoding (HOS-1058)', () => {
    it('passes ASCII through by codepoint', () => {
        expect(encodeWinAnsi({ text: 'Bar' })).toEqual([0x42, 0x61, 0x72]);
    });

    it('encodes Spanish and Portuguese accents as their Latin-1 bytes', () => {
        expect(encodeWinAnsi({ text: 'ñáçã' })).toEqual([0xf1, 0xe1, 0xe7, 0xe3]);
    });

    it('maps the CP1252 punctuation window, which is what pasted copy carries', () => {
        // ’ “ ” – — … •  — none of these exist in Latin-1.
        expect(encodeWinAnsi({ text: '’“”–—…•' })).toEqual([
            0x92, 0x93, 0x94, 0x96, 0x97, 0x85, 0x95
        ]);
    });

    it('replaces a character this font cannot draw rather than dropping it', () => {
        expect(encodeWinAnsi({ text: 'a漢b' })).toEqual([0x61, 0x3f, 0x62]);
    });

    it('turns a newline into a space, since a literal newline positions nothing', () => {
        expect(encodeWinAnsi({ text: 'a\nb' })).toEqual([0x61, 0x20, 0x62]);
    });
});

describe('Helvetica metrics (HOS-1058)', () => {
    it('measures a known string against the Adobe advance widths', () => {
        // H(722) + i(222) + space(278) = 1222 thousandths at 10pt = 12.22pt.
        expect(measureText({ text: 'Hi ', font: 'Helvetica', size: 10 })).toBeCloseTo(12.22, 5);
    });

    it('gives a composed glyph the width of its base letter', () => {
        expect(measureText({ text: 'ñ', font: 'Helvetica', size: 12 })).toBe(
            measureText({ text: 'n', font: 'Helvetica', size: 12 })
        );
    });

    it('measures bold wider than regular for the same capital', () => {
        expect(measureText({ text: 'A', font: 'Helvetica-Bold', size: 12 })).toBeGreaterThan(
            measureText({ text: 'A', font: 'Helvetica', size: 12 })
        );
    });

    it('scales linearly with font size', () => {
        const small = measureText({ text: 'Hospeda', font: 'Helvetica', size: 10 });
        const big = measureText({ text: 'Hospeda', font: 'Helvetica', size: 20 });
        expect(big).toBeCloseTo(small * 2, 5);
    });
});

describe('text wrapping (HOS-1058)', () => {
    it('keeps every line inside the column', () => {
        const text =
            'Parrilla a la vista sobre el río Uruguay, con pescado de la zona y carnes al asador.';
        const lines = wrapText({ text, font: 'Helvetica', size: 10, maxWidth: 120 });

        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines) {
            expect(measureText({ text: line, font: 'Helvetica', size: 10 })).toBeLessThanOrEqual(
                120
            );
        }
        expect(lines.join(' ')).toBe(text);
    });

    it('breaks a single over-wide word instead of letting it run off the paper', () => {
        // The real case: a long URL in the contact block of a printed sheet.
        const url = 'https://hospeda.com.ar/es/gastronomia/un-slug-extremadamente-largo-de-verdad/';
        const lines = wrapText({ text: url, font: 'Helvetica', size: 8.5, maxWidth: 90 });

        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines) {
            expect(measureText({ text: line, font: 'Helvetica', size: 8.5 })).toBeLessThanOrEqual(
                90
            );
        }
        expect(lines.join('')).toBe(url);
    });

    it('returns nothing for whitespace-only input', () => {
        expect(wrapText({ text: '   \n  ', font: 'Helvetica', size: 10, maxWidth: 100 })).toEqual(
            []
        );
    });
});

describe('PDF string escaping (HOS-1058)', () => {
    it('escapes the two characters that would terminate the string early', () => {
        // A real listing name: "La Parrilla del Puerto (el de la esquina)".
        expect(escapePdfString({ text: 'Bar (el de la esquina)' })).toBe(
            'Bar \\(el de la esquina\\)'
        );
    });

    it('escapes a backslash', () => {
        expect(escapePdfString({ text: 'a\\b' })).toBe('a\\\\b');
    });

    it('writes a high byte as an octal escape, keeping the document ASCII', () => {
        // ñ is 0xF1 = 361 octal.
        expect(escapePdfString({ text: 'ñ' })).toBe('\\361');
    });
});

describe('PdfDocument serialisation (HOS-1058)', () => {
    /** A one-page document with a line of text. */
    function sample(): Uint8Array {
        const doc = new PdfDocument();
        doc.setTitle({ title: 'La Parrilla (el de la esquina)' });
        doc.addPage();
        doc.drawRect({ x: 0, y: 0, width: 100, height: 20, color: [0, 0.5, 1] });
        doc.drawText({ text: 'Hospeda', x: 48, y: 60, font: 'Helvetica-Bold', size: 12 });
        return doc.toBytes();
    }

    it('emits a PDF header and an EOF trailer', () => {
        const text = asText(sample());
        expect(text.startsWith('%PDF-1.4\n')).toBe(true);
        expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('points every xref entry at the byte where its object actually starts', () => {
        // The one structural invariant a reader cannot recover from: an offset
        // that is off by a byte makes the whole file unopenable.
        const bytes = sample();
        const text = asText(bytes);
        const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
        expect(Number.isFinite(startxref)).toBe(true);
        expect(text.slice(startxref, startxref + 4)).toBe('xref');

        const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
            Number(match[1])
        );
        expect(entries.length).toBeGreaterThanOrEqual(6);
        entries.forEach((offset, index) => {
            expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(
                `${index + 1} 0 obj`
            );
        });
    });

    it('declares WinAnsiEncoding on both faces, which is what the metrics assume', () => {
        const text = asText(sample());
        expect(text).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
        expect(text).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    });

    it('escapes the title in the Info dictionary', () => {
        expect(asText(sample())).toContain('/Title (La Parrilla \\(el de la esquina\\))');
    });

    it('is byte-identical across runs, so the same listing yields the same file', () => {
        expect(Buffer.from(sample()).equals(Buffer.from(sample()))).toBe(true);
    });

    it('declares a page per addPage and an A4 MediaBox', () => {
        const doc = new PdfDocument();
        doc.addPage();
        doc.drawText({ text: 'one', x: 10, y: 10, font: 'Helvetica', size: 10 });
        doc.addPage();
        doc.drawText({ text: 'two', x: 10, y: 10, font: 'Helvetica', size: 10 });
        const text = asText(doc.toBytes());

        expect(text).toContain('/Type /Pages /Count 2');
        expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
    });

    it('embeds a JPEG as a DCTDecode XObject carrying its real dimensions', () => {
        const jpeg = readJpeg({
            bytes: makeJpeg({ sofMarker: 0xc0, width: 800, height: 533, components: 3 })
        });
        expect(jpeg).not.toBeNull();

        const doc = new PdfDocument();
        doc.addPage();
        const handle = doc.addJpeg({ jpeg: jpeg as NonNullable<typeof jpeg> });
        doc.drawImage({ image: handle, x: 0, y: 0, width: 100, height: 66 });
        const text = asText(doc.toBytes());

        expect(text).toContain('/Subtype /Image /Width 800 /Height 533');
        expect(text).toContain('/ColorSpace /DeviceRGB');
        expect(text).toContain('/Filter /DCTDecode');
        expect(text).toContain(`/${handle.name} Do`);
    });

    it('refuses to serialise a document with no pages rather than emit an unopenable file', () => {
        expect(() => new PdfDocument().toBytes()).toThrow(/no pages/);
    });
});

describe('JPEG inspection (HOS-1058)', () => {
    it('reads a baseline frame header', () => {
        expect(
            readJpeg({
                bytes: makeJpeg({ sofMarker: 0xc0, width: 640, height: 480, components: 3 })
            })
        ).toMatchObject({ width: 640, height: 480, components: 3 });
    });

    it('accepts extended sequential (SOF1), which DCTDecode also handles', () => {
        expect(
            readJpeg({ bytes: makeJpeg({ sofMarker: 0xc1, width: 10, height: 10, components: 1 }) })
        ).toMatchObject({ components: 1 });
    });

    it('refuses a PROGRESSIVE jpeg, which renders blank through DCTDecode', () => {
        // Not hypothetical: `apps/admin/public/images/auth/sanjose.jpg`, a real
        // asset in this repo, is SOF2.
        expect(
            readJpeg({ bytes: makeJpeg({ sofMarker: 0xc2, width: 10, height: 10, components: 3 }) })
        ).toBeNull();
    });

    it('refuses CMYK, which would need a different colour space and Decode array', () => {
        expect(
            readJpeg({ bytes: makeJpeg({ sofMarker: 0xc0, width: 10, height: 10, components: 4 }) })
        ).toBeNull();
    });

    it('refuses 12-bit samples, which /BitsPerComponent 8 would misdescribe', () => {
        expect(
            readJpeg({
                bytes: makeJpeg({
                    sofMarker: 0xc0,
                    width: 10,
                    height: 10,
                    components: 3,
                    precision: 12
                })
            })
        ).toBeNull();
    });

    it('refuses a file that is not a JPEG at all', () => {
        // A PNG signature: what an owner's uploaded logo often really is.
        expect(
            readJpeg({ bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) })
        ).toBeNull();
    });

    it('refuses a truncated file instead of reading past its end', () => {
        expect(readJpeg({ bytes: new Uint8Array([0xff, 0xd8]) })).toBeNull();
    });
});
