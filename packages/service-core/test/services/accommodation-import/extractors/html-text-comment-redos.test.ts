/**
 * Regression tests for the HTML-comment stripping step of the HTML → text
 * converters (CodeQL js/polynomial-redos, alert #105).
 *
 * The importer feeds THIRD-PARTY HTML into these converters. The comment step
 * used to be `/<!--[\s\S]*?-->/g`, which on an input with many `<!--` openers
 * and no `-->` closer rescans the rest of the string from every opener:
 * quadratic time, measured at ~11s for 300k characters. A scraped page can
 * therefore stall an import request on its own.
 *
 * Two groups of tests:
 * - the pathological input must finish inside a small time budget;
 * - the observable output must stay exactly what the regex produced, including
 *   the edge cases (empty comment, `<!-->`, nesting, an unclosed opener).
 *
 * AAA pattern throughout.
 */

import { describe, expect, it } from 'vitest';

import {
    stripHtmlToParagraphText,
    stripHtmlToText
} from '../../../../src/services/accommodation-import/extractors/html-text.js';

/** How many unclosed `<!--` openers the pathological input carries. */
const OPENER_COUNT = 50_000;

/**
 * Many `<!--` openers and no `-->` closer. Each opener is followed by `x>y` so
 * the measured time isolates the comment step: the `>` keeps the generic
 * tag-strip step (which stops at the first `>`) cheap, and the `y` keeps the
 * stripped tags from piling up into one long whitespace run.
 */
const PATHOLOGICAL_HTML = '<!--x>y'.repeat(OPENER_COUNT);

/** No comment is closed, so every opener strips as an ordinary tag. */
const PATHOLOGICAL_TEXT = Array.from({ length: OPENER_COUNT }, () => 'y').join(' ');

/** Generous budget: the linear scan takes a few milliseconds on this input. */
const TIME_BUDGET_MS = 1_000;

/** Lets the OLD quadratic implementation fail on the assertion, not on a timeout. */
const TEST_TIMEOUT_MS = 60_000;

/** Large enough that no case below is truncated. */
const MAX_CHARS = 1_000_000;

describe('HTML comment stripping — polynomial ReDoS regression (CodeQL #105)', () => {
    it(
        'stripHtmlToText finishes quickly on many unclosed "<!--" openers',
        () => {
            // Arrange
            const start = performance.now();

            // Act
            const result = stripHtmlToText({ html: PATHOLOGICAL_HTML, maxChars: MAX_CHARS });
            const elapsedMs = performance.now() - start;

            // Assert
            expect(result).toBe(PATHOLOGICAL_TEXT);
            expect(elapsedMs).toBeLessThan(TIME_BUDGET_MS);
        },
        TEST_TIMEOUT_MS
    );

    it(
        'stripHtmlToParagraphText finishes quickly on many unclosed "<!--" openers',
        () => {
            // Arrange
            const start = performance.now();

            // Act
            const result = stripHtmlToParagraphText({
                html: PATHOLOGICAL_HTML,
                maxChars: MAX_CHARS
            });
            const elapsedMs = performance.now() - start;

            // Assert
            expect(result).toBe(PATHOLOGICAL_TEXT);
            expect(elapsedMs).toBeLessThan(TIME_BUDGET_MS);
        },
        TEST_TIMEOUT_MS
    );
});

describe('HTML comment stripping — output unchanged', () => {
    const cases: ReadonlyArray<{
        readonly name: string;
        readonly html: string;
        readonly expected: string;
    }> = [
        { name: 'a single comment', html: 'a<!--x-->b', expected: 'a b' },
        { name: 'an empty comment', html: 'a<!---->b', expected: 'a b' },
        {
            name: '"<!-->" does not close itself; the next "-->" does',
            html: 'a<!-->b-->c',
            expected: 'a c'
        },
        { name: 'two comments', html: 'a<!--x-->b<!--y-->c', expected: 'a b c' },
        {
            name: 'a "nested" opener closes at the first "-->"',
            html: 'a<!-- <!-- x -->b-->c',
            expected: 'a b-->c'
        },
        {
            name: 'an unclosed opener after a closed comment is left in place',
            html: 'a<!--x-->b<!--unclosed c',
            expected: 'a b<!--unclosed c'
        },
        {
            name: 'a multi-line comment',
            html: 'a<!--\nline one\nline two\n-->b',
            expected: 'a b'
        },
        { name: 'no comment at all', html: '<p>plain</p>', expected: 'plain' }
    ];

    for (const { name, html, expected } of cases) {
        it(`stripHtmlToText: ${name}`, () => {
            // Arrange — `html` and `expected` come from the table above.

            // Act
            const result = stripHtmlToText({ html, maxChars: MAX_CHARS });

            // Assert
            expect(result).toBe(expected);
        });
    }

    it('stripHtmlToParagraphText still drops a comment before scoping to <body>', () => {
        // Arrange — the comment mentions "<body>", which must not anchor the scope.
        const html =
            '<html><head><!-- see <body> below --><title>T</title></head>' +
            '<body><p>Uno.</p><!-- hidden --><p>Dos.</p></body></html>';

        // Act
        const result = stripHtmlToParagraphText({ html, maxChars: MAX_CHARS });

        // Assert
        expect(result).toBe('Uno.\n\nDos.');
    });
});
