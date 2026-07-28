/**
 * Unit tests for the imported description/summary normalisation (HOS-286).
 *
 * These rules exist to keep a pre-filled field INSIDE the accommodation
 * schema's bounds at both ends, so the tests are written against those exact
 * numbers: `summary` 10–300, `description` 30–2000.
 */

import { describe, expect, it } from 'vitest';

import {
    toDescriptionText,
    toSummaryText,
    truncateAtWordBoundary
} from '../../../../src/services/accommodation-import/adapters/imported-text.js';

/** A realistic seller description, comfortably inside both fields' bounds. */
const NORMAL_TEXT =
    'Casa de campo con pileta y parque, ideal para descansar en familia durante todo el año.';

describe('truncateAtWordBoundary', () => {
    it('should return the text untouched when it already fits', () => {
        expect(truncateAtWordBoundary({ text: 'uno dos', maxChars: 20 })).toBe('uno dos');
    });

    it('should cut on a word boundary and append a single ellipsis', () => {
        expect(truncateAtWordBoundary({ text: 'uno dos tres', maxChars: 9 })).toBe('uno dos…');
    });

    it('should never exceed the cap', () => {
        for (const maxChars of [10, 50, 300, 2000]) {
            const text = 'palabra '.repeat(500).trim();
            expect(truncateAtWordBoundary({ text, maxChars }).length).toBeLessThanOrEqual(maxChars);
        }
    });

    it('should hard-cut a run with no whitespace rather than overflow', () => {
        const text = 'x'.repeat(100);

        const result = truncateAtWordBoundary({ text, maxChars: 20 });

        expect(result.length).toBe(20);
        expect(result.endsWith('…')).toBe(true);
    });

    it('should not leave a split surrogate pair on the hard-cut path', () => {
        // A wall of emoji with no spaces forces the hard cut. Slicing mid-pair
        // would leave a lone high surrogate that persists as U+FFFD.
        const text = '🏖'.repeat(200);

        const result = truncateAtWordBoundary({ text, maxChars: 300 });

        expect(result.length).toBeLessThanOrEqual(300);
        // Round-tripping through UTF-8 must not introduce a replacement char.
        expect(Buffer.from(result, 'utf8').toString('utf8')).toBe(result);
        expect(result).not.toContain('�');
    });
});

describe('toDescriptionText', () => {
    it('should keep a normal description as-is', () => {
        expect(toDescriptionText({ plainText: NORMAL_TEXT })).toBe(NORMAL_TEXT);
    });

    it('should return null for a blank input', () => {
        expect(toDescriptionText({ plainText: '   \n  ' })).toBeNull();
    });

    it('should return null below the 30-char accommodation minimum', () => {
        // A one-line seller description is extremely common on MercadoLibre.
        // Pre-filling it would hand the host a form that refuses to submit on
        // a field they never chose to fill.
        expect(toDescriptionText({ plainText: 'Consultar por WhatsApp.' })).toBeNull();
        expect(toDescriptionText({ plainText: 'x'.repeat(29) })).toBeNull();
        expect(toDescriptionText({ plainText: 'x'.repeat(30) })).toBe('x'.repeat(30));
    });

    it.each([
        // A short opener followed by a long space-free run: the word-boundary
        // cut falls back to the LAST space in the window, which is right after
        // the opener. All three shapes are common in ML seller descriptions.
        ['a bare URL', `Ver ${'a'.repeat(2500)}`],
        ['a separator rule', `Hermosa casa\n${'='.repeat(2500)}`],
        ['a two-letter opener', `ab ${'x'.repeat(2500)}`]
    ])('should return null when truncation itself drops it under the minimum (%s)', (_label, plainText) => {
        const result = toDescriptionText({ plainText });

        // Without the post-truncation check this returns "Ver…" / "Hermosa…",
        // pre-filling a min(30) field the host never touched and blocking submit.
        expect(result).toBeNull();
    });

    it('should truncate at the 2000-char maximum', () => {
        const result = toDescriptionText({ plainText: 'palabra '.repeat(500).trim() });

        expect(result).not.toBeNull();
        expect((result as string).length).toBeLessThanOrEqual(2000);
        expect((result as string).endsWith('…')).toBe(true);
    });

    it('should preserve a paragraph break', () => {
        const plainText = `${NORMAL_TEXT}\n\nSegundo párrafo con más detalle del lugar.`;

        expect(toDescriptionText({ plainText })).toContain('\n\n');
    });

    it('should collapse blank lines even when they carry whitespace', () => {
        // Regression: collapsing inline whitespace BEFORE newline runs leaves a
        // space between the breaks, so `\n{3,}` never matches and the blank
        // lines survive. ML `plain_text` is full of exactly this shape.
        const plainText = `${NORMAL_TEXT}\n \n \n \nSegundo párrafo con más detalle.`;

        const result = toDescriptionText({ plainText });

        expect(result).not.toBeNull();
        expect(result).not.toMatch(/\n{3,}/);
        expect(result).not.toMatch(/\n \n/);
        expect(result).toContain('\n\nSegundo párrafo');
    });

    it('should normalise CRLF line endings', () => {
        const plainText = `${NORMAL_TEXT}\r\n\r\nSegundo párrafo con más detalle.`;

        expect(toDescriptionText({ plainText })).not.toContain('\r');
    });

    it('should collapse runs of spaces and tabs', () => {
        const plainText = 'Casa    de\tcampo con pileta y parque para descansar en familia.';

        expect(toDescriptionText({ plainText })).toBe(
            'Casa de campo con pileta y parque para descansar en familia.'
        );
    });
});

describe('toSummaryText', () => {
    it('should flatten a multi-line description to a single line', () => {
        const plainText = 'Primera línea.\n\nSegunda línea.';

        expect(toSummaryText({ plainText })).toBe('Primera línea. Segunda línea.');
    });

    it('should return null for a blank input', () => {
        expect(toSummaryText({ plainText: '   \n  ' })).toBeNull();
    });

    it('should return null below the 10-char accommodation minimum', () => {
        expect(toSummaryText({ plainText: 'Consultar' })).toBeNull();
        expect(toSummaryText({ plainText: 'Consultar.' })).toBe('Consultar.');
    });

    it('should return null when truncation itself drops it under the minimum', () => {
        // A short word followed by one very long space-free run: the word-
        // boundary cut keeps only "Casa", far below the 10-char minimum.
        const plainText = `Casa ${'x'.repeat(400)}`;

        expect(toSummaryText({ plainText })).toBeNull();
    });

    it('should truncate at the 300-char maximum on a word boundary', () => {
        const result = toSummaryText({ plainText: 'palabra '.repeat(75).trim() });

        expect(result).not.toBeNull();
        expect((result as string).length).toBeLessThanOrEqual(300);
        expect((result as string).endsWith('…')).toBe(true);
        expect((result as string).slice(0, -1).trim().endsWith('palabra')).toBe(true);
    });
});
