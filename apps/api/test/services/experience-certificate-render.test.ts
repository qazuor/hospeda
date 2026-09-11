/**
 * WHICH string ends up inside the certificate's symbol (HOS-1129).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * The brochure had `commerce-brochure-render.test.ts` watching its QR; the
 * certificate had nothing looking inside its symbol at all. The e2e
 * (`experience-certificate-entitlement-allow.e2e.test.ts`) reaches the handler
 * and asserts 200, `application/pdf` and the `%PDF-` magic bytes — none of
 * which move when the drawn string changes. Measured before this file was
 * written: swapping `qrUrl` for `content.publicUrl` in `drawQr`'s call site —
 * the exact regression HOS-1129 exists to undo, on the least correctable
 * printed surface the platform has — left 259 tests green across 32 files.
 *
 * ## How the symbol is read back
 *
 * The QR is drawn as merged horizontal runs of dark modules, so the number of
 * filled paths in the page's content stream is a fingerprint of the encoded
 * string, and everything else on the page is held constant. That gives two
 * assertions no `toContain` could make:
 *
 * - moving `content.publicUrl` must leave the FILE byte-identical (the symbol
 *   does not depend on it, and nothing else on the sheet draws it), and
 * - moving `qrUrl` must move the filled-path count by a known number.
 *
 * The first alone would pass for a renderer that draws a constant; the second
 * alone would pass for one that draws both. Together they pin the source.
 *
 * ## Two ways to be green while measuring nothing, both avoided here
 *
 * - `pdf-lib` does NOT emit the `re` operator: a rectangle comes out as
 *   `m`/`l`/`l`/`l` then `h` (closepath) and `f` (fill). Counting `\sre\s`
 *   finds zero in every file, and a difference of zero minus zero is a green
 *   test that measured nothing. Hence the `h`/`f` pair, plus an explicit floor
 *   on the count.
 * - The expected delta is a FROZEN LITERAL, computed out of band from the
 *   `qrcode` package directly rather than from `renderQrMatrix`. An expected
 *   value computed with the same primitive as the observed one is blind to
 *   that primitive — a transposed or otherwise broken engine would move both
 *   sides together and stay green. `renderQrMatrix` is then checked against
 *   the same literal, which turns the blindness into coverage.
 *
 * @module test/services/experience-certificate-render
 */

import { inflateSync } from 'node:zlib';
import { QrCodeErrorCorrectionLevelEnum } from '@repo/schemas';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { CertificateContent } from '../../src/services/experience-certificate/certificate-content.js';
import { renderCertificatePdf } from '../../src/services/experience-certificate/certificate-render.js';
import { renderQrMatrix } from '../../src/utils/qr-render.js';

/**
 * What the QR encodes since HOS-1129: the platform's own redirect, never the
 * experience's address. The two are deliberately different strings in every
 * fixture below — a test that passed the same value for both could not tell
 * which one got drawn.
 */
const QR_URL = 'https://hospeda.com.ar/qr/K7Qm2XbT/';

/** A much longer redirect — a different QR version, so a different symbol. */
const OTHER_QR_URL = `https://hospeda.com.ar/qr/${'K7Qm2XbT'.repeat(8)}/`;

/**
 * Filled paths the two symbols above differ by, at error-correction level `M`.
 *
 * Frozen deliberately. Produced once, outside this module's code path, by
 * asking the `qrcode` package for both grids and counting merged horizontal
 * dark runs: 208 for {@link QR_URL} (a 29-module symbol) and 443 for
 * {@link OTHER_QR_URL} (41 modules). Everything else on the sheet is identical
 * between the two renders, so the whole difference is the symbol.
 *
 * If a future `qrcode` upgrade legitimately moves this number, BOTH assertions
 * below fail together and the new value is one command away. That is the point:
 * the literal is what makes the engine answerable to something other than
 * itself.
 */
const RUN_DELTA_BETWEEN_QR_URLS = 235;

/** The error-correction level `certificate-render.ts` prints at. */
const LEVEL = QrCodeErrorCorrectionLevelEnum.M;

/** A certificate with an accent in every field a reader would notice. */
function content(overrides: Partial<CertificateContent> = {}): CertificateContent {
    return {
        title: 'Certificado',
        preamble: 'El presente certifica que',
        recipientName: 'María José Fernández',
        connector: 'realizó la experiencia',
        experienceName: 'Pesca en el río Uruguay',
        dateLine: '14 de marzo de 2026',
        qrHint: 'Escaneá el código para conocer la experiencia.',
        footer: 'hospeda.com.ar',
        publicUrl: 'https://hospeda.com.ar/es/experiencias/pesca-en-el-rio-uruguay/',
        ...overrides
    };
}

/**
 * Every content stream in the file, inflated and concatenated.
 *
 * `pdf-lib` Flate-compresses page content, so the drawn geometry is not
 * greppable in the raw bytes. Nothing here reaches into the library's
 * internals: the streams are located by their PDF delimiters and inflated with
 * `zlib`, which is what any reader does.
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
            // Not a Flate stream. Not our business here.
        }
        cursor = end + 1;
    }
    return Buffer.concat(chunks);
}

/** Filled paths in the page content — one per drawn rectangle. See the header. */
function filledPaths(bytes: Uint8Array): number {
    const streams = inflatedStreams(bytes).toString('latin1');
    return (streams.match(/\nh\nf\n/g) ?? []).length;
}

/** Merged horizontal dark runs — exactly what `drawQr` emits per symbol. */
function darkRuns(url: string): number {
    const matrix = renderQrMatrix({ data: url, errorCorrectionLevel: LEVEL });
    let runs = 0;
    for (let row = 0; row < matrix.size; row += 1) {
        let inRun = false;
        for (let col = 0; col <= matrix.size; col += 1) {
            const dark = matrix.isDark(row, col);
            if (dark && !inRun) {
                inRun = true;
            } else if (!dark && inRun) {
                runs += 1;
                inRun = false;
            }
        }
    }
    return runs;
}

describe('what the certificate QR encodes (HOS-1129)', () => {
    it('draws a symbol at all, on a landscape A4 sheet', async () => {
        const bytes = await renderCertificatePdf({ content: content(), qrUrl: QR_URL });

        expect(Buffer.from(bytes).subarray(0, 5).toString('latin1')).toBe('%PDF-');

        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        // Landscape: the long edge is the width.
        expect(doc.getPage(0).getSize().width).toBeCloseTo(841.89, 2);
        expect(doc.getPage(0).getSize().height).toBeCloseTo(595.28, 2);

        // Without a floor here every count comparison below could be a green
        // difference between two zeros.
        expect(filledPaths(bytes)).toBeGreaterThan(100);
    });

    it('ignores content.publicUrl, which the sheet does not draw at all', async () => {
        const short = await renderCertificatePdf({
            content: content({ publicUrl: 'https://hospeda.com.ar/es/experiencias/a/' }),
            qrUrl: QR_URL
        });
        const long = await renderCertificatePdf({
            content: content({
                publicUrl: `https://hospeda.com.ar/es/experiencias/${'un-slug-larguisimo-'.repeat(6)}/`
            }),
            qrUrl: QR_URL
        });

        // Nothing on a certificate prints the ficha's address — it is only
        // where the redirect lands — so a different one must change nothing
        // whatsoever in the file, symbol included.
        expect(Buffer.from(short).equals(Buffer.from(long))).toBe(true);
    });

    it('follows qrUrl, module for module', async () => {
        const first = await renderCertificatePdf({ content: content(), qrUrl: QR_URL });
        const second = await renderCertificatePdf({ content: content(), qrUrl: OTHER_QR_URL });

        expect(filledPaths(second) - filledPaths(first)).toBe(RUN_DELTA_BETWEEN_QR_URLS);
    });

    it('and the engine that produced it answers to the same frozen number', () => {
        // The delta above is checked against a literal rather than against
        // `renderQrMatrix`, so this is where the engine is held to the same
        // measurement instead of being allowed to define it.
        expect(darkRuns(QR_URL)).toBe(208);
        expect(darkRuns(OTHER_QR_URL)).toBe(443);
        expect(darkRuns(OTHER_QR_URL) - darkRuns(QR_URL)).toBe(RUN_DELTA_BETWEEN_QR_URLS);
    });
});
