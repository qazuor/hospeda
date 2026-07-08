import { describe, expect, it } from 'vitest';
import { buildLogEntry } from '../src/log-entry.js';
import { LogLevel } from '../src/types.js';

describe('log-entry', () => {
    describe('buildLogEntry', () => {
        it('should place a string value into message and leave data absent', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, 'hello world');

            // Assert
            expect(entry.message).toBe('hello world');
            expect(entry).not.toHaveProperty('data');
        });

        it('should place an object value into data with an empty message', () => {
            // Arrange
            const value = { userId: 42, action: 'login' };

            // Act
            const entry = buildLogEntry(LogLevel.INFO, value);

            // Assert
            expect(entry.data).toEqual(value);
            expect(entry.message).toBe('');
        });

        it('should use the label as message when the value is an object', () => {
            // Act
            const entry = buildLogEntry(LogLevel.WARN, { count: 3 }, 'request summary');

            // Assert
            expect(entry.message).toBe('request summary');
            expect(entry.data).toEqual({ count: 3 });
        });

        it('should carry the level through', () => {
            // Act
            const entry = buildLogEntry(LogLevel.ERROR, 'boom');

            // Assert
            expect(entry.level).toBe(LogLevel.ERROR);
        });

        it('should produce an ISO-8601 timestamp', () => {
            // Act
            const entry = buildLogEntry(LogLevel.LOG, 'tick');

            // Assert
            expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should include a non-DEFAULT category', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, 'msg', undefined, { category: 'API' });

            // Assert
            expect(entry.category).toBe('API');
        });

        it('should omit the category when it is DEFAULT', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, 'msg', undefined, { category: 'DEFAULT' });

            // Assert
            expect(entry).not.toHaveProperty('category');
        });

        it('should omit the category when no options are given', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, 'msg');

            // Assert
            expect(entry).not.toHaveProperty('category');
        });

        it('should include the label when provided', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, 'msg', 'my-label');

            // Assert
            expect(entry.label).toBe('my-label');
        });

        it('should redact sensitive keys inside object data', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, { password: 'hunter2', userId: 7 });

            // Assert
            expect(entry.data).toEqual({ password: '[REDACTED]', userId: 7 });
        });

        it('should redact sensitive patterns inside a string message', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, 'contact me at john.doe@example.com');

            // Assert
            expect(entry.message).toBe('contact me at [REDACTED]');
        });

        it('should bound an oversized data payload so the entry stays small', () => {
            // Arrange: a runaway result like the old DB full-result dump.
            const value = {
                items: Array.from({ length: 500 }, (_, i) => ({
                    id: `id-${i}`,
                    blob: 'x'.repeat(5000)
                })),
                total: 500
            };

            // Act
            const entry = buildLogEntry(LogLevel.INFO, value);

            // Assert: serialized entry is far smaller than the raw payload and
            // still valid JSON.
            const serialized = JSON.stringify(entry);
            expect(serialized.length).toBeLessThan(100_000);
            expect(() => JSON.parse(serialized)).not.toThrow();
        });

        it('should leave a small structured payload untouched', () => {
            // Act
            const entry = buildLogEntry(LogLevel.INFO, {
                table: 'users',
                action: 'count',
                result: { count: 3 }
            });

            // Assert
            expect(entry.data).toEqual({
                table: 'users',
                action: 'count',
                result: { count: 3 }
            });
        });
    });
});
