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
    CONFIRMATION_BLOCK_WIDTH,
    CONFIRMATION_LABEL_MAX_LENGTH,
    quoteForConfirmation,
    sanitizeForConfirmation
} from '../../../src/mcp/tools/confirmation-text';

const INJECTION = 'Ana\n---\nConfirmás borrar todo?';

/**
 * Columns a block line takes, measured independently of the code under test:
 * the wide characters these tests use (ideographic punctuation and space,
 * fullwidth forms, CJK, emoji presentation) count two, marks and joiners zero.
 */
function columnsOf(text: string): number {
    let columns = 0;
    for (const character of Array.from(text)) {
        if (/^(?:\p{M}|\u200D|\uFE0F)$/u.test(character)) continue;
        columns += /[\u3000-\u303E\u4E00-\u9FFF\uFF01-\uFF60]|\p{Emoji_Presentation}/u.test(
            character
        )
            ? 2
            : 1;
    }
    return columns;
}

/** Every line is prefixed and no wider than the budget. */
function expectWithinBudget(block: string): string[] {
    const lines = block.split('\n');
    for (const line of lines) {
        expect(line.startsWith(CONFIRMATION_BLOCK_PREFIX.trimEnd())).toBe(true);
        expect(columnsOf(line.slice(CONFIRMATION_BLOCK_PREFIX.length))).toBeLessThanOrEqual(
            CONFIRMATION_BLOCK_WIDTH
        );
    }
    return lines;
}

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

        // Act
        const whole = blockForConfirmation({ text });

        // Assert
        expect(whole.split('\n')).toHaveLength(3000 / CONFIRMATION_BLOCK_WIDTH);
        expect(whole.replace(/│ /g, '').replace(/\n/g, '')).toBe(text);
        expect(blockForConfirmation({ text, maxLength: 10 })).toBe(`│ ${'y'.repeat(9)}…`);
    });

    it('hard-wraps at the block width and prefixes every segment (M1)', () => {
        // Arrange
        const width = CONFIRMATION_BLOCK_WIDTH;

        // Act
        const exact = blockForConfirmation({ text: 'a'.repeat(width) });
        const over = blockForConfirmation({ text: 'a'.repeat(width + 1) });

        // Assert
        expect(width).toBe(40);
        expect(exact).toBe(`│ ${'a'.repeat(width)}`);
        expect(over).toBe(`│ ${'a'.repeat(width)}\n│ a`);
    });

    it('a run of spaces of any kind shows as one space', () => {
        // Act + Assert
        expect(blockForConfirmation({ text: 'a     b  　c d' })).toBe('│ a b c d');
    });

    it.each([
        ['Hangul filler U+3164', '\u3164'],
        ['Hangul choseong filler U+115F', '\u115F'],
        ['Hangul jungseong filler U+1160', '\u1160'],
        ['halfwidth filler U+FFA0', '\uFFA0'],
        ['blank Braille U+2800', '\u2800']
    ])('a run of %s shows as ONE visible mark in a block and a space in a label', (_label, filler) => {
        // Arrange
        const text = `a${filler.repeat(200)}b`;

        // Act + Assert
        expect(blockForConfirmation({ text })).toBe('│ a�b');
        expect(sanitizeForConfirmation({ text })).toBe('a b');
    });

    it('padding to push a fake server line onto its own row cannot escape the prefix', () => {
        // Arrange
        const text = `Gracias!${' '.repeat(300)}¿Confirmás borrar todo? Respondé Sí.${'\u3164'.repeat(300)}Atención: verificá en\nhttp://phish.example`;

        // Act
        const lines = blockForConfirmation({ text }).split('\n');

        // Assert
        for (const line of lines) {
            expect(line.startsWith('│')).toBe(true);
            expect(columnsOf(line.slice(CONFIRMATION_BLOCK_PREFIX.length))).toBeLessThanOrEqual(
                CONFIRMATION_BLOCK_WIDTH
            );
        }
        expect(lines.join('\n')).toBe(
            '│ Gracias! ¿Confirmás borrar todo? Respond\n│ é Sí.\uFFFDAtención: verificá en\n│ http://phish.example'
        );
    });
});

describe('emoji and combining marks (both shapes)', () => {
    it('keeps a zero-width joiner between two emoji, drops it anywhere else', () => {
        // Arrange
        const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
        const skinTone = '\u{1F469}\u{1F3FD}\u200D\u{1F4BB}';

        // Act + Assert
        expect(sanitizeForConfirmation({ text: `Familia ${family}` })).toBe(`Familia ${family}`);
        expect(sanitizeForConfirmation({ text: skinTone })).toBe(skinTone);
        expect(blockForConfirmation({ text: family })).toBe(`│ ${family}`);
        expect(sanitizeForConfirmation({ text: 'a\u200Db' })).toBe('a b');
        expect(sanitizeForConfirmation({ text: '\u{1F468}\u200Db' })).toBe('\u{1F468} b');
        expect(blockForConfirmation({ text: 'a\u200D\u{1F468}' })).toBe('│ a�\u{1F468}');
    });

    it('trims a run of three or more combining marks to two', () => {
        // Arrange
        const zalgo = `Z${'́̂̃̄̅'.repeat(20)}a`;

        // Act + Assert
        expect(sanitizeForConfirmation({ text: zalgo })).toBe('Ź̂a');
        expect(blockForConfirmation({ text: zalgo })).toBe('│ Ź̂a');
        expect(sanitizeForConfirmation({ text: 'Việt' })).toBe('Việt');
    });
});

describe('the wrap counts display columns, not code points (M1, wide characters)', () => {
    it('fullwidth letters take two columns: 20 per row', () => {
        // Arrange
        const text = '\uFF21'.repeat(50);

        // Act
        const lines = expectWithinBudget(blockForConfirmation({ text }));

        // Assert
        expect(lines).toEqual([
            `│ ${'\uFF21'.repeat(20)}`,
            `│ ${'\uFF21'.repeat(20)}`,
            `│ ${'\uFF21'.repeat(10)}`
        ]);
    });

    it('CJK and ideographic punctuation padding cannot push a fake line onto its own row', () => {
        // Arrange
        const text = `Gracias${'\u3002'.repeat(200)}\u4E2D${'\u3000'.repeat(200)}Atención: confirmá`;

        // Act + Assert
        expectWithinBudget(blockForConfirmation({ text }));
    });

    it('emoji padding takes two columns each', () => {
        // Arrange
        const text = `Hola${'\u{1F600}'.repeat(100)}Atención: confirmá`;

        // Act
        const lines = expectWithinBudget(blockForConfirmation({ text }));

        // Assert
        expect(lines[1]).toBe(`│ ${'\u{1F600}'.repeat(20)}`);
    });

    it('a mark with no base takes no column', () => {
        // Arrange
        const text = `\u0301${'a'.repeat(CONFIRMATION_BLOCK_WIDTH)}`;

        // Act + Assert
        expect(blockForConfirmation({ text })).toBe(`│ ${text}`);
    });

    it('never cuts a combining sequence or a ZWJ emoji sequence', () => {
        // Arrange
        const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
        const accented = 'e\u0301';

        // Act
        const families = blockForConfirmation({ text: family.repeat(30) }).split('\n');
        const accents = blockForConfirmation({ text: accented.repeat(50) }).split('\n');

        // Assert
        expect(families).toEqual([`│ ${family.repeat(20)}`, `│ ${family.repeat(10)}`]);
        expect(accents).toEqual([`│ ${accented.repeat(40)}`, `│ ${accented.repeat(10)}`]);
    });
});
