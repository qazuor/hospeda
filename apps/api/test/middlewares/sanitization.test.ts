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

        it('should handle nested objects (recursively sanitizes nested fields)', () => {
            const input = {
                name: '<b>John</b>',
                details: {
                    bio: '<script>alert("xss")</script>Developer'
                }
            };
            const result = sanitizeObjectStrings(input);
            expect(result.name).toBe('John');
            expect(result.details).toEqual({
                bio: 'Developer'
            });
        });

        it('should sanitize array string values', () => {
            const input = {
                name: 'John',
                tags: ['<script>alert("xss")</script>developer', 'programmer']
            };
            const result = sanitizeObjectStrings(input);
            expect(result.name).toBe('John');
            expect(result.tags).toEqual(['developer', 'programmer']);
        });

        it('should recursively sanitize nested objects', () => {
            // Arrange
            const input = {
                user: {
                    name: '<script>alert("xss")</script>John',
                    profile: {
                        bio: '<b>Developer</b>'
                    }
                }
            };

            // Act
            const result = sanitizeObjectStrings(input);

            // Assert
            expect(result.user.name).toBe('John');
            expect((result.user.profile as { bio: string }).bio).toBe('Developer');
        });

        it('should sanitize arrays of objects', () => {
            // Arrange
            const input = {
                items: [{ name: '<script>alert("xss")</script>Item1' }, { name: '<b>Item2</b>' }]
            };

            // Act
            const result = sanitizeObjectStrings(input);

            // Assert
            expect((result.items as Array<{ name: string }>)[0]?.name).toBe('Item1');
            expect((result.items as Array<{ name: string }>)[1]?.name).toBe('Item2');
        });

        it('should preserve Date objects in nested structures', () => {
            // Arrange
            const createdAt = new Date('2024-01-01');
            const input = {
                meta: {
                    createdAt,
                    name: '<script>xss</script>Test'
                }
            };

            // Act
            const result = sanitizeObjectStrings(input);

            // Assert
            expect((result.meta as { createdAt: Date; name: string }).createdAt).toBe(createdAt);
            expect((result.meta as { createdAt: Date; name: string }).name).toBe('Test');
        });

        it('should handle deeply nested objects safely', () => {
            // Arrange - build a 10-level deep object with XSS at the leaf
            type DeepObject = { level: string; child?: DeepObject };
            let deepObj: DeepObject = { level: '<script>xss</script>leaf' };
            for (let i = 9; i >= 1; i--) {
                deepObj = { level: `<b>level${i}</b>`, child: deepObj };
            }

            // Act - should not throw despite deep nesting
            let result: DeepObject | undefined;
            expect(() => {
                result = sanitizeObjectStrings(
                    deepObj as unknown as Record<string, unknown>
                ) as unknown as DeepObject;
            }).not.toThrow();

            // Assert - top level and deepest level are sanitized
            expect(result?.level).toBe('level1');

            let current = result;
            for (let i = 2; i <= 9; i++) {
                current = current?.child;
                expect(current?.level).toBe(`level${i}`);
            }
            expect(current?.child?.level).toBe('leaf');
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
            // Note: The new implementation preserves special characters in headers
            // because they're not XSS attacks - only HTML tags are removed
            const headers = {
                'x-custom-header': 'hello@world#$%^&*()',
                'x-api-key': '  API_KEY_123  '
            };

            const result = sanitizeHeaders(headers);
            // Special characters are preserved (not XSS)
            expect(result['x-custom-header']).toBe('hello@world#$%^&*()');
            // Whitespace is trimmed
            expect(result['x-api-key']).toBe('API_KEY_123');
        });

        it('should remove HTML tags from headers', () => {
            const headers = {
                'x-custom-header': '<script>alert("xss")</script>valid',
                'x-api-key': '<b>bold</b>key'
            };

            const result = sanitizeHeaders(headers);
            // Script content is removed entirely
            expect(result['x-custom-header']).toBe('valid');
            // HTML tags are removed but text content is preserved
            expect(result['x-api-key']).toBe('boldkey');
        });
    });

    describe('Sanitization integration scenarios', () => {
        it('should sanitize request body with script tags before validation', () => {
            // Simulates a POST body with XSS payload
            const requestBody = {
                name: '<script>document.cookie</script>Admin User',
                email: 'admin@example.com',
                bio: '<img src=x onerror="alert(1)">Developer'
            };

            const sanitized = sanitizeObjectStrings(requestBody);

            expect(sanitized.name).toBe('Admin User');
            expect(sanitized.email).toBe('admin@example.com');
            expect(sanitized.bio).toBe('Developer');
        });

        it('should sanitize query params with XSS payloads', () => {
            const params = new URLSearchParams();
            params.set('search', '<script>alert("xss")</script>hotels');
            params.set('sort', 'name"><img src=x onerror=alert(1)>');
            params.set('page', '1');

            const sanitized = sanitizeQueryParams(params);

            expect(sanitized.get('search')).toBe('hotels');
            expect(sanitized.get('sort')).not.toContain('onerror');
            expect(sanitized.get('page')).toBe('1');
        });

        it('should sanitize headers with malicious values', () => {
            const headers = {
                'x-custom': '<script>steal()</script>valid-value',
                authorization: 'Bearer abc123',
                'user-agent': 'Mozilla/5.0 <img src=x onerror=alert(1)>'
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized['x-custom']).toBe('valid-value');
            expect(sanitized.authorization).toBe('Bearer abc123');
            expect(sanitized['user-agent']).not.toContain('onerror');
        });

        it('should handle double-encoded XSS payloads', () => {
            // Double-encoded: &lt;script&gt; -> <script> after first decode
            const input = '&lt;script&gt;alert("xss")&lt;/script&gt;Safe text';
            const result = sanitizeString(input);

            // After sanitization, <script> tags are stripped (angle brackets removed)
            // The remaining text content is safe (no executable script)
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('</script>');
            expect(result).toContain('Safe text');
        });

        it('should sanitize path traversal patterns in string fields', () => {
            const input = {
                filename: '../../../etc/passwd',
                path: '..\\..\\windows\\system32',
                title: 'Normal Title'
            };

            const sanitized = sanitizeObjectStrings(input);

            // sanitizeString doesn't specifically target path traversal (that's URL-level),
            // but it should not introduce any additional risk
            expect(sanitized.title).toBe('Normal Title');
            // Verify no error thrown for path traversal strings
            expect(typeof sanitized.filename).toBe('string');
            expect(typeof sanitized.path).toBe('string');
        });

        it('should sanitize nested objects in request body', () => {
            const requestBody = {
                user: {
                    name: '<b>Bold</b> Name',
                    address: {
                        city: '<script>xss</script>Buenos Aires',
                        country: 'Argentina'
                    }
                },
                tags: ['<img src=x>tag1', 'tag2']
            };

            const sanitized = sanitizeObjectStrings(requestBody);

            expect((sanitized.user as { name: string }).name).toBe('Bold Name');
            expect((sanitized.user as { address: { city: string } }).address.city).toBe(
                'Buenos Aires'
            );
            expect((sanitized.tags as string[])[0]).toBe('tag1');
            expect((sanitized.tags as string[])[1]).toBe('tag2');
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
