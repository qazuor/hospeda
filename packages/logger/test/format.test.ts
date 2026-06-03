/**
 * Integration tests for the LOG_FORMAT pretty|json toggle at the public logger
 * boundary: `logger.<level>()` -> `console.<level>()`.
 *
 * Unit-level coverage of `formatLogArgs` / `buildLogEntry` lives in
 * formatter.test.ts and log-entry.test.ts. These tests assert the end-to-end
 * effect of switching `FORMAT` via `configureLogger`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, { LogFormat, LogLevel, configureLogger } from '../src/index.js';
import { resetLogger } from '../src/logger.js';

describe('LOG_FORMAT toggle (public logger -> console)', () => {
    beforeEach(() => {
        resetLogger();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('FORMAT=json', () => {
        it('should emit a parseable JSON line with ts/level/message for a string log', () => {
            // Arrange
            configureLogger({ FORMAT: LogFormat.JSON });

            // Act
            logger.info('hello toggle');

            // Assert
            const arg = vi.mocked(console.info).mock.calls[0]?.[0] as string;
            const parsed = JSON.parse(arg);
            expect(parsed.level).toBe(LogLevel.INFO);
            expect(parsed.message).toBe('hello toggle');
            expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should put an object payload into the redacted data field', () => {
            // Arrange
            configureLogger({ FORMAT: LogFormat.JSON });

            // Act
            logger.warn({ password: 'secret', id: 1 });

            // Assert
            const arg = vi.mocked(console.warn).mock.calls[0]?.[0] as string;
            const parsed = JSON.parse(arg);
            expect(parsed.level).toBe(LogLevel.WARN);
            expect(parsed.data).toEqual({ password: '[REDACTED]', id: 1 });
        });

        it('should redact a sensitive key to [REDACTED] in the JSON output', () => {
            // Arrange
            configureLogger({ FORMAT: LogFormat.JSON });

            // Act
            logger.error({ password: 'hunter2' });

            // Assert
            const arg = vi.mocked(console.error).mock.calls[0]?.[0] as string;
            expect(arg).toContain('[REDACTED]');
            expect(arg).not.toContain('hunter2');
        });

        it('should not contain ANSI escape codes even when USE_COLORS is true', () => {
            // Arrange
            configureLogger({ FORMAT: LogFormat.JSON, USE_COLORS: true });

            // Act
            logger.info('plain json line');

            // Assert — no ANSI escape sequences (ESC = \x1b)
            const arg = vi.mocked(console.info).mock.calls[0]?.[0] as string;
            // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting absence of ANSI escapes
            expect(arg).not.toMatch(/\x1b\[/);
        });
    });

    describe('FORMAT=pretty (default)', () => {
        it('should emit a non-JSON pretty line containing the message', () => {
            // Arrange
            configureLogger({ FORMAT: LogFormat.PRETTY, USE_COLORS: false });

            // Act
            logger.info('pretty message');

            // Assert
            const arg = vi.mocked(console.info).mock.calls[0]?.[0] as string;
            expect(arg).toContain('pretty message');
            expect(() => JSON.parse(arg)).toThrow();
        });
    });

    describe('runtime switch', () => {
        it('should change the emitted shape when FORMAT is flipped between calls', () => {
            // Arrange + Act: pretty first
            configureLogger({ FORMAT: LogFormat.PRETTY, USE_COLORS: false });
            logger.info('first');
            const prettyArg = vi.mocked(console.info).mock.calls[0]?.[0] as string;

            // Act: flip to json
            configureLogger({ FORMAT: LogFormat.JSON });
            logger.info('second');
            const jsonArg = vi.mocked(console.info).mock.calls[1]?.[0] as string;

            // Assert
            expect(() => JSON.parse(prettyArg)).toThrow();
            expect(JSON.parse(jsonArg).message).toBe('second');
        });
    });
});
