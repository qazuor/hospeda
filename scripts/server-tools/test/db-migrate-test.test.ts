/**
 * Unit tests for `src/commands/db-migrate-test.ts`.
 *
 * Covers pure helper functions: arg parsing, scratch DB name generation,
 * and repo root resolution. Docker, pg_dump, pg_restore, and the migrate
 * sequence involve live containers and are not unit-tested here.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
    type ParsedMigrateTestArgs,
    buildScratchDbName,
    parseMigrateTestArgs,
    resolveRepoRoot
} from '../src/commands/db-migrate-test.ts';

const ENV_KEYS_TOUCHED = ['HOPS_REPO_ROOT'] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS_TOUCHED) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of ENV_KEYS_TOUCHED) {
        if (originalEnv[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = originalEnv[key];
        }
    }
});

/**
 * Helper: assert the result is ok and return the parsed args.
 */
function assertOk(result: ReturnType<typeof parseMigrateTestArgs>): ParsedMigrateTestArgs {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    return result.args;
}

describe('parseMigrateTestArgs(argv)', () => {
    describe('defaults', () => {
        it('keep is false by default', () => {
            expect(assertOk(parseMigrateTestArgs([])).keep).toBe(false);
        });

        it('build is true by default', () => {
            expect(assertOk(parseMigrateTestArgs([])).build).toBe(true);
        });

        it('pull is "ask" by default', () => {
            expect(assertOk(parseMigrateTestArgs([])).pull).toBe('ask');
        });

        it('skipConfirm is false by default', () => {
            expect(assertOk(parseMigrateTestArgs([])).skipConfirm).toBe(false);
        });
    });

    describe('--keep', () => {
        it('sets keep to true', () => {
            expect(assertOk(parseMigrateTestArgs(['--keep'])).keep).toBe(true);
        });
    });

    describe('--no-build', () => {
        it('disables build', () => {
            expect(assertOk(parseMigrateTestArgs(['--no-build'])).build).toBe(false);
        });
    });

    describe('--yes', () => {
        it('sets skipConfirm to true', () => {
            expect(assertOk(parseMigrateTestArgs(['--yes'])).skipConfirm).toBe(true);
        });
    });

    describe('pull resolution', () => {
        it('--pull sets pull to "on"', () => {
            expect(assertOk(parseMigrateTestArgs(['--pull'])).pull).toBe('on');
        });

        it('--no-pull sets pull to "off"', () => {
            expect(assertOk(parseMigrateTestArgs(['--no-pull'])).pull).toBe('off');
        });

        it('--pull and --no-pull together return a mutually-exclusive error result', () => {
            const result = parseMigrateTestArgs(['--pull', '--no-pull']);
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('expected error result');
            expect(result.error.kind).toBe('mutually-exclusive');
            expect(result.error.message).toContain('--pull');
            expect(result.error.message).toContain('--no-pull');
        });
    });

    describe('combined flags', () => {
        it('parses --keep --no-build --no-pull together', () => {
            const parsed = assertOk(parseMigrateTestArgs(['--keep', '--no-build', '--no-pull']));
            expect(parsed.keep).toBe(true);
            expect(parsed.build).toBe(false);
            expect(parsed.pull).toBe('off');
        });

        it('flag order does not matter', () => {
            const a = assertOk(parseMigrateTestArgs(['--no-pull', '--keep', '--no-build']));
            const b = assertOk(parseMigrateTestArgs(['--keep', '--no-build', '--no-pull']));
            expect(a).toEqual(b);
        });
    });
});

describe('buildScratchDbName(now)', () => {
    it('returns a string starting with "hospeda_migrate_test_"', () => {
        const name = buildScratchDbName(new Date('2026-06-06T14:05:30Z'));
        expect(name.startsWith('hospeda_migrate_test_')).toBe(true);
    });

    it('encodes date and time as yyyymmdd_hhmmss', () => {
        const name = buildScratchDbName(new Date('2026-06-06T14:05:30Z'));
        expect(name).toBe('hospeda_migrate_test_20260606_140530');
    });

    it('zero-pads month, day, hour, minute, and second', () => {
        const name = buildScratchDbName(new Date('2026-01-02T03:04:05Z'));
        expect(name).toBe('hospeda_migrate_test_20260102_030405');
    });

    it('uses the full year', () => {
        const name = buildScratchDbName(new Date('2030-12-31T23:59:59Z'));
        expect(name).toBe('hospeda_migrate_test_20301231_235959');
    });

    it('produces only lowercase safe characters (valid Postgres identifier)', () => {
        const name = buildScratchDbName(new Date('2026-06-06T14:05:30Z'));
        // Postgres unquoted identifiers: letters, digits, underscore.
        expect(/^[a-z0-9_]+$/.test(name)).toBe(true);
    });

    it('produces different names for different seconds', () => {
        const a = buildScratchDbName(new Date('2026-06-06T14:05:30Z'));
        const b = buildScratchDbName(new Date('2026-06-06T14:05:31Z'));
        expect(a).not.toBe(b);
    });

    it('defaults to current time when no argument is supplied (just verifies format)', () => {
        const name = buildScratchDbName();
        expect(/^hospeda_migrate_test_\d{8}_\d{6}$/.test(name)).toBe(true);
    });
});

describe('resolveRepoRoot()', () => {
    it('defaults to ~/hospeda when HOPS_REPO_ROOT is unset', () => {
        expect(resolveRepoRoot()).toBe(join(homedir(), 'hospeda'));
    });

    it('honours HOPS_REPO_ROOT when set', () => {
        process.env.HOPS_REPO_ROOT = '/opt/hospeda-staging';
        expect(resolveRepoRoot()).toBe('/opt/hospeda-staging');
    });

    it('treats empty HOPS_REPO_ROOT as unset', () => {
        process.env.HOPS_REPO_ROOT = '';
        expect(resolveRepoRoot()).toBe(join(homedir(), 'hospeda'));
    });
});
