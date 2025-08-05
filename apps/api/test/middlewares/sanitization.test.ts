/**
 * Sanitization Middleware Tests
 * Tests the data sanitization functionality for security
 */
import { describe, expect, it } from 'vitest';
import {
    sanitizeEmail,
    sanitizeHeaders,
    sanitizeObjectStrings,
    sanitizeQueryParams,
    sanitizeSearchQuery,
    sanitizeString
} from '../../src/middlewares/sanitization';

describe('Sanitization Middleware', () => {
    describe('sanitizeString', () => {
        it('should remove HTML tags', () => {
            const input = '<script>alert("xss")</script>Hello World';
            const result = sanitizeString(input);
            expect(result).toBe('Hello World');
        });

        it('should remove JavaScript protocol', () => {
            const input = 'javascript:alert("xss")';
            const result = sanitizeString(input);
            expect(result).toBe('');
        });

        it('should remove angle brackets', () => {
            const input = 'Hello < World > Test';
            const result = sanitizeString(input);
            expect(result).toBe('Hello World Test');
        });

        it('should normalize spaces', () => {
            const input = '  Hello    World  ';
            const result = sanitizeString(input);
            expect(result).toBe('Hello World');
        });

        it('should limit string length to 1000 characters', () => {
            const longString = 'a'.repeat(1500);
            const result = sanitizeString(longString);
            expect(result.length).toBe(1000);
            expect(result).toBe('a'.repeat(1000));
        });

        it('should handle empty string', () => {
            const result = sanitizeString('');
            expect(result).toBe('');
        });

        it('should handle string with only whitespace', () => {
            const result = sanitizeString('   \n\t  ');
            expect(result).toBe('');
        });

        it('should handle complex XSS attempts', () => {
            const input = '<img src="javascript:alert(\'xss\')" onerror="alert(\'xss\')">';
            const result = sanitizeString(input);
            expect(result).toBe('');
        });
    });

    describe('sanitizeEmail', () => {
        it('should convert to lowercase', () => {
            const result = sanitizeEmail('TEST@EXAMPLE.COM');
            expect(result).toBe('test@example.com');
        });

        it('should trim whitespace', () => {
            const result = sanitizeEmail('  test@example.com  ');
            expect(result).toBe('test@example.com');
        });

        it('should handle mixed case and whitespace', () => {
            const result = sanitizeEmail('  Test@Example.COM  ');
            expect(result).toBe('test@example.com');
        });

        it('should handle empty string', () => {
            const result = sanitizeEmail('');
            expect(result).toBe('');
        });
    });

    describe('sanitizeSearchQuery', () => {
        it('should convert to lowercase', () => {
            const result = sanitizeSearchQuery('HELLO WORLD');
            expect(result).toBe('hello world');
        });

        it('should trim whitespace', () => {
            const result = sanitizeSearchQuery('  hello world  ');
            expect(result).toBe('hello world');
        });

        it('should remove special characters', () => {
            const result = sanitizeSearchQuery('hello@world#$%^&*()');
            expect(result).toBe('hello world');
        });

        it('should normalize spaces', () => {
            const result = sanitizeSearchQuery('hello    world');
            expect(result).toBe('hello world');
        });

        it('should limit length to 100 characters', () => {
            const longQuery = 'a'.repeat(150);
            const result = sanitizeSearchQuery(longQuery);
            expect(result.length).toBe(100);
        });

        it('should handle empty string', () => {
            const result = sanitizeSearchQuery('');
            expect(result).toBe('');
        });

        it('should preserve valid characters', () => {
            const result = sanitizeSearchQuery('hello-world 123');
            expect(result).toBe('hello-world 123');
        });
    });

    describe('sanitizeObjectStrings', () => {
        it('should sanitize string values in object', () => {
            const input = {
                name: '<script>alert("xss")</script>John',
                age: 25,
                email: '  TEST@EXAMPLE.COM  ',
                active: true
            };
            const result = sanitizeObjectStrings(input);
            expect(result).toEqual({
                name: 'John',
                age: 25,
                email: 'test@example.com',
                active: true
            });
        });

        it('should handle empty object', () => {
            const result = sanitizeObjectStrings({});
            expect(result).toEqual({});
        });

        it('should handle object with no strings', () => {
            const input = {
                age: 25,
                active: true,
                scores: [1, 2, 3]
            };
            const result = sanitizeObjectStrings(input);
            expect(result).toEqual(input);
        });

        it('should handle nested objects (shallow only)', () => {
            const input = {
                name: '<b>John</b>',
                details: {
                    bio: '<script>alert("xss")</script>Developer'
                }
            };
            const result = sanitizeObjectStrings(input);
            expect(result.name).toBe('John');
            expect(result.details).toEqual({
                bio: '<script>alert("xss")</script>Developer'
            });
        });

        it('should preserve array values', () => {
            const input = {
                name: 'John',
                tags: ['<script>alert("xss")</script>developer', 'programmer']
            };
            const result = sanitizeObjectStrings(input);
            expect(result.name).toBe('John');
            expect(result.tags).toEqual(['<script>alert("xss")</script>developer', 'programmer']);
        });
    });

    describe('sanitizeQueryParams', () => {
        it('should sanitize query parameters', () => {
            const params = new URLSearchParams();
            params.set('name', '<script>alert("xss")</script>John');
            params.set('email', '  TEST@EXAMPLE.COM  ');
            params.set('age', '25');

            const result = sanitizeQueryParams(params);
            expect(result.get('name')).toBe('John');
            expect(result.get('email')).toBe('test@example.com');
            expect(result.get('age')).toBe('25');
        });

        it('should handle empty URLSearchParams', () => {
            const params = new URLSearchParams();
            const result = sanitizeQueryParams(params);
            expect(result.toString()).toBe('');
        });

        it('should handle multiple values for same key', () => {
            const params = new URLSearchParams();
            params.set('tags', '<script>alert("xss")</script>developer');
            params.append('tags', 'programmer');

            const result = sanitizeQueryParams(params);
            expect(result.getAll('tags')).toEqual(['developer', 'programmer']);
        });

        it('should handle special characters in query params', () => {
            const params = new URLSearchParams();
            params.set('search', 'hello@world#$%^&*()');

            const result = sanitizeQueryParams(params);
            expect(result.get('search')).toBe('hello world');
        });
    });

    describe('sanitizeHeaders', () => {
        it('should sanitize string values in headers', () => {
            const headers = {
                'user-agent': '<script>alert("xss")</script>Mozilla/5.0',
                authorization: '  Bearer TOKEN  ',
                'content-length': 123,
                'content-type': 'application/json'
            };

            const result = sanitizeHeaders(headers);
            expect(result['user-agent']).toBe('Mozilla/5.0');
            expect(result.authorization).toBe('Bearer TOKEN');
            expect(result['content-length']).toBe(123);
            expect(result['content-type']).toBe('application/json');
        });

        it('should handle empty headers object', () => {
            const result = sanitizeHeaders({});
            expect(result).toEqual({});
        });

        it('should handle headers with no strings', () => {
            const headers = {
                'content-length': 123,
                'content-type': 'application/json'
            };

            const result = sanitizeHeaders(headers);
            expect(result).toEqual(headers);
        });

        it('should handle headers with special characters', () => {
            const headers = {
                'x-custom-header': 'hello@world#$%^&*()',
                'x-api-key': '  API_KEY_123  '
            };

            const result = sanitizeHeaders(headers);
            expect(result['x-custom-header']).toBe('hello world');
            expect(result['x-api-key']).toBe('api key 123');
        });
    });

    describe('Security Edge Cases', () => {
        it('should handle null and undefined values gracefully', () => {
            const input = {
                name: 'John',
                nullValue: null,
                undefinedValue: undefined
            };

            const result = sanitizeObjectStrings(input);
            expect(result.name).toBe('John');
            expect(result.nullValue).toBeNull();
            expect(result.undefinedValue).toBeUndefined();
        });

        it('should handle very long strings', () => {
            const longString = 'a'.repeat(2000);
            const result = sanitizeString(longString);
            expect(result.length).toBe(1000);
        });

        it('should handle unicode characters', () => {
            const input = 'Hello 世界 <script>alert("xss")</script>';
            const result = sanitizeString(input);
            expect(result).toBe('Hello 世界');
        });

        it('should handle mixed content types', () => {
            const input = {
                string: '<b>Hello</b>',
                number: 42,
                boolean: true,
                array: [1, 2, 3],
                object: { key: 'value' }
            };

            const result = sanitizeObjectStrings(input);
            expect(result.string).toBe('Hello');
            expect(result.number).toBe(42);
            expect(result.boolean).toBe(true);
            expect(result.array).toEqual([1, 2, 3]);
            expect(result.object).toEqual({ key: 'value' });
        });
    });
});
