/**
 * The pill's line-fitting rule (HOS-2688): shrink to a floor, then cut with «…».
 *
 * Tested with a synthetic metric (every character is `size * 0.5` wide) so the
 * expected sizes and cuts can be worked out by hand, and once with the real
 * Helvetica-Bold metric through `fitPillName`.
 *
 * @module test/services/listing-qr-sheet-fit
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
    ELLIPSIS,
    fitLine,
    type WidthOf
} from '../../src/services/listing-qr-sheet/qr-sheet-fit.js';
import {
    fitPillName,
    PILL_NAME_SIZE_MAX,
    PILL_NAME_SIZE_MIN,
    PILL_TEXT_WIDTH
} from '../../src/services/listing-qr-sheet/qr-sheet-render.js';

/** Every character is half the font size wide. */
const halfEm: WidthOf = ({ text, size }) => [...text].length * size * 0.5;

describe('fitLine', () => {
    it('keeps the largest size when the text already fits', () => {
        // Arrange: 10 chars at 20pt = 100pt.
        // Act
        const fitted = fitLine({
            text: 'ABCDEFGHIJ',
            maxWidth: 100,
            maxSize: 20,
            minSize: 10,
            widthOf: halfEm
        });
        // Assert
        expect(fitted).toEqual({ text: 'ABCDEFGHIJ', size: 20, truncated: false });
    });

    it('shrinks to the largest size that fits', () => {
        // 20 chars: fits when size * 10 <= 150 → 15pt.
        const fitted = fitLine({
            text: 'A'.repeat(20),
            maxWidth: 150,
            maxSize: 20,
            minSize: 10,
            widthOf: halfEm
        });
        expect(fitted).toEqual({ text: 'A'.repeat(20), size: 15, truncated: false });
    });

    it('fits exactly at the floor without cutting', () => {
        // 20 chars at 10pt = 100pt.
        const fitted = fitLine({
            text: 'A'.repeat(20),
            maxWidth: 100,
            maxSize: 20,
            minSize: 10,
            widthOf: halfEm
        });
        expect(fitted).toEqual({ text: 'A'.repeat(20), size: 10, truncated: false });
    });

    it('cuts past the floor and marks the cut, never exceeding the width', () => {
        // At 10pt each char is 5pt; 100pt holds 20 chars including the ellipsis.
        const fitted = fitLine({
            text: 'B'.repeat(40),
            maxWidth: 100,
            maxSize: 20,
            minSize: 10,
            widthOf: halfEm
        });
        expect(fitted.size).toBe(10);
        expect(fitted.truncated).toBe(true);
        expect(fitted.text).toBe(`${'B'.repeat(19)}${ELLIPSIS}`);
        expect(halfEm({ text: fitted.text, size: fitted.size })).toBeLessThanOrEqual(100);
    });

    it('drops trailing spaces before the mark', () => {
        // 19 kept chars would end in a space; it is trimmed.
        const fitted = fitLine({
            text: `${'C'.repeat(18)} ${'D'.repeat(30)}`,
            maxWidth: 100,
            maxSize: 10,
            minSize: 10,
            widthOf: halfEm
        });
        expect(fitted.text).toBe(`${'C'.repeat(18)}${ELLIPSIS}`);
    });

    it('trims surrounding whitespace before measuring', () => {
        const fitted = fitLine({
            text: '   ABCDEFGHIJ   ',
            maxWidth: 100,
            maxSize: 20,
            minSize: 10,
            widthOf: halfEm
        });
        expect(fitted).toEqual({ text: 'ABCDEFGHIJ', size: 20, truncated: false });
    });
});

describe('fitPillName with the real face', () => {
    async function widthOf(): Promise<WidthOf> {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        return ({ text, size }) => font.widthOfTextAtSize(text, size);
    }

    it('uppercases a short name and sets it at the largest size', async () => {
        const fitted = fitPillName({ name: 'La Parrilla', widthOf: await widthOf() });
        expect(fitted).toEqual({ text: 'LA PARRILLA', size: PILL_NAME_SIZE_MAX, truncated: false });
    });

    it('shrinks a medium name between the bounds without cutting it', async () => {
        const fitted = fitPillName({
            name: 'Cabañas del Río Uruguay y Spa Termal',
            widthOf: await widthOf()
        });
        expect(fitted.truncated).toBe(false);
        expect(fitted.text).toBe('CABAÑAS DEL RÍO URUGUAY Y SPA TERMAL');
        expect(fitted.size).toBeLessThan(PILL_NAME_SIZE_MAX);
        expect(fitted.size).toBeGreaterThanOrEqual(PILL_NAME_SIZE_MIN);
    });

    it('cuts a very long name at the floor and keeps it inside the pill', async () => {
        const measure = await widthOf();
        const fitted = fitPillName({
            name: 'Restaurante Parrilla Pescadería Cervecería y Salón de Eventos del Puerto de Concepción',
            widthOf: measure
        });
        expect(fitted.truncated).toBe(true);
        expect(fitted.size).toBe(PILL_NAME_SIZE_MIN);
        expect(fitted.text.endsWith(ELLIPSIS)).toBe(true);
        expect(measure({ text: fitted.text, size: fitted.size })).toBeLessThanOrEqual(
            PILL_TEXT_WIDTH
        );
    });

    it('collapses runs of whitespace a typed name may carry', async () => {
        const fitted = fitPillName({
            name: 'La   Parrilla\n del  Puerto',
            widthOf: await widthOf()
        });
        expect(fitted.text).toBe('LA PARRILLA DEL PUERTO');
    });
});
