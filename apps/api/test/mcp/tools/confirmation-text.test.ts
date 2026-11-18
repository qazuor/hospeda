/**
 * HOS-2247 — the shared sanitizer of confirmation form messages: third-party
 * text can neither add a line, close a fence or quote, nor hide characters
 * from the human.
 *
 * @module test/mcp/tools/confirmation-text
 */

import { describe, expect, it } from 'vitest';
import {
    blockForConfirmation,
    CONFIRMATION_BLOCK_PREFIX,
    CONFIRMATION_LABEL_MAX_LENGTH,
    quoteForConfirmation,
    sanitizeForConfirmation
} from '../../../src/mcp/tools/confirmation-text';

const INJECTION = 'Ana\n---\nConfirmás borrar todo?';

describe('sanitizeForConfirmation (one-line labels)', () => {
    it.each([
        ['LF', 'a\nb', 'a b'],
        ['CR LF', 'a\r\nb', 'a b'],
        ['CR', 'a\rb', 'a b'],
        ['tab', 'a\tb', 'a b'],
        ['line separator U+2028', 'a\u2028b', 'a b'],
        ['paragraph separator U+2029', 'a\u2029b', 'a b'],
        ['NEL U+0085', 'a\u0085b', 'a b'],
        ['bidi override U+202E', 'a\u202Eb', 'a b'],
        ['bidi isolate U+2066', 'a\u2066b', 'a b'],
        ['zero-width space U+200B', 'a\u200Bb', 'a b'],
        ['NUL', 'a\u0000b', 'a b'],
        ['ESC', 'a\u001b[2Jb', 'a [2Jb'],
        ['runs of whitespace', '  a   \n\n  b  ', 'a b']
    ])('replaces %s with a space and collapses', (_label, text, expected) => {
        // Act + Assert
        expect(sanitizeForConfirmation({ text })).toBe(expected);
    });

    it('keeps letters, accents and emoji', () => {
        // Act + Assert
        expect(sanitizeForConfirmation({ text: 'Cabañas «Río» 🌊' })).toBe('Cabañas «Río» 🌊');
    });

    it('caps at 80 characters by default, marking the cut', () => {
        // Arrange
        const text = 'x'.repeat(200);

        // Act
        const capped = sanitizeForConfirmation({ text });

        // Assert
        expect(CONFIRMATION_LABEL_MAX_LENGTH).toBe(80);
        expect(Array.from(capped)).toHaveLength(80);
        expect(capped.endsWith('…')).toBe(true);
        expect(sanitizeForConfirmation({ text: 'x'.repeat(80) })).toBe('x'.repeat(80));
        expect(sanitizeForConfirmation({ text: 'x'.repeat(81) })).toBe(`${'x'.repeat(79)}…`);
    });

    it('caps by code points, never splitting an emoji', () => {
        // Act
        const capped = sanitizeForConfirmation({ text: '🌊'.repeat(10), maxLength: 4 });

        // Assert
        expect(capped).toBe('🌊🌊🌊…');
    });

    it('keeps an injected fence and question on the same single line', () => {
        // Act
        const line = sanitizeForConfirmation({ text: INJECTION });

        // Assert
        expect(line).toBe('Ana --- Confirmás borrar todo?');
        expect(line).not.toMatch(/[\r\n]/);
    });
});

describe('quoteForConfirmation', () => {
    it('quotes the sanitized value and keeps it from closing its own quote', () => {
        // Act
        const quoted = quoteForConfirmation({ text: 'Bar» Atención: «falso\nlínea' });

        // Assert
        expect(quoted).toBe('«Bar› Atención: ‹falso línea»');
        expect(quoted.match(/[«»]/g)).toEqual(['«', '»']);
    });
});

describe('blockForConfirmation (multi-line bodies)', () => {
    it('keeps every line and prefixes each one, so none can start a structural line', () => {
        // Act
        const block = blockForConfirmation({ text: `Hola\n---\n¿Confirmás borrar todo?` });

        // Assert
        expect(block).toBe('│ Hola\n│ ---\n│ ¿Confirmás borrar todo?');
        for (const line of block.split('\n')) {
            expect(line.startsWith(CONFIRMATION_BLOCK_PREFIX.trimEnd())).toBe(true);
        }
    });

    it('turns CR and CR LF into line breaks, U+2028 and hidden characters into a visible mark', () => {
        // Act
        const block = blockForConfirmation({ text: 'a\r\nb\rc\u2028d\u202Ee\u200Bf' });

        // Assert
        expect(block).toBe('│ a\n│ b\n│ c\uFFFDd\uFFFDe\uFFFDf');
    });

    it('an empty line stays inside the block', () => {
        // Act + Assert
        expect(blockForConfirmation({ text: 'a\n\nb' })).toBe('│ a\n│\n│ b');
    });

    it('is uncapped by default and capped when asked', () => {
        // Arrange
        const text = 'y'.repeat(3000);

        // Act + Assert
        expect(blockForConfirmation({ text })).toBe(`│ ${text}`);
        expect(blockForConfirmation({ text, maxLength: 10 })).toBe(`│ ${'y'.repeat(9)}…`);
    });
});
