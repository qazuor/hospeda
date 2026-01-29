import { describe, expect, it } from 'vitest';
import {
    capitalize,
    isEmpty,
    randomString,
    stripHtml,
    titleCase,
    toSlug,
    truncate
} from '../src/string';

describe('String Utilities', () => {
    describe('capitalize', () => {
        it('capitalizes first letter', () => {
            expect(capitalize('hello')).toBe('Hello');
        });

        it('handles empty string', () => {
            expect(capitalize('')).toBe('');
        });

        it('handles single character', () => {
            expect(capitalize('a')).toBe('A');
        });

        it('preserves rest of string', () => {
            expect(capitalize('hELLO')).toBe('HELLO');
        });
    });

    describe('titleCase', () => {
        it('converts to title case', () => {
            expect(titleCase('hello world')).toBe('Hello World');
        });

        it('handles empty string', () => {
            expect(titleCase('')).toBe('');
        });

        it('handles mixed case input', () => {
            expect(titleCase('hELLO WORLD')).toBe('Hello World');
        });
    });

    describe('truncate', () => {
        it('truncates long strings', () => {
            expect(truncate('Hello World', 8)).toBe('Hello...');
        });

        it('does not truncate short strings', () => {
            expect(truncate('Hi', 10)).toBe('Hi');
        });

        it('handles empty string', () => {
            expect(truncate('', 10)).toBe('');
        });

        it('uses custom suffix', () => {
            expect(truncate('Hello World', 8, '…')).toBe('Hello W…');
        });
    });

    describe('toSlug', () => {
        it('converts to URL-friendly slug', () => {
            expect(toSlug('Hello World')).toBe('hello-world');
        });

        it('handles special characters', () => {
            expect(toSlug('Hello! @World#')).toBe('hello-world');
        });

        it('handles empty string', () => {
            expect(toSlug('')).toBe('');
        });

        it('handles accented characters', () => {
            expect(toSlug('Café')).toBe('cafe');
        });
    });

    describe('stripHtml', () => {
        it('removes HTML tags', () => {
            expect(stripHtml('<p>Hello</p>')).toBe('Hello');
        });

        it('handles multiple tags', () => {
            expect(stripHtml('<p>Hello</p><span>World</span>')).toBe('HelloWorld');
        });

        it('handles empty string', () => {
            expect(stripHtml('')).toBe('');
        });

        it('handles nested tags', () => {
            expect(stripHtml('<div><p>Hello</p></div>')).toBe('Hello');
        });
    });

    describe('isEmpty', () => {
        it('returns true for undefined', () => {
            expect(isEmpty(undefined)).toBe(true);
        });

        it('returns true for null', () => {
            expect(isEmpty(null)).toBe(true);
        });

        it('returns true for empty string', () => {
            expect(isEmpty('')).toBe(true);
        });

        it('returns true for whitespace string', () => {
            expect(isEmpty('   ')).toBe(true);
        });

        it('returns false for non-empty string', () => {
            expect(isEmpty('hello')).toBe(false);
        });
    });

    describe('randomString', () => {
        it('generates string of specified length', () => {
            expect(randomString(10)).toHaveLength(10);
            expect(randomString(20)).toHaveLength(20);
        });

        it('uses default length of 8', () => {
            expect(randomString()).toHaveLength(8);
        });

        it('uses specified characters', () => {
            const result = randomString(10, 'abc');
            expect(result).toMatch(/^[abc]+$/);
        });

        it('generates different strings on each call', () => {
            const results = new Set([randomString(20), randomString(20), randomString(20)]);
            expect(results.size).toBeGreaterThan(1);
        });
    });
});
