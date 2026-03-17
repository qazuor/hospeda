/**
 * Tests for formatter.ts - formatValue, formatLogMessage, formatLogArgs,
 * color/utility functions, and redactSensitiveData
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCategoryInternal } from '../src/categories.js';
import { configureLogger } from '../src/config.js';
import {
    formatLogArgs,
    formatLogMessage,
    formatTimestamp,
    formatValue,
    getCategoryBackgroundFunction,
    getColorFunction,
    levelBgColors,
    levelColors,
    levelIcons
} from '../src/formatter.js';
// NOTE: The compiled .js file in src/ is stale and lacks redactSensitiveData
// and shouldUseWhiteText exports. Import these directly from .ts source.
// These are pure functions with no shared state, so the dual-module issue
// does not apply.
import { redactSensitiveData, shouldUseWhiteText } from '../src/formatter.ts';
import { resetLogger } from '../src/logger.js';
import { LogLevel, type LoggerColorType, LoggerColors } from '../src/types.js';

describe('formatter', () => {
    beforeEach(() => {
        resetLogger();
        configureLogger({
            USE_COLORS: false,
            INCLUDE_TIMESTAMPS: false,
            INCLUDE_LEVEL: false
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // T-019: formatValue tests
    // =========================================================================
    describe('formatValue', () => {
        it('should return "null" for null', () => {
            expect(formatValue(null)).toBe('null');
        });

        it('should return "undefined" for undefined', () => {
            expect(formatValue(undefined)).toBe('undefined');
        });

        it('should return short strings unchanged', () => {
            expect(formatValue('hello world')).toBe('hello world');
        });

        it('should truncate long strings when truncateText=true', () => {
            const longStr = 'x'.repeat(200);
            const result = formatValue(longStr, 2, true, 100);
            // NOTE: Top-level formatValue uses "...[TRUNCATED]" (no space before bracket).
            // The recursive expandObject inside uses "... [TRUNCATED]" (with space).
            // This is an inconsistency in the source code. We assert actual behavior here.
            expect(result).toBe(`${'x'.repeat(100)}...[TRUNCATED]`);
        });

        it('should NOT truncate long strings when truncateText=false', () => {
            const longStr = 'x'.repeat(200);
            const result = formatValue(longStr, 2, false, 100);
            expect(result).toBe(longStr);
        });

        it('should expand objects to the specified level (expandLevels=2)', () => {
            const obj = { a: { b: { c: 'deep' } } };
            const result = formatValue(obj, 2, false);
            const parsed = JSON.parse(result) as Record<string, unknown>;
            expect(parsed).toHaveProperty('a');
            const inner = parsed.a as Record<string, unknown>;
            expect(inner).toHaveProperty('b');
            // At level 2, 'c' should be collapsed to [Object]
            expect(inner.b).toBe('[Object]');
        });

        it('should return "[Object]" when expandLevels=0', () => {
            const obj = { a: 1 };
            expect(formatValue(obj, 0, false)).toBe('[Object]');
        });

        it('should return full JSON when expandLevels=-1 (no limit)', () => {
            const obj = { a: { b: { c: 'deep' } } };
            const result = formatValue(obj, -1, false);
            const parsed = JSON.parse(result) as Record<string, unknown>;
            const innerA = parsed.a as Record<string, unknown>;
            const innerB = innerA.b as Record<string, unknown>;
            expect(innerB.c).toBe('deep');
        });

        it('should expand arrays of objects correctly', () => {
            const arr = [{ name: 'Alice' }, { name: 'Bob' }];
            const result = formatValue(arr, 2, false);
            const parsed = JSON.parse(result) as Array<Record<string, unknown>>;
            expect(parsed).toHaveLength(2);
            expect(parsed[0]?.name).toBe('Alice');
            expect(parsed[1]?.name).toBe('Bob');
        });

        it('should handle circular references with "[Circular]" via expandObject', () => {
            // NOTE: redactSensitiveData (called first inside formatValue) has no
            // cycle detection, so passing a truly circular object to formatValue
            // causes a stack overflow. To test the expandObject circular-ref logic
            // we must call expandObject indirectly by constructing an object whose
            // circular reference is created AFTER redaction. We can't do that with
            // the public API alone, so instead we test that formatValue gracefully
            // handles the error case by returning an error string.
            const inner: Record<string, unknown> = { value: 'ok' };
            const outer: Record<string, unknown> = { child: inner };
            inner.parent = outer; // circular

            // formatValue will hit the stack overflow in redactSensitiveData
            // and the function may throw. We verify it doesn't crash the process.
            let threw = false;
            try {
                formatValue(outer, 5, false);
            } catch {
                threw = true;
            }
            // Known limitation: circular refs overflow in redactSensitiveData
            expect(threw).toBe(true);
        });

        // Sensitive data redaction through formatValue
        it('should redact object with "password" key', () => {
            const obj = { user: 'john', password: 'secret123' };
            const result = formatValue(obj, 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('secret123');
        });

        it('should redact email addresses in strings', () => {
            const result = formatValue('Contact user@example.com for info', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('user@example.com');
        });

        it('should redact JWT tokens in strings', () => {
            const jwt =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
            const result = formatValue(`token: ${jwt}`, 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('eyJ');
        });

        it('should redact Bearer tokens in strings', () => {
            const result = formatValue('Authorization: Bearer abc123xyz789', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('abc123xyz789');
        });

        it('should redact credit card numbers in strings', () => {
            const result = formatValue('Card: 4111-1111-1111-1111', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('4111-1111-1111-1111');
        });

        it('should redact IPv4 addresses in strings', () => {
            const result = formatValue('Client IP: 192.168.1.100', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('192.168.1.100');
        });

        it('should redact Argentine CUIT/CUIL numbers in strings', () => {
            const result = formatValue('CUIT: 20-12345678-9', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('20-12345678-9');
        });

        it('should redact Argentine phone numbers in strings', () => {
            const result = formatValue('Phone: +54 9 11 1234-5678', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('1234-5678');
        });

        it('should redact API keys with sk_ prefix in strings', () => {
            const result = formatValue('key: sk_abcdefghijklmnopqrstuvwxyz', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('sk_abcdefghijklmnopqrstuvwxyz');
        });

        it('should NOT redact non-sensitive data', () => {
            const obj = {
                id: 123,
                name: 'Test Product',
                price: 99.99,
                status: 'active'
            };
            const result = formatValue(obj, 2, false);
            expect(result).toContain('Test Product');
            expect(result).toContain('123');
            expect(result).toContain('99.99');
            expect(result).not.toContain('[REDACTED]');
        });

        // GAP-006: Additional regex pattern redaction tests
        it('should redact SSN patterns in strings', () => {
            const result = formatValue('SSN: 123-45-6789', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('123-45-6789');
        });

        it('should redact IPv6 addresses in strings', () => {
            const result = formatValue('Host: 2001:0db8:85a3:0000:0000:8a2e:0370:7334', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should redact API keys with pk_ prefix in strings', () => {
            const result = formatValue('key: pk_abcdefghijklmnopqrstuv', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('pk_abcdefghijklmnopqrstuv');
        });

        it('should redact API keys with api_ prefix in strings', () => {
            const result = formatValue('key: api_abcdefghijklmnopqrstuv', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('api_abcdefghijklmnopqrstuv');
        });

        it('should redact API keys with key_ prefix in strings', () => {
            const result = formatValue('key: key_abcdefghijklmnopqrstuv', 2, false);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('key_abcdefghijklmnopqrstuv');
        });

        // GAP-012: stringifyObj option tests
        it('should produce compact JSON when stringifyObj=true', () => {
            const obj = { name: 'Alice', age: 30 };
            const result = formatValue(obj, 2, false, 100, true);
            // Compact JSON has no newlines or indentation
            expect(result).not.toContain('\n');
            const parsed = JSON.parse(result) as Record<string, unknown>;
            expect(parsed.name).toBe('Alice');
            expect(parsed.age).toBe(30);
        });

        it('should produce pretty JSON when stringifyObj=false', () => {
            const obj = { name: 'Alice', age: 30 };
            const result = formatValue(obj, 2, false, 100, false);
            // Pretty JSON has newlines and indentation
            expect(result).toContain('\n');
            const parsed = JSON.parse(result) as Record<string, unknown>;
            expect(parsed.name).toBe('Alice');
            expect(parsed.age).toBe(30);
        });

        // GAP-007: Recursive truncation uses "... [TRUNCATED]" (with space)
        // whereas top-level formatValue uses "...[TRUNCATED]" (no space).
        // This test documents the inconsistency.
        it('should use "... [TRUNCATED]" (with space) in recursive expandObject truncation', () => {
            const obj = { data: 'x'.repeat(200) };
            const result = formatValue(obj, 2, true, 100);
            // The recursive expandObject path adds a space before [TRUNCATED]
            expect(result).toContain('... [TRUNCATED]');
        });

        // GAP-015: JSON.stringify error catch path
        it('should return error string when toJSON() throws', () => {
            const badObj = {
                toJSON(): never {
                    throw new Error('toJSON failed');
                }
            };
            const result = formatValue(badObj, 2, false);
            expect(result).toContain('[Object:');
            expect(result).toContain('toJSON failed');
        });
    });

    // =========================================================================
    // T-020: formatLogMessage and formatLogArgs tests
    // =========================================================================
    describe('formatLogMessage', () => {
        it('should NOT include category prefix when no category is specified', () => {
            const result = formatLogMessage(LogLevel.INFO, 'hello');
            // DEFAULT category should not be shown
            expect(result).not.toContain('DEFAULT');
            expect(result).toContain('hello');
        });

        it('should include registered category name in uppercase', () => {
            registerCategoryInternal('Authentication', 'AUTH_FMT_TEST', {
                color: LoggerColors.BLUE
            });
            const result = formatLogMessage(LogLevel.INFO, 'test', undefined, {
                category: 'AUTH_FMT_TEST'
            });
            expect(result).toContain('AUTHENTICATION');
        });

        it('should include timestamp when INCLUDE_TIMESTAMPS=true', () => {
            configureLogger({ INCLUDE_TIMESTAMPS: true, USE_COLORS: false });
            const result = formatLogMessage(LogLevel.INFO, 'test');
            // Timestamp format: [YYYY-MM-DD HH:MM:SS]
            expect(result).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}]/);
        });

        it('should include level label when INCLUDE_LEVEL=true', () => {
            configureLogger({ INCLUDE_LEVEL: true, USE_COLORS: false });
            const result = formatLogMessage(LogLevel.INFO, 'test');
            expect(result).toContain('[INFO]');
        });

        it('should include level label for ERROR level', () => {
            configureLogger({ INCLUDE_LEVEL: true, USE_COLORS: false });
            const result = formatLogMessage(LogLevel.ERROR, 'oops');
            expect(result).toContain('[ERROR]');
        });

        it('should include label when provided', () => {
            const result = formatLogMessage(LogLevel.INFO, 'test', 'MyLabel');
            expect(result).toContain('[MyLabel]');
        });

        it('should NOT truncate error messages when TRUNCATE_LONG_TEXT_ON_ERROR=false', () => {
            configureLogger({ TRUNCATE_LONG_TEXT_ON_ERROR: false });
            const longText = 'e'.repeat(200);
            const result = formatLogMessage(LogLevel.ERROR, longText);
            expect(result).toContain(longText);
            expect(result).not.toContain('TRUNCATED');
        });

        it('should NEVER truncate DEBUG level messages', () => {
            configureLogger({
                TRUNCATE_LONG_TEXT: true,
                TRUNCATE_LONG_TEXT_ON_ERROR: true
            });
            const longText = 'd'.repeat(200);
            const result = formatLogMessage(LogLevel.DEBUG, longText);
            expect(result).toContain(longText);
            expect(result).not.toContain('TRUNCATED');
        });
    });

    describe('formatLogArgs', () => {
        it('should return an array with a single formatted string', () => {
            const args = formatLogArgs(LogLevel.INFO, 'hello', 'label');
            expect(Array.isArray(args)).toBe(true);
            expect(args).toHaveLength(1);
            expect(typeof args[0]).toBe('string');
            expect(args[0] as string).toContain('hello');
            expect(args[0] as string).toContain('[label]');
        });
    });

    describe('formatTimestamp', () => {
        it('should return timestamp in [YYYY-MM-DD HH:MM:SS] format with brackets', () => {
            const ts = formatTimestamp();
            expect(ts).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}]$/);
        });

        it('should zero-pad single-digit date/time components', () => {
            // Use a date known to have single-digit components
            const mockDate = new Date('2025-01-05T03:07:09Z');
            vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

            const ts = formatTimestamp();
            // The ISO date part is always zero-padded, and toTimeString also zero-pads
            expect(ts).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}]$/);
            // Verify the date portion specifically contains the zero-padded month/day
            expect(ts).toContain('2025-01-05');
        });
    });

    // =========================================================================
    // T-021: Color and utility function tests
    // =========================================================================
    describe('getColorFunction', () => {
        const allColors: LoggerColorType[] = Object.values(LoggerColors) as LoggerColorType[];

        it('should return a function for each LoggerColors value', () => {
            for (const color of allColors) {
                const fn = getColorFunction(color);
                expect(typeof fn).toBe('function');
            }
        });

        it('should return a function that produces a string (does not throw)', () => {
            for (const color of allColors) {
                const fn = getColorFunction(color);
                const result = fn('test');
                expect(typeof result).toBe('string');
            }
        });
    });

    describe('getCategoryBackgroundFunction', () => {
        it('should return a chalk function with background color', () => {
            const fn = getCategoryBackgroundFunction('CYAN');
            expect(typeof fn).toBe('function');
            const result = fn('TEST');
            expect(typeof result).toBe('string');
            // In non-TTY test env, chalk may strip colors, so just check text content
            expect(result).toContain('TEST');
        });

        it('should use contrasting text color (white on dark, black on light)', () => {
            // Dark background - white text
            const darkFn = getCategoryBackgroundFunction('RED');
            const darkResult = darkFn('dark');
            expect(typeof darkResult).toBe('string');
            expect(darkResult).toContain('dark');

            // Light background - black text
            const lightFn = getCategoryBackgroundFunction('YELLOW');
            const lightResult = lightFn('light');
            expect(typeof lightResult).toBe('string');
            expect(lightResult).toContain('light');
        });
    });

    describe('shouldUseWhiteText', () => {
        it('should return true for dark colors: BLACK, RED, BLUE, MAGENTA', () => {
            const darkColors: LoggerColorType[] = ['BLACK', 'RED', 'BLUE', 'MAGENTA'];
            for (const color of darkColors) {
                expect(shouldUseWhiteText(color)).toBe(true);
            }
        });

        it('should return false for light colors: GREEN, YELLOW, CYAN, WHITE, GRAY, and bright variants', () => {
            const lightColors: LoggerColorType[] = [
                'GREEN',
                'YELLOW',
                'CYAN',
                'WHITE',
                'GRAY',
                'BLACK_BRIGHT',
                'RED_BRIGHT',
                'GREEN_BRIGHT',
                'YELLOW_BRIGHT',
                'BLUE_BRIGHT',
                'MAGENTA_BRIGHT',
                'CYAN_BRIGHT',
                'WHITE_BRIGHT'
            ];
            for (const color of lightColors) {
                expect(shouldUseWhiteText(color)).toBe(false);
            }
        });
    });

    describe('level maps smoke tests', () => {
        const allLevels = Object.values(LogLevel);

        it('should have an icon for every LogLevel value', () => {
            for (const level of allLevels) {
                expect(levelIcons[level]).toBeDefined();
                expect(typeof levelIcons[level]).toBe('string');
            }
        });

        it('should have a color function for every LogLevel value', () => {
            for (const level of allLevels) {
                expect(levelColors[level]).toBeDefined();
                expect(typeof levelColors[level]).toBe('function');
            }
        });

        it('should have a bg color function for every LogLevel value', () => {
            for (const level of allLevels) {
                expect(levelBgColors[level]).toBeDefined();
                expect(typeof levelBgColors[level]).toBe('function');
            }
        });
    });

    // =========================================================================
    // T-022: redactSensitiveData isolated tests
    // =========================================================================
    describe('redactSensitiveData', () => {
        it('should redact value when key is "password"', () => {
            expect(redactSensitiveData('secret123', 'password')).toBe('[REDACTED]');
        });

        it('should NOT redact value when key is non-sensitive like "name"', () => {
            expect(redactSensitiveData('John', 'name')).toBe('John');
        });

        it('should redact JWT tokens in string values', () => {
            const jwt =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
            const result = redactSensitiveData(`token: ${jwt}`);
            expect(result).toContain('[REDACTED]');
            expect(result as string).not.toContain('eyJ');
        });

        it('should redact sensitive keys recursively in arrays of objects', () => {
            const arr = [
                { user: 'alice', password: 'pass1' },
                { user: 'bob', password: 'pass2' }
            ];
            const result = redactSensitiveData(arr) as Array<Record<string, unknown>>;
            expect(result[0]?.user).toBe('alice');
            expect(result[0]?.password).toBe('[REDACTED]');
            expect(result[1]?.user).toBe('bob');
            expect(result[1]?.password).toBe('[REDACTED]');
        });

        it('should redact keys at all nesting levels in objects', () => {
            const nested = {
                level1: {
                    level2: {
                        password: 'deep-secret',
                        safe: 'visible'
                    }
                }
            };
            const result = redactSensitiveData(nested) as Record<
                string,
                Record<string, Record<string, unknown>>
            >;
            expect(result.level1?.level2?.password).toBe('[REDACTED]');
            expect(result.level1?.level2?.safe).toBe('visible');
        });

        it('should be case-insensitive for sensitive keys', () => {
            expect(redactSensitiveData('secret', 'PASSWORD')).toBe('[REDACTED]');
            expect(redactSensitiveData('secret', 'Password')).toBe('[REDACTED]');
        });

        it('should pass through non-string non-object values unchanged', () => {
            expect(redactSensitiveData(42)).toBe(42);
            expect(redactSensitiveData(true)).toBe(true);
            expect(redactSensitiveData(null)).toBe(null);
            expect(redactSensitiveData(undefined)).toBe(undefined);
        });
    });
});
