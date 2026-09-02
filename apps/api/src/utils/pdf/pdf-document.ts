/**
 * A minimal, dependency-free PDF writer (HOS-1058).
 *
 * ---
 * WHY THIS EXISTS INSTEAD OF A LIBRARY
 *
 * The repo carries no PDF dependency, and adding one is an owner decision this
 * issue did not carry (`docs/guides/dependency-policy.md`). What HOS-1058
 * actually needs is narrow enough to write down: one or two A4 pages, two
 * weights of one font the viewer already has, filled rectangles, a QR, and a
 * photo. That is a few hundred lines of a format that has not changed since
 * 1993 — against a transitive tree, a headless browser, or a native binary in
 * the deploy image.
 *
 * It is deliberately NOT a general-purpose renderer. No embedded fonts, no
 * compression, no transparency, no vector paths beyond rectangles, no PNG. If a
 * later document needs any of that, that is the moment to reopen the
 * dependency question rather than to grow this file.
 *
 * ## What a PDF is, in the amount this file needs
 *
 * A header, a flat list of numbered objects, a cross-reference table giving the
 * BYTE OFFSET of each object, and a trailer pointing at the table. Readers seek
 * by those offsets, so the offsets have to be counted over the real bytes —
 * which is why this file assembles `Uint8Array` chunks and never a string: a
 * JPEG in the middle of the document makes byte length and string length two
 * different numbers.
 *
 * Everything this writer emits outside an image stream is ASCII (non-ASCII text
 * is octal-escaped by {@link escapePdfString}), so the two lengths agree for
 * every chunk it builds itself.
 *
 * ## Coordinates
 *
 * PDF's origin is the BOTTOM-left corner and y grows upward. Callers here think
 * top-down, so every drawing method takes a top-down `y` and flips it against
 * the page height exactly once, at the boundary. Nothing downstream of a
 * `draw*` call sees top-down coordinates, and nothing upstream sees PDF ones.
 *
 * @module utils/pdf/pdf-document
 */

import { encodeWinAnsi, type PdfFontName } from './helvetica.js';

/** An RGB colour, each channel in `[0, 1]` as PDF expects. */
export type PdfColor = readonly [number, number, number];

/** A JPEG registered with the document, ready to be drawn. */
export interface PdfImageHandle {
    /** Resource name inside the content stream, e.g. `Im0`. */
    readonly name: string;
    /** Intrinsic pixel width, for aspect-ratio maths in the layout. */
    readonly width: number;
    /** Intrinsic pixel height. */
    readonly height: number;
}

/** A JPEG's bytes plus the facts the PDF image dictionary must declare. */
export interface PdfJpeg {
    readonly bytes: Uint8Array;
    readonly width: number;
    readonly height: number;
    /** 1 → DeviceGray, 3 → DeviceRGB. CMYK is rejected before it gets here. */
    readonly components: 1 | 3;
}

/** A4, in PDF points (1/72 inch). The only page size this writer emits. */
export const A4_WIDTH = 595.28;
/** A4 height in points. */
export const A4_HEIGHT = 841.89;

/** Font resource names, fixed so the content stream can reference them directly. */
const FONT_RESOURCE: Readonly<Record<PdfFontName, string>> = {
    Helvetica: 'F1',
    'Helvetica-Bold': 'F2'
};

/**
 * Formats a number for a content stream.
 *
 * Three decimals is finer than a printer resolves and keeps the stream small.
 * `-0` is normalised away because some strict parsers reject it.
 */
function num(value: number): string {
    if (!Number.isFinite(value)) {
        return '0';
    }
    const rounded = Math.round(value * 1000) / 1000;
    return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Escapes text for a PDF literal string.
 *
 * Backslash and both parens must be escaped or the string terminates early —
 * a listing named `Bar (el de la esquina)` would otherwise truncate the
 * document from that byte onward. Everything outside printable ASCII is written
 * as an octal escape, which keeps the whole document ASCII and makes byte
 * offsets and string offsets the same number.
 *
 * @param input.text - Text already destined for a WinAnsi-encoded font.
 * @returns The escaped literal, WITHOUT its surrounding parens.
 */
export function escapePdfString(input: { text: string }): string {
    let out = '';
    for (const byte of encodeWinAnsi({ text: input.text })) {
        if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
            out += `\\${String.fromCharCode(byte)}`;
        } else if (byte >= 0x20 && byte <= 0x7e) {
            out += String.fromCharCode(byte);
        } else {
            out += `\\${byte.toString(8).padStart(3, '0')}`;
        }
    }
    return out;
}

/** ASCII → bytes. Safe here because every non-image chunk is ASCII by construction. */
function ascii(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
        bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return bytes;
}

/** One page under construction: its content-stream operators, in order. */
interface PageState {
    readonly ops: string[];
    readonly width: number;
    readonly height: number;
}

/**
 * Builds a PDF document one drawing call at a time.
 *
 * Not thread-safe and not reusable: build one, serialise it, throw it away.
 */
export class PdfDocument {
    private readonly pages: PageState[] = [];
    private readonly images: { handle: PdfImageHandle; jpeg: PdfJpeg }[] = [];
    /** Document title, written into the Info dictionary. */
    private title = '';

    /**
     * Starts a new page and makes it current.
     *
     * @param input.width - Page width in points. Defaults to A4.
     * @param input.height - Page height in points. Defaults to A4.
     */
    addPage(input: { width?: number; height?: number } = {}): void {
        this.pages.push({
            ops: [],
            width: input.width ?? A4_WIDTH,
            height: input.height ?? A4_HEIGHT
        });
    }

    /** Sets the document title shown in a viewer's title bar. */
    setTitle(input: { title: string }): void {
        this.title = input.title;
    }

    /** The current page, or a thrown error if the caller never opened one. */
    private get current(): PageState {
        const page = this.pages[this.pages.length - 1];
        if (!page) {
            throw new Error('PdfDocument: draw called before addPage');
        }
        return page;
    }

    /** Height of the current page, in points. */
    get pageHeight(): number {
        return this.current.height;
    }

    /** Width of the current page, in points. */
    get pageWidth(): number {
        return this.current.width;
    }

    /** Number of pages added so far. */
    get pageCount(): number {
        return this.pages.length;
    }

    /**
     * Registers a JPEG so it can be drawn.
     *
     * Registration is document-wide: the same handle may be drawn on several
     * pages and the bytes are stored once.
     *
     * @param input.jpeg - The decoded facts plus the original bytes.
     * @returns The handle to pass to {@link drawImage}.
     */
    addJpeg(input: { jpeg: PdfJpeg }): PdfImageHandle {
        const handle: PdfImageHandle = {
            name: `Im${this.images.length}`,
            width: input.jpeg.width,
            height: input.jpeg.height
        };
        this.images.push({ handle, jpeg: input.jpeg });
        return handle;
    }

    /**
     * Draws a single line of text.
     *
     * @param input.text - The line. Newlines are not honoured; wrap first.
     * @param input.x - Left edge, in points from the page's left.
     * @param input.y - BASELINE, in points from the page's TOP.
     * @param input.font - Face to draw in.
     * @param input.size - Font size in points.
     * @param input.color - Fill colour. Defaults to black.
     */
    drawText(input: {
        text: string;
        x: number;
        y: number;
        font: PdfFontName;
        size: number;
        color?: PdfColor;
    }): void {
        const page = this.current;
        const [r, g, b] = input.color ?? [0, 0, 0];
        const pdfY = page.height - input.y;
        page.ops.push(
            `BT ${num(r)} ${num(g)} ${num(b)} rg /${FONT_RESOURCE[input.font]} ${num(input.size)} Tf ` +
                `1 0 0 1 ${num(input.x)} ${num(pdfY)} Tm (${escapePdfString({ text: input.text })}) Tj ET`
        );
    }

    /**
     * Fills a rectangle.
     *
     * @param input.x - Left edge in points.
     * @param input.y - TOP edge, in points from the page's top.
     * @param input.width - Width in points.
     * @param input.height - Height in points.
     * @param input.color - Fill colour.
     */
    drawRect(input: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: PdfColor;
    }): void {
        const page = this.current;
        const [r, g, b] = input.color;
        const pdfY = page.height - input.y - input.height;
        page.ops.push(
            `${num(r)} ${num(g)} ${num(b)} rg ${num(input.x)} ${num(pdfY)} ${num(input.width)} ${num(input.height)} re f`
        );
    }

    /**
     * Draws a registered JPEG scaled into a box.
     *
     * The image fills the box exactly; preserving the aspect ratio is the
     * caller's job, since only the caller knows whether it would rather crop or
     * letterbox.
     *
     * @param input.image - Handle from {@link addJpeg}.
     * @param input.x - Left edge in points.
     * @param input.y - TOP edge, in points from the page's top.
     * @param input.width - Drawn width in points.
     * @param input.height - Drawn height in points.
     */
    drawImage(input: {
        image: PdfImageHandle;
        x: number;
        y: number;
        width: number;
        height: number;
    }): void {
        const page = this.current;
        const pdfY = page.height - input.y - input.height;
        page.ops.push(
            `q ${num(input.width)} 0 0 ${num(input.height)} ${num(input.x)} ${num(pdfY)} cm /${input.image.name} Do Q`
        );
    }

    /**
     * Serialises the document.
     *
     * Object numbering, fixed so the layout below is readable:
     *   1        Catalog
     *   2        Pages
     *   3        Helvetica
     *   4        Helvetica-Bold
     *   5        Info
     *   6..      one Page + one content stream per page, then one XObject per image
     *
     * @returns The complete file. Ready to send as `application/pdf`.
     *   Typed over a concrete `ArrayBuffer` rather than `ArrayBufferLike` so it
     *   satisfies `BodyInit` — a `Uint8Array<ArrayBufferLike>` could be backed
     *   by a `SharedArrayBuffer`, which `Response` does not accept.
     */
    toBytes(): Uint8Array<ArrayBuffer> {
        if (this.pages.length === 0) {
            // A zero-page PDF is invalid, and an empty brochure is a bug
            // upstream. Fail loudly rather than emit a file no viewer opens.
            throw new Error('PdfDocument: cannot serialise a document with no pages');
        }

        const chunks: Uint8Array[] = [];
        const offsets: number[] = [];
        let offset = 0;

        const push = (bytes: Uint8Array): void => {
            chunks.push(bytes);
            offset += bytes.length;
        };
        const pushAscii = (text: string): void => push(ascii(text));

        /** Records the byte offset at which object `id` starts. */
        const startObject = (id: number): void => {
            offsets[id] = offset;
            pushAscii(`${id} 0 obj\n`);
        };

        const firstPageId = 6;
        const pageIds = this.pages.map((_, index) => firstPageId + index * 2);
        const contentIds = this.pages.map((_, index) => firstPageId + index * 2 + 1);
        const imageIds = this.images.map((_, index) => firstPageId + this.pages.length * 2 + index);
        const totalObjects = 5 + this.pages.length * 2 + this.images.length;

        // %PDF-1.4, then a comment line of high bytes. The second line is the
        // convention that tells a naive transfer this file is binary; harmless
        // here and expected by some validators.
        pushAscii('%PDF-1.4\n');
        push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

        // 1 — Catalog
        startObject(1);
        pushAscii('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

        // 2 — Pages
        startObject(2);
        pushAscii(
            `<< /Type /Pages /Count ${this.pages.length} /Kids [${pageIds
                .map((id) => `${id} 0 R`)
                .join(' ')}] >>\nendobj\n`
        );

        // 3, 4 — the two standard-14 faces. No FontDescriptor and no embedded
        // program: every conforming viewer carries these.
        startObject(3);
        pushAscii(
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
        );
        startObject(4);
        pushAscii(
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
        );

        // 5 — Info. No /CreationDate: the same listing must produce the same
        // bytes on every call, so a caching layer (or a test) can compare them.
        startObject(5);
        pushAscii(
            `<< /Title (${escapePdfString({ text: this.title })}) /Producer (Hospeda) >>\nendobj\n`
        );

        const xObjectEntries = this.images
            .map((entry, index) => `/${entry.handle.name} ${imageIds[index]} 0 R`)
            .join(' ');
        const resources =
            `<< /Font << /F1 3 0 R /F2 4 0 R >>` +
            (xObjectEntries.length > 0 ? ` /XObject << ${xObjectEntries} >>` : '') +
            ' >>';

        this.pages.forEach((page, index) => {
            const pageId = pageIds[index] as number;
            const contentId = contentIds[index] as number;

            startObject(pageId);
            pushAscii(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ` +
                    `/Resources ${resources} /Contents ${contentId} 0 R >>\nendobj\n`
            );

            const content = `${page.ops.join('\n')}\n`;
            startObject(contentId);
            pushAscii(`<< /Length ${content.length} >>\nstream\n`);
            pushAscii(content);
            pushAscii('endstream\nendobj\n');
        });

        this.images.forEach((entry, index) => {
            const id = imageIds[index] as number;
            const { jpeg } = entry;
            startObject(id);
            pushAscii(
                `<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} ` +
                    `/ColorSpace ${jpeg.components === 1 ? '/DeviceGray' : '/DeviceRGB'} ` +
                    `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>\nstream\n`
            );
            push(jpeg.bytes);
            pushAscii('\nendstream\nendobj\n');
        });

        const xrefOffset = offset;
        pushAscii(`xref\n0 ${totalObjects + 1}\n`);
        pushAscii('0000000000 65535 f \n');
        for (let id = 1; id <= totalObjects; id += 1) {
            pushAscii(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
        }
        pushAscii(
            `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
        );

        const out = new Uint8Array(offset);
        let cursor = 0;
        for (const chunk of chunks) {
            out.set(chunk, cursor);
            cursor += chunk.length;
        }
        return out;
    }
}
