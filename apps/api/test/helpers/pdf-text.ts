/**
 * Reading text back out of a generated PDF, the way a viewer does.
 *
 * ---
 * `pdf-lib` Flate-compresses page content, so drawn text is NOT greppable in the
 * raw bytes — `bytes.toString('latin1').includes('Some Name')` is always false,
 * whatever the sheet actually says. A test that asserts that way passes only
 * while the renderer happens to leave content uncompressed, and starts failing
 * on a library swap for a reason that has nothing to do with the page.
 *
 * Nothing here reaches into the library's internals: streams are located by
 * their PDF delimiters and inflated with `zlib`, which is what any reader does.
 *
 * @module test/helpers/pdf-text
 */

import { inflateSync } from 'node:zlib';

/**
 * Every content stream in the file, inflated and concatenated.
 *
 * @param bytes - The PDF file as produced.
 * @returns The inflated streams, joined. Streams that are not Flate-encoded
 *   (an embedded JPEG, say) are skipped rather than throwing.
 */
export function inflatedStreams(bytes: Uint8Array): Buffer {
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
 *
 * @param bytes - The PDF file as produced.
 * @param text - The string the page is expected to draw.
 * @returns Whether the drawn content contains it.
 */
export function drawsText(bytes: Uint8Array, text: string): boolean {
    const hex = Buffer.from(text, 'latin1').toString('hex');
    const streams = inflatedStreams(bytes).toString('latin1').toLowerCase();
    return streams.includes(hex.toLowerCase());
}
