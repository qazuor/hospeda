/**
 * Unit tests for `src/lib/env.ts` — the accessor surface used by every
 * `hops` command (`get`, `required`, `envFilePath`).
 *
 * SPEC-103 T-040 (dotenv parser tests). The bespoke parser was
 * replaced with the `dotenv` package in T-053 so the parsing edge
 * cases (inline comments, quoted values, continuation lines) are no
 * longer our responsibility — `dotenv`'s own test suite covers them.
 * These tests focus on the wrapper accessors and the behavioural
 * contract we expose to callers:
 *
 * - `get(key)` returns a non-empty string from process.env, or
 *   undefined.
 * - `required(key)` throws a helpful error pointing at .env.local
 *   when the key is missing.
 * - `envFilePath` is a non-empty absolute path used by tools that
 *   want to mention the config file in error messages.
 *
 * The internal `loadOnce()` runs once per process (module-level
 * boolean guard). We don't try to test the file-loading itself here
 * because the dotenv package owns that behaviour; reproducing it
 * would just re-implement dotenv. The integration of the loader runs
 * automatically when this test file imports env.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { envFilePath, get, required } from '../src/lib/env.ts';

const TEST_KEY = 'HOPS_TEST_ENV_KEY_DO_NOT_USE_IN_PROD';
let originalValue: string | undefined;

beforeEach(() => {
    originalValue = process.env[TEST_KEY];
    delete process.env[TEST_KEY];
});

afterEach(() => {
    if (originalValue === undefined) {
        delete process.env[TEST_KEY];
    } else {
        process.env[TEST_KEY] = originalValue;
    }
});

describe('get(key)', () => {
    it('returns the value when process.env has a non-empty string', () => {
        process.env[TEST_KEY] = 'hello-world';
        expect(get(TEST_KEY)).toBe('hello-world');
    });

    it('returns undefined when the key is not set', () => {
        expect(get(TEST_KEY)).toBeUndefined();
    });

    it('returns undefined when the value is an empty string', () => {
        process.env[TEST_KEY] = '';
        expect(get(TEST_KEY)).toBeUndefined();
    });

    it('returns the value verbatim including leading/trailing whitespace', () => {
        // The dotenv parser trims values per its own contract; once the
        // value is in process.env we expose it verbatim. Tests that need
        // trimmed values should rely on the parser, not this accessor.
        process.env[TEST_KEY] = '  spaced  ';
        expect(get(TEST_KEY)).toBe('  spaced  ');
    });

    it('handles unicode characters', () => {
        process.env[TEST_KEY] = 'español 🇦🇷';
        expect(get(TEST_KEY)).toBe('español 🇦🇷');
    });
});

describe('required(key)', () => {
    it('returns the value when set', () => {
        process.env[TEST_KEY] = 'present';
        expect(required(TEST_KEY)).toBe('present');
    });

    it('throws when the key is missing', () => {
        expect(() => required(TEST_KEY)).toThrow(new RegExp(`${TEST_KEY} is not set`));
    });

    it('error message points at the toolkit config file', () => {
        try {
            required(TEST_KEY);
            throw new Error('required() should have thrown');
        } catch (err) {
            const message = (err as Error).message;
            expect(message).toContain('scripts/server-tools/.env.local');
            expect(message).toContain('.env.local.example');
        }
    });

    it('throws when the key is an empty string (same as missing)', () => {
        process.env[TEST_KEY] = '';
        expect(() => required(TEST_KEY)).toThrow(new RegExp(`${TEST_KEY} is not set`));
    });
});

describe('envFilePath', () => {
    it('is a non-empty string', () => {
        expect(typeof envFilePath).toBe('string');
        expect(envFilePath.length).toBeGreaterThan(0);
    });

    it('points at a .env.local path (any of the resolved candidates)', () => {
        expect(envFilePath.endsWith('.env.local')).toBe(true);
    });
});
