/**
 * Tests for the shared parse5-based JSON-LD block extractor.
 *
 * Regression focus (HOS-82): the previous regex-based extractor
 * (`/<script\b([^>]*)>([\s\S]*?)<\/script>/gi`) was flagged by CodeQL
 * `js/bad-tag-filter` because a regex cannot robustly match HTML tags. The
 * cases below exercise the exact inputs that broke the regex — an attribute
 * value containing `>`, mixed-case tags, and unusual closing-tag whitespace —
 * and assert the parser-based helper handles them.
 */

import { describe, expect, it } from 'vitest';
import { parseJsonLdBlocks } from '../../src/utils/html-jsonld.js';

const wrap = (scripts: string): string =>
    `<!doctype html><html><head>${scripts}</head><body></body></html>`;

describe('parseJsonLdBlocks', () => {
    it('extracts a single application/ld+json block', () => {
        const html = wrap(
            '<script type="application/ld+json">{"@type":"Hotel","name":"A"}</script>'
        );

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ '@type': 'Hotel', name: 'A' }]);
    });

    it('returns blocks in document order for multiple scripts', () => {
        const html = wrap(
            '<script type="application/ld+json">{"n":1}</script>' +
                '<script type="application/ld+json">{"n":2}</script>'
        );

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ n: 1 }, { n: 2 }]);
    });

    it('ignores <script> blocks that are not application/ld+json', () => {
        const html = wrap(
            '<script>window.x = 1;</script>' +
                '<script type="text/javascript">var y = 2;</script>' +
                '<script type="application/ld+json">{"kept":true}</script>'
        );

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ kept: true }]);
    });

    it('parses a block even when a preceding attribute value contains ">" (regex-bypass case)', () => {
        // The old regex `<script\b([^>]*)>` stops at the first ">" — here that
        // ">" is INSIDE a quoted attribute value, so the regex would truncate
        // the tag and lose the block entirely. parse5 parses it correctly.
        const html = wrap(
            '<script data-cmp="a>b" type="application/ld+json">{"recovered":true}</script>'
        );

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ recovered: true }]);
    });

    it('matches the type attribute case-insensitively and ignoring surrounding whitespace', () => {
        const html = wrap('<SCRIPT TYPE="  Application/LD+JSON  ">{"ci":true}</SCRIPT>');

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ ci: true }]);
    });

    it('handles whitespace / newlines around the closing tag', () => {
        const html = wrap('<script type="application/ld+json">\n  {"ws":true}\n</script\n>');

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ ws: true }]);
    });

    it('skips malformed JSON blocks without throwing and keeps valid ones', () => {
        const html = wrap(
            '<script type="application/ld+json">{ not valid json }</script>' +
                '<script type="application/ld+json">{"valid":true}</script>'
        );

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([{ valid: true }]);
    });

    it('skips empty / whitespace-only blocks', () => {
        const html = wrap('<script type="application/ld+json">   </script>');

        expect(parseJsonLdBlocks({ html })).toEqual([]);
    });

    it('returns an empty array for empty input', () => {
        expect(parseJsonLdBlocks({ html: '' })).toEqual([]);
    });

    it('extracts a JSON-LD array payload as-is', () => {
        const html = wrap(
            '<script type="application/ld+json">[{"@type":"Hotel"},{"@type":"Place"}]</script>'
        );

        const blocks = parseJsonLdBlocks({ html });

        expect(blocks).toEqual([[{ '@type': 'Hotel' }, { '@type': 'Place' }]]);
    });
});
