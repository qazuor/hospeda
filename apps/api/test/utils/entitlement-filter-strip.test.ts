/**
 * Unit tests for `stripMarkdown` in `apps/api/src/utils/entitlement-filter.ts`.
 *
 * SPEC-187 PD-1 / FR-9 (regression pin):
 *   The JS `stripMarkdown` function is the source of truth for the P0 PL/pgSQL
 *   migration `packages/db/src/migrations/0008_strip_accommodation_description_markdown.sql`.
 *   Any change to the JS regex set MUST be mirrored in the SQL function (and
 *   vice versa). This test pins the JS behavior so a future drift between the
 *   two surfaces as a unit-test failure — long before the P0 integration test
 *   (which requires a live Postgres) or a public web render.
 *
 * Canonical fixture (per `openspec/changes/SPEC-187-rich-text-entity-descriptions/tasks.md:48`):
 *   Input  : `"## Title\n\n**bold**\n[link](https://x.com)\n- item\n`code`"`
 *   Output : `"Title\n\nbold\nlink\nitem\ncode"`
 *
 * @module test/utils/entitlement-filter-strip
 */

import { describe, expect, it } from 'vitest';
import { stripMarkdown } from '../../src/utils/entitlement-filter';

describe('stripMarkdown', () => {
    describe('canonical fixture (tasks.md:48)', () => {
        it('strips the full P0 fixture to the expected plain text', () => {
            const input = '## Title\n\n**bold**\n[link](https://x.com)\n- item\n`code`';
            const expected = 'Title\n\nbold\nlink\nitem\ncode';

            expect(stripMarkdown(input)).toBe(expected);
        });
    });

    describe('per-regex coverage (mirrors 0008_strip_accommodation_description_markdown.sql)', () => {
        it('strips **bold** markers', () => {
            expect(stripMarkdown('**bold**')).toBe('bold');
        });

        it('strips *italic* markers (after bold, so **foo** is not partial-consumed)', () => {
            expect(stripMarkdown('*italic*')).toBe('italic');
            // The fixture for ordering: **foo** must yield `foo`, not `*foo*`.
            expect(stripMarkdown('**foo**')).toBe('foo');
        });

        it('strips __bold__ underscore emphasis (SPEC-187 follow-up fix a)', () => {
            expect(stripMarkdown('__bold__')).toBe('bold');
        });

        it('strips _italic_ underscore emphasis (SPEC-187 follow-up fix a)', () => {
            expect(stripMarkdown('_italic_')).toBe('italic');
            // __foo__ must yield `foo`, not `_foo_` (bold-underscore before italic).
            expect(stripMarkdown('__foo__')).toBe('foo');
        });

        it('strips ~~strikethrough~~ markers', () => {
            expect(stripMarkdown('~~struck~~')).toBe('struck');
        });

        it('strips `inline code` markers', () => {
            expect(stripMarkdown('`code`')).toBe('code');
        });

        it('strips [text](url) link markers, preserving the visible text only', () => {
            expect(stripMarkdown('[click](https://example.com)')).toBe('click');
        });

        it('strips an image marker to its alt text (image regex runs BEFORE links)', () => {
            // SPEC-187 follow-up fix (b): the image regex `!\[(.+?)\]\(.+?\)`
            // now runs BEFORE the link regex `\[(.+?)\]\(.+?\)` in both the JS
            // function and the SQL function. On input `![alt](url)` the image
            // regex consumes the whole marker and yields `alt` — no orphan `!`.
            // (The old order ran links first, leaving `!alt`.) This ordering is
            // SHARED between JS and SQL (PD-1 lockstep).
            expect(stripMarkdown('![alt text](https://example.com/img.png)')).toBe('alt text');
        });

        it('strips ^#+ heading prefixes (anchored, multiline)', () => {
            expect(stripMarkdown('# H1\n## H2\n### H3')).toBe('H1\nH2\nH3');
        });

        it('strips ^[-*+] bullet markers (anchored, multiline)', () => {
            expect(stripMarkdown('- a\n* b\n+ c')).toBe('a\nb\nc');
        });

        it('strips ^> blockquote markers (anchored, multiline)', () => {
            expect(stripMarkdown('> quoted\n> still quoted')).toBe('quoted\nstill quoted');
        });

        it('collapses 3+ consecutive newlines to a double newline (SPEC-187 follow-up fix c)', () => {
            // The SQL function collapses `\n{3,}` -> `\n\n`; the JS function now
            // mirrors it so both implementations produce identical output.
            expect(stripMarkdown('a\n\n\n\nb')).toBe('a\n\nb');
        });
    });

    describe('input guards', () => {
        it('returns an empty string for empty input', () => {
            expect(stripMarkdown('')).toBe('');
        });

        it('returns the input unchanged when no markers are present', () => {
            expect(stripMarkdown('plain text only')).toBe('plain text only');
        });

        it('trims leading/trailing whitespace on output', () => {
            expect(stripMarkdown('  hello  ')).toBe('hello');
        });
    });

    describe('combined markers', () => {
        it('strips a mix of bold, italic, and link in one pass', () => {
            expect(stripMarkdown('**a** and *b* and [c](u)')).toBe('a and b and c');
        });

        it('does not consume an unmatched * as italic (paired parens only)', () => {
            // `*foo` (no closing) is left untouched. The regex is non-greedy and
            // requires a closing `*`. This is the behavior the SQL function
            // mirrors; we pin it so a future "loosen" change is a deliberate,
            // reviewed decision.
            expect(stripMarkdown('*foo')).toBe('*foo');
        });
    });
});
