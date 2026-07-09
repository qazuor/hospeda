import { afterEach, describe, expect, it } from 'vitest';
import { configureLogger, resetLoggerConfig } from '../src/config.js';
import { buildLogEntry, type LogEntry } from '../src/log-entry.js';
import { LogLevel } from '../src/types.js';

/** Cast helper: buildLogEntry's return type is fixed, but the getContext
 * seam merges arbitrary extra keys onto the entry at runtime. */
type LogEntryWithContext = LogEntry & Record<string, unknown>;

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

        describe('getContext integration (request-context seam)', () => {
            afterEach(() => {
                resetLoggerConfig();
            });

            it('should merge fields returned by the getContext provider into the entry', () => {
                // Arrange
                configureLogger({
                    getContext: () => ({
                        requestId: 'req-1',
                        userId: 'user-1',
                        sessionId: 'sess-1',
                        visitorId: 'vid-1'
                    })
                });

                // Act
                const entry = buildLogEntry(LogLevel.INFO, 'hello') as LogEntryWithContext;

                // Assert
                expect(entry.requestId).toBe('req-1');
                expect(entry.userId).toBe('user-1');
                expect(entry.sessionId).toBe('sess-1');
                expect(entry.visitorId).toBe('vid-1');
                expect(entry.message).toBe('hello');
            });

            it('should leave the entry unchanged when no provider is configured', () => {
                // Act
                const entry = buildLogEntry(LogLevel.INFO, 'hello');

                // Assert
                expect(Object.keys(entry).sort()).toEqual(['level', 'message', 'ts']);
            });

            it('should leave the entry unchanged when the provider returns undefined', () => {
                // Arrange
                configureLogger({ getContext: () => undefined });

                // Act
                const entry = buildLogEntry(LogLevel.INFO, 'hello');

                // Assert
                expect(Object.keys(entry).sort()).toEqual(['level', 'message', 'ts']);
            });

            it('should keep logging intact and core fields correct when the provider throws', () => {
                // Arrange
                configureLogger({
                    getContext: () => {
                        throw new Error('boom');
                    }
                });

                // Act
                const entry = buildLogEntry(LogLevel.ERROR, 'oops');

                // Assert
                expect(entry.message).toBe('oops');
                expect(entry.level).toBe(LogLevel.ERROR);
            });

            it('should never let context fields override ts, level, or message', () => {
                // Arrange
                configureLogger({
                    getContext: () => ({
                        ts: 'FAKE-TIMESTAMP',
                        level: 'FAKE-LEVEL',
                        message: 'FAKE-MESSAGE',
                        requestId: 'req-2'
                    })
                });

                // Act
                const entry = buildLogEntry(LogLevel.WARN, 'real message') as LogEntryWithContext;

                // Assert — core fields win over anything the provider returns
                expect(entry.level).toBe(LogLevel.WARN);
                expect(entry.message).toBe('real message');
                expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
                expect(entry.requestId).toBe('req-2');
            });

            it('should strip reserved keys (category, label, data) coming from the provider', () => {
                // Arrange — a provider that tries to smuggle reserved keys
                configureLogger({
                    getContext: () => ({
                        category: 'HIJACK',
                        label: 'HIJACK',
                        data: { hijacked: true },
                        visitorId: 'vid-1'
                    })
                });

                // Act — real call sets category via options; no label/data value
                const entry = buildLogEntry(LogLevel.INFO, 'real message', undefined, {
                    category: 'REAL'
                }) as LogEntryWithContext & { visitorId?: string };

                // Assert — reserved keys reflect the real call, not the provider
                expect(entry.category).toBe('REAL');
                expect(entry.label).toBeUndefined();
                expect(entry.data).toBeUndefined();
                // Non-reserved context fields still pass through
                expect(entry.visitorId).toBe('vid-1');
            });
        });
    });
});
