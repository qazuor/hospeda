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

    it('should sanitize javascript: protocol', () => {
        // Arrange
        const qs = `url=${encodeURIComponent('javascript:alert(1)')}`;

        // Act
        const result = parseFeedbackParams(qs);

        // Assert
        expect(result.url).not.toContain('javascript:');
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
