/**
 * @file sanitize-html.test.ts
 * @description Unit tests for HTML sanitization.
 */

import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../src/lib/sanitize-html';

describe('sanitizeHtml', () => {
    describe('safe tags', () => {
        it('should preserve paragraph tags', () => {
            expect(sanitizeHtml({ html: '<p>Hello</p>' })).toContain('<p>Hello</p>');
        });

        it('should preserve strong and em tags', () => {
            expect(sanitizeHtml({ html: '<strong>Bold</strong> <em>italic</em>' })).toContain(
                '<strong>Bold</strong>'
            );
        });

        it('should preserve heading tags', () => {
            expect(sanitizeHtml({ html: '<h2>Title</h2>' })).toContain('<h2>Title</h2>');
        });

        it('should preserve list tags', () => {
            const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const result = sanitizeHtml({ html });
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>Item 1</li>');
        });

        it('should preserve links with href', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
            expect(result).toContain('href="https://example.com"');
        });
    });

    describe('dangerous content removal', () => {
        it('should strip script tags', () => {
            const result = sanitizeHtml({ html: '<p>Hello</p><script>alert(1)</script>' });
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert');
            expect(result).toContain('<p>Hello</p>');
        });

        it('should strip iframe tags', () => {
            const result = sanitizeHtml({ html: '<iframe src="evil.com"></iframe>' });
            expect(result).not.toContain('<iframe');
        });

        it('should strip event handler attributes', () => {
            const result = sanitizeHtml({ html: '<div onmouseover="alert(1)">test</div>' });
            expect(result).not.toContain('onmouseover');
        });

        it('should strip javascript: URLs', () => {
            const result = sanitizeHtml({ html: '<a href="javascript:alert(1)">click</a>' });
            expect(result).not.toContain('javascript:');
        });
    });

    describe('link security', () => {
        it('should add rel="noopener noreferrer" to links', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('should add target="_blank" to links', () => {
            const result = sanitizeHtml({ html: '<a href="https://example.com">Link</a>' });
            expect(result).toContain('target="_blank"');
        });
    });

    describe('edge cases', () => {
        it('should return empty string for empty input', () => {
            expect(sanitizeHtml({ html: '' })).toBe('');
        });

        it('should handle plain text (no tags)', () => {
            expect(sanitizeHtml({ html: 'Plain text' })).toBe('Plain text');
        });

        it('should preserve allowed attributes (class, id, aria-*)', () => {
            const result = sanitizeHtml({
                html: '<div class="test" id="main" aria-label="section">Content</div>'
            });
            expect(result).toContain('class="test"');
            expect(result).toContain('id="main"');
            expect(result).toContain('aria-label="section"');
        });
    });
});
