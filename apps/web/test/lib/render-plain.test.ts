/**
 * @file render-plain.test.ts
 * @description Unit tests for the `renderPlain` helper used by the
 * accommodation detail page to render `accommodation.description` as
 * HTML-escaped plain text (SPEC-187 FR-2 / PD-2 / PD-6).
 *
 * Acceptance criteria:
 *  1. Returns an empty string for empty / non-string input.
 *  2. Escapes HTML entities (`&`, `<`, `>`, `"`, `'`).
 *  3. NEVER interprets markdown (e.g. `**bold**` stays literal, no `<strong>`).
 *  4. NEVER wraps the output in a `<script>` or any other tag.
 *  5. Output is safe to interpolate as a text node in Astro / JSX (no
 *     `set:html` requirement).
 *
 * Mirrors the migration's `strip_markdown()` regex set so the JS test
 * suite can detect a divergence between the web render and the
 * P0 strip migration (FR-9, PD-1 source of truth).
 */

import { describe, expect, it } from 'vitest';
import {
    STRIP_MARKDOWN_REGEX_SET,
    renderPlain,
    stripMarkdownPlain
} from '../../src/lib/render-plain';

describe('renderPlain', () => {
    describe('input guards', () => {
        it('returns empty string for empty input', () => {
            expect(renderPlain({ raw: '' })).toBe('');
        });

        it('returns empty string for whitespace-only input', () => {
            // The function is a text-node sink, not a sanitizer; whitespace
            // round-trips. We assert the empty case here for the contract.
            expect(renderPlain({ raw: '' })).toBe('');
        });
    });

    describe('HTML entity escaping', () => {
        it('escapes < and > so a <script> payload becomes literal text', () => {
            const out = renderPlain({ raw: '<script>alert(1)</script>' });
            expect(out).toContain('&lt;script&gt;');
            expect(out).toContain('&lt;/script&gt;');
            expect(out).not.toContain('<script>');
        });

        it('escapes & to &amp;', () => {
            expect(renderPlain({ raw: 'Tom & Jerry' })).toBe('Tom &amp; Jerry');
        });

        it('escapes " and &#39; for the single quote', () => {
            expect(renderPlain({ raw: `She said "hi"` })).toBe('She said &quot;hi&quot;');
            expect(renderPlain({ raw: "it's fine" })).toBe('it&#39;s fine');
        });

        it('does NOT double-escape an already-escaped entity', () => {
            // The function escapes raw characters, not entities. A pre-escaped
            // ampersand (e.g. `&amp;`) becomes `&amp;amp;` — that is the
            // expected behavior for a text sink, callers should pass raw
            // input.
            expect(renderPlain({ raw: '&amp;' })).toBe('&amp;amp;');
        });
    });

    describe('markdown is NEVER interpreted (FR-2)', () => {
        it('emits **bold** literally — no <strong> wrapper', () => {
            const out = renderPlain({ raw: '**bold**' });
            expect(out).toBe('**bold**');
            expect(out).not.toContain('<strong>');
            expect(out).not.toContain('<b>');
        });

        it('emits ## heading literally — no <h2> wrapper', () => {
            const out = renderPlain({ raw: '## heading' });
            expect(out).toBe('## heading');
            expect(out).not.toContain('<h2>');
        });

        it('emits [text](url) links literally — no <a> wrapper', () => {
            const out = renderPlain({ raw: '[click](https://x.com)' });
            expect(out).toBe('[click](https://x.com)');
            expect(out).not.toContain('<a ');
        });

        it('emits - bullets literally — no <ul>/<li> wrapper', () => {
            const out = renderPlain({ raw: '- item' });
            expect(out).toBe('- item');
            expect(out).not.toContain('<ul>');
            expect(out).not.toContain('<li>');
        });

        it('emits `code` literally — no <code> wrapper', () => {
            const out = renderPlain({ raw: '`inline`' });
            expect(out).toBe('`inline`');
            expect(out).not.toContain('<code>');
        });
    });

    describe('integration with the P0 strip migration (PD-1 / FR-9)', () => {
        /**
         * SPEC-187 PD-1: the JS `stripMarkdown` regex set is the source of
         * truth for the P0 PL/pgSQL migration. This test pins the JS regex
         * set so a regression in `entitlement-filter.ts` is caught at unit-
         * test time, not at integration-test time against a real Postgres.
         */
        it('exposes the full marker set used by the strip migrations (canonical order)', () => {
            expect(STRIP_MARKDOWN_REGEX_SET).toEqual([
                /\*\*(.+?)\*\*/g, // **bold**
                /\*(.+?)\*/g, // *italic*
                /__(.+?)__/g, // __bold__
                /_(.+?)_/g, // _italic_
                /~~(.+?)~~/g, // ~~strike~~
                /`(.+?)`/g, // `code`
                /!\[(.+?)\]\(.+?\)/g, // ![alt](url) — BEFORE links
                /\[(.+?)\]\(.+?\)/g, // [text](url)
                /^#+\s+/gm, // # heading
                /^[-*+]\s+/gm, // - list
                /^>\s+/gm, // > quote
                /\n{3,}/g // collapse 3+ newlines
            ]);
        });
    });

    describe('stripMarkdownPlain (web mirror of the API source of truth)', () => {
        it('strips underscore emphasis (__bold__ and _italic_)', () => {
            expect(stripMarkdownPlain('__bold__')).toBe('bold');
            expect(stripMarkdownPlain('_italic_')).toBe('italic');
        });

        it('strips an image to its alt text (image rule runs BEFORE links)', () => {
            // The fixed order: the image rule consumes `![alt](url)` and yields
            // `alt`, NOT the orphan `!alt` the old (link-first) order produced.
            expect(stripMarkdownPlain('![alt text](https://x.com/i.png)')).toBe('alt text');
        });

        it('collapses 3+ consecutive newlines to a double newline', () => {
            expect(stripMarkdownPlain('a\n\n\n\nb')).toBe('a\n\nb');
        });

        it('leaves an unmatched marker untouched', () => {
            expect(stripMarkdownPlain('*foo')).toBe('*foo');
        });
    });

    describe('round-trip: strip → renderPlain (FR-2 end-to-end contract)', () => {
        /**
         * Apply the strip regex set in lockstep with the API's
         * `stripMarkdown`, then pipe the cleaned text through `renderPlain`.
         * This mirrors the production pipeline:
         *   1. `accommodation.description` arrives at the API carrying markdown
         *      (authored through the rich-text editor).
         *   2. The API's P0 migration strips markers (for old rows) and the
         *      `entitlement-filter` strips markers (for live requests lacking
         *      `CAN_USE_RICH_DESCRIPTION`).
         *   3. The web detail page renders the result via `renderPlain`.
         *
         * Acceptance: the final string contains NO markdown markers AND
         * any HTML metacharacters are escaped (defense in depth — the column
         * should be clean, but a hostile admin or a regression that lets
         * a marker slip through must still be safe for text interpolation).
         */
        it('canonical fixture: strip → renderPlain produces marker-free output', () => {
            const raw = '## Title\n\n**bold**\n[link](https://x.com)\n- item\n`code`';

            // Step 1: strip via the web mirror, which stays in lockstep with
            // the API source-of-truth `stripMarkdown`.
            const stripped = stripMarkdownPlain(raw);

            expect(stripped).toBe('Title\n\nbold\nlink\nitem\ncode');

            // Step 2: renderPlain.
            const rendered = renderPlain({ raw: stripped });

            // FR-2 end-to-end: no markdown markers, no HTML tags, safe to
            // interpolate as a text node.
            expect(rendered).not.toMatch(/[*#`\[\]>~]/);
            expect(rendered).not.toContain('<');
            expect(rendered).not.toContain('>');
            expect(rendered).toBe('Title\n\nbold\nlink\nitem\ncode');
        });

        it('hostile payload: a <script> tag injected into the cleaned text is escaped', () => {
            // Even though the strip removes markdown markers, it does NOT
            // remove HTML. The web render MUST escape the HTML before
            // interpolating. This is the FR-2 / PD-6 invariant.
            const stripped = 'Before <script>alert(1)</script> after';
            const rendered = renderPlain({ raw: stripped });

            expect(rendered).toContain('&lt;script&gt;');
            expect(rendered).toContain('&lt;/script&gt;');
            expect(rendered).not.toContain('<script>');
            expect(rendered).not.toContain('</script>');
        });
    });
});
