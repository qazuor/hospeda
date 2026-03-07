import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../src/lib/sanitize-html';

describe('sanitizeHtml', () => {
    it('should return empty string for empty input', () => {
        expect(sanitizeHtml({ html: '' })).toBe('');
    });

    it('should strip script tags', () => {
        const result = sanitizeHtml({ html: '<p>Hello</p><script>alert("xss")</script>' });
        expect(result).toBe('<p>Hello</p>');
        expect(result).not.toContain('script');
    });

    it('should allow safe block elements', () => {
        const html = '<p>Text</p><div>Block</div><blockquote>Quote</blockquote>';
        expect(sanitizeHtml({ html })).toBe(html);
    });

    it('should allow headings', () => {
        const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
        expect(sanitizeHtml({ html })).toBe(html);
    });

    it('should allow lists', () => {
        const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
        expect(sanitizeHtml({ html })).toBe(html);
    });

    it('should allow inline formatting', () => {
        const html = '<strong>Bold</strong> <em>Italic</em> <u>Underline</u>';
        expect(sanitizeHtml({ html })).toBe(html);
    });

    it('should add target=_blank and rel to links', () => {
        const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
        expect(result).toContain('target="_blank"');
        expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should allow images with safe attributes', () => {
        const html =
            '<img src="https://example.com/img.jpg" alt="Test" width="100" height="100" />';
        const result = sanitizeHtml({ html });
        expect(result).toContain('src="https://example.com/img.jpg"');
        expect(result).toContain('alt="Test"');
    });

    it('should strip event handler attributes', () => {
        const result = sanitizeHtml({ html: '<div onclick="alert(1)">Click</div>' });
        expect(result).not.toContain('onclick');
        expect(result).toContain('<div>Click</div>');
    });

    it('should strip iframe tags', () => {
        const result = sanitizeHtml({
            html: '<iframe src="https://evil.com"></iframe><p>Safe</p>'
        });
        expect(result).not.toContain('iframe');
        expect(result).toContain('<p>Safe</p>');
    });

    it('should allow table elements', () => {
        const html =
            '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
        expect(sanitizeHtml({ html })).toBe(html);
    });

    it('should allow SVG elements', () => {
        const result = sanitizeHtml({
            html: '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" /></svg>'
        });
        expect(result).toContain('svg');
        expect(result).toContain('path');
    });

    it('should strip javascript: protocol from links', () => {
        const result = sanitizeHtml({ html: '<a href="javascript:alert(1)">Click</a>' });
        expect(result).not.toContain('javascript:');
    });
});
