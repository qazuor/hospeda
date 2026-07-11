/**
 * @file render-chat-markdown.test.ts
 * @description Unit tests for renderChatMarkdown (AI search / accommodation
 * chat assistant-bubble markdown renderer).
 *
 * Covers:
 * - Basic markdown formatting (bold, lists) renders as HTML.
 * - Output is sanitized: <script> tags are stripped.
 * - Links get target="_blank" + rel="noopener noreferrer".
 * - Empty / non-string input returns an empty string without throwing.
 */

import { describe, expect, it } from 'vitest';
import { renderChatMarkdown } from '../../../src/lib/ai-search/render-chat-markdown';

describe('renderChatMarkdown', () => {
    // ── Basic markdown formatting ────────────────────────────────────────────

    it('renders **bold** markdown as <strong>', () => {
        const html = renderChatMarkdown({ raw: 'Encontré **3 opciones** para vos.' });

        expect(html).toContain('<strong>3 opciones</strong>');
    });

    it('renders a bullet list as <ul><li>', () => {
        const html = renderChatMarkdown({ raw: '- Cabaña Río\n- Hotel Centro' });

        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Cabaña Río</li>');
        expect(html).toContain('<li>Hotel Centro</li>');
    });

    it('renders plain text without markdown markers as a paragraph', () => {
        const html = renderChatMarkdown({ raw: 'Hola, ¿en qué te ayudo?' });

        expect(html).toContain('Hola, ¿en qué te ayudo?');
    });

    // ── Sanitization ──────────────────────────────────────────────────────────

    it('strips <script> tags from the output', () => {
        const html = renderChatMarkdown({ raw: '<script>alert(1)</script>Hola' });

        expect(html).not.toContain('<script');
        expect(html).not.toContain('alert(1)');
    });

    it('strips disallowed tags (e.g. <iframe>) while keeping allowed siblings', () => {
        // Blank line between the HTML block and the markdown paragraph so
        // `marked` treats them as separate blocks (inline HTML swallows
        // trailing unblanked lines as raw text, which isn't what this test
        // is probing).
        const html = renderChatMarkdown({
            raw: '<iframe src="https://evil.example"></iframe>\n\n**seguro**'
        });

        expect(html).not.toContain('<iframe');
        expect(html).toContain('<strong>seguro</strong>');
    });

    it('strips event-handler attributes', () => {
        const html = renderChatMarkdown({ raw: '<p onclick="alert(1)">hola</p>' });

        expect(html).not.toContain('onclick');
    });

    // ── Links ─────────────────────────────────────────────────────────────────

    it('renders a markdown link as <a> with target and rel set', () => {
        const html = renderChatMarkdown({ raw: '[Hospeda](https://hospeda.com.ar)' });

        expect(html).toMatch(/<a\s/);
        expect(html).toContain('href="https://hospeda.com.ar"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
    });

    // ── Empty / edge input ────────────────────────────────────────────────────

    it('returns an empty string for empty input', () => {
        expect(renderChatMarkdown({ raw: '' })).toBe('');
    });

    it('does not throw for non-string input', () => {
        // Runtime callers (e.g. a stale message shape) could pass a non-string;
        // the helper must degrade gracefully rather than throw.
        expect(() => renderChatMarkdown({ raw: undefined as unknown as string })).not.toThrow();
        expect(renderChatMarkdown({ raw: undefined as unknown as string })).toBe('');
    });
});
