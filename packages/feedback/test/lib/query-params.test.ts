/**
 * Tests for the query-params serialization/parsing utilities.
 */
import { describe, expect, it } from 'vitest';
import { parseFeedbackParams, serializeFeedbackParams } from '../../src/lib/query-params.js';
import type { FeedbackQueryParams } from '../../src/lib/query-params.js';

describe('serializeFeedbackParams', () => {
    it('should serialize all defined params to a query string', () => {
        // Arrange
        const params: FeedbackQueryParams = {
            type: 'bug-js',
            title: 'App crash',
            description: 'Crashes on load'
        };

        // Act
        const result = serializeFeedbackParams(params);

        // Assert
        expect(result).toContain('type=bug-js');
        expect(result).toContain('title=App+crash');
        expect(result).toContain('description=Crashes+on+load');
    });

    it('should omit undefined values', () => {
        // Arrange
        const params: FeedbackQueryParams = { type: 'bug-js', title: undefined };

        // Act
        const result = serializeFeedbackParams(params);

        // Assert
        expect(result).toContain('type=bug-js');
        expect(result).not.toContain('title');
    });

    it('should omit empty string values', () => {
        // Arrange
        const params: FeedbackQueryParams = { type: 'bug-js', title: '' };

        // Act
        const result = serializeFeedbackParams(params);

        // Assert
        expect(result).not.toContain('title');
    });

    it('should return empty string when all params are undefined', () => {
        const result = serializeFeedbackParams({});
        expect(result).toBe('');
    });

    it('should URL-encode special characters', () => {
        // Arrange
        const params: FeedbackQueryParams = { title: 'Hello & World <>' };

        // Act
        const result = serializeFeedbackParams(params);

        // Assert
        // URLSearchParams encodes & as %26
        expect(result).toContain('Hello');
        expect(result).not.toContain('<');
    });
});

describe('parseFeedbackParams', () => {
    it('should parse all recognized keys from a query string', () => {
        // Arrange
        const qs =
            'type=bug-ui-ux&title=Broken+layout&description=Nav+missing&url=https%3A%2F%2Fex.com&error=ERR&stack=at+App.tsx&source=fab';

        // Act
        const result = parseFeedbackParams(qs);

        // Assert
        expect(result.type).toBe('bug-ui-ux');
        expect(result.title).toBe('Broken layout');
        expect(result.description).toBe('Nav missing');
        expect(result.url).toBe('https://ex.com');
        expect(result.error).toBe('ERR');
        expect(result.stack).toBe('at App.tsx');
        expect(result.source).toBe('fab');
    });

    it('should return undefined for absent keys', () => {
        // Arrange / Act
        const result = parseFeedbackParams('type=bug-js');

        // Assert
        expect(result.title).toBeUndefined();
        expect(result.description).toBeUndefined();
        expect(result.url).toBeUndefined();
        expect(result.error).toBeUndefined();
        expect(result.stack).toBeUndefined();
        expect(result.source).toBeUndefined();
    });

    it('should handle empty search string', () => {
        // Arrange / Act
        const result = parseFeedbackParams('');

        // Assert
        expect(result.type).toBeUndefined();
        expect(result.title).toBeUndefined();
    });

    it('should handle search string with leading question mark', () => {
        // Arrange / Act
        const result = parseFeedbackParams('?type=bug-js');

        // Assert
        expect(result.type).toBe('bug-js');
    });

    it('should sanitize HTML tags (strips tags, keeps text content)', () => {
        // Arrange – URL-encoded <b>bold</b> text → sanitizer strips tags, keeps "boldtext"
        const qs = `title=${encodeURIComponent('<b>safe</b> text')}`;

        // Act
        const result = parseFeedbackParams(qs);

        // Assert – tags removed, inner text preserved
        expect(result.title).not.toContain('<b>');
        expect(result.title).not.toContain('</b>');
        expect(result.title).toBe('safe text');
    });

    it('should sanitize javascript: protocol — url field becomes undefined', () => {
        // Arrange
        const qs = `url=${encodeURIComponent('javascript:alert(1)')}`;

        // Act
        const result = parseFeedbackParams(qs);

        // Assert — sanitizeUrl whitelists only http(s)://; javascript: scheme is rejected entirely.
        expect(result.url).toBeUndefined();
    });

    it('should sanitize inline event handlers', () => {
        // Arrange
        const qs = `title=${encodeURIComponent('onclick=bad() hello')}`;

        // Act
        const result = parseFeedbackParams(qs);

        // Assert
        expect(result.title).not.toMatch(/onclick\s*=/i);
        expect(result.title).toContain('hello');
    });

    it('should return undefined when sanitized value is empty', () => {
        // Arrange – only HTML tags, nothing else
        const qs = `title=${encodeURIComponent('<b></b>')}`;

        // Act
        const result = parseFeedbackParams(qs);

        // Assert
        expect(result.title).toBeUndefined();
    });

    // Regression: reconstructable sanitize — single-pass 'javascript:' removal
    // allows 'jajavascript:vascript:' to survive. Multi-pass fix closes this.
    it('should strip reconstructable javascript: bypass in url → undefined', () => {
        // Arrange — 'jajavascript:vascript:' collapses to 'javascript:' after one pass
        const qs = `url=${encodeURIComponent('jajavascript:vascript:alert(1)')}`;
        // Act
        const result = parseFeedbackParams(qs);
        // Assert — sanitizeUrl rejects anything that is not http(s)://
        expect(result.url).toBeUndefined();
    });

    it('should strip reconstructable javascript: bypass in title → no javascript:', () => {
        // Arrange
        const qs = `title=${encodeURIComponent('jajavascript:vascript:evil')}`;
        // Act
        const result = parseFeedbackParams(qs);
        // Assert — multi-pass sanitize removes both occurrences; final value must not contain it
        expect(result.title).not.toContain('javascript:');
    });

    it('should reject data: URL scheme in url field → undefined', () => {
        // Arrange
        const qs = `url=${encodeURIComponent('data:text/html,<script>alert(1)</script>')}`;
        // Act
        const result = parseFeedbackParams(qs);
        // Assert
        expect(result.url).toBeUndefined();
    });

    it('should reject vbscript: URL scheme in url field → undefined', () => {
        // Arrange
        const qs = `url=${encodeURIComponent('vbscript:msgbox(1)')}`;
        // Act
        const result = parseFeedbackParams(qs);
        // Assert
        expect(result.url).toBeUndefined();
    });

    it('should pass an absolute https:// URL through sanitizeUrl unchanged', () => {
        // Arrange
        const qs = `url=${encodeURIComponent('https://example.com/page?q=1')}`;
        // Act
        const result = parseFeedbackParams(qs);
        // Assert
        expect(result.url).toBe('https://example.com/page?q=1');
    });

    it('should pass an absolute http:// URL through sanitizeUrl unchanged', () => {
        // Arrange
        const qs = `url=${encodeURIComponent('http://localhost:4321/test')}`;
        // Act
        const result = parseFeedbackParams(qs);
        // Assert
        expect(result.url).toBe('http://localhost:4321/test');
    });
});

describe('roundtrip: serialize then parse', () => {
    it('should recover the original values after serialize -> parse', () => {
        // Arrange
        const original: FeedbackQueryParams = {
            type: 'feature-request',
            title: 'Add dark mode',
            description: 'Users have been asking for this',
            source: 'fab'
        };

        // Act
        const qs = serializeFeedbackParams(original);
        const parsed = parseFeedbackParams(qs);

        // Assert
        expect(parsed.type).toBe(original.type);
        expect(parsed.title).toBe(original.title);
        expect(parsed.description).toBe(original.description);
        expect(parsed.source).toBe(original.source);
    });
});
