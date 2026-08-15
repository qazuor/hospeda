/**
 * HOS-510 regression: the seed CLI must REJECT unknown flags instead of
 * silently dropping them.
 *
 * The bug this covers is not a parsing nicety. `pnpm db:seed:migrate --status`
 * expands to `tsx ./src/cli.ts --data-migrate --status`; `--status` is not a
 * flag the CLI knows (the real one is `--data-migrate-status`), and every flag
 * was parsed with `args.includes('--x')`, which cannot distinguish "absent"
 * from "unrecognized". The unknown token was dropped without a word and
 * `--data-migrate` survived alone, so a command typed to LOOK at the ledger
 * applied every pending data-migration instead. Measured on a dev database
 * before the fix: `seed_migrations` went from 44 rows to 54, exit code 0.
 *
 * These are the unit-level assertions on the pure validator. The end-to-end
 * proof that the wiring holds — the real CLI, spawned as a subprocess, leaving
 * the ledger untouched — lives in
 * `test/integration/cli-unknown-flag.integration.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
    formatUnknownFlagsError,
    SEED_CLI_BOOLEAN_FLAGS,
    SEED_CLI_VALUE_FLAGS,
    validateSeedCliFlags
} from '../src/cli-flags.js';

describe('validateSeedCliFlags', () => {
    describe('the HOS-510 regression', () => {
        it('rejects --status, the flag that made a read command write', () => {
            // Arrange: exactly what `pnpm db:seed:migrate --status` hands the CLI.
            const args = ['--data-migrate', '--status'];

            // Act
            const { unknown } = validateSeedCliFlags({ args });

            // Assert
            expect(unknown.map((entry) => entry.flag)).toEqual(['--status']);
        });

        it('points --status at the command that actually reports status', () => {
            const { unknown } = validateSeedCliFlags({ args: ['--data-migrate', '--status'] });

            expect(unknown[0]?.hint).toContain('--data-migrate-status');
            expect(unknown[0]?.hint).toContain('db:seed:migrate:status');
        });

        it('renders an error naming the flag, its hint and the usage escape', () => {
            const { unknown } = validateSeedCliFlags({ args: ['--data-migrate', '--status'] });

            const message = formatUnknownFlagsError({ unknown });

            expect(message).toContain('--status');
            expect(message).toContain('--data-migrate-status');
            expect(message).toContain('--help');
            // The whole point: refusing, not proceeding.
            expect(message.toLowerCase()).toContain('refusing');
        });
    });

    describe('accepts every flag the CLI actually implements', () => {
        it.each([...SEED_CLI_BOOLEAN_FLAGS])('accepts the boolean flag %s', (flag) => {
            const { unknown } = validateSeedCliFlags({ args: [flag] });

            expect(unknown).toEqual([]);
        });

        it.each([...SEED_CLI_VALUE_FLAGS])('accepts the value flag %s with a value', (flag) => {
            const { unknown } = validateSeedCliFlags({ args: [`${flag}=required`] });

            expect(unknown).toEqual([]);
        });

        it('accepts the real db:seed invocation', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--reset', '--required', '--example', '--poi-catalog']
            });

            expect(unknown).toEqual([]);
        });

        it('accepts the real db:fresh-dev invocation', () => {
            const { unknown } = validateSeedCliFlags({
                args: [
                    '--reset',
                    '--required',
                    '--example',
                    '--poi-catalog',
                    '--allow-required-fallback'
                ]
            });

            expect(unknown).toEqual([]);
        });

        it('accepts the real db:fresh baseline-stamp invocation', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--data-migrate', '--baseline-stamp']
            });

            expect(unknown).toEqual([]);
        });

        it('accepts --exclude with a comma-separated list', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--required', '--exclude=users,roles']
            });

            expect(unknown).toEqual([]);
        });
    });

    describe('the --data-migrate-make positional', () => {
        it('accepts the bare slug that follows --data-migrate-make', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--data-migrate-make', 'remove-legacy-feature', '--group=example']
            });

            expect(unknown).toEqual([]);
        });

        it('still rejects a stray positional that follows anything else', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--data-migrate', 'remove-legacy-feature']
            });

            expect(unknown.map((entry) => entry.flag)).toEqual(['remove-legacy-feature']);
        });

        it('rejects a second positional after the slug', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--data-migrate-make', 'my-slug', 'extra']
            });

            expect(unknown.map((entry) => entry.flag)).toEqual(['extra']);
        });
    });

    describe('near-miss flags get a hint instead of a bare refusal', () => {
        it.each([
            ['--dry-run', '--data-migrate-status'],
            ['--make', '--data-migrate-make'],
            ['--baseline', '--baseline-stamp'],
            ['-h', '--help']
        ])('hints %s towards %s', (flag, expected) => {
            const { unknown } = validateSeedCliFlags({ args: [flag] });

            expect(unknown).toHaveLength(1);
            expect(unknown[0]?.hint).toContain(expected);
        });

        it('explains that --migrate was removed rather than renamed', () => {
            // It was parsed but never read by runSeed — a flag that silently did
            // nothing. Removing it turns that silence into an error.
            const { unknown } = validateSeedCliFlags({ args: ['--migrate'] });

            expect(unknown).toHaveLength(1);
            expect(unknown[0]?.hint).toContain('db:migrate');
        });

        it('explains that --count never existed', () => {
            const { unknown } = validateSeedCliFlags({ args: ['--example', '--count=100'] });

            expect(unknown.map((entry) => entry.flag)).toEqual(['--count=100']);
            expect(unknown[0]?.hint).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('reports every unknown flag, not just the first', () => {
            const { unknown } = validateSeedCliFlags({
                args: ['--status', '--reset', '--nope']
            });

            expect(unknown.map((entry) => entry.flag)).toEqual(['--status', '--nope']);
        });

        it('accepts an empty argument list', () => {
            const { unknown } = validateSeedCliFlags({ args: [] });

            expect(unknown).toEqual([]);
        });

        it('ignores a bare -- separator, which pnpm may forward', () => {
            const { unknown } = validateSeedCliFlags({ args: ['--', '--data-migrate'] });

            expect(unknown).toEqual([]);
        });

        it('rejects a known boolean flag given a value', () => {
            // `--reset=true` is not the same token as `--reset`; accepting it
            // would re-open the "looks handled, is not" hole this closes.
            const { unknown } = validateSeedCliFlags({ args: ['--reset=true'] });

            expect(unknown.map((entry) => entry.flag)).toEqual(['--reset=true']);
        });

        it('rejects a known value flag given no value', () => {
            const { unknown } = validateSeedCliFlags({ args: ['--group'] });

            expect(unknown.map((entry) => entry.flag)).toEqual(['--group']);
        });
    });

    describe('the flag registry matches what the CLI parses', () => {
        it('lists no duplicates', () => {
            const all = [...SEED_CLI_BOOLEAN_FLAGS, ...SEED_CLI_VALUE_FLAGS];

            expect(new Set(all).size).toBe(all.length);
        });

        it('declares every flag with a leading --', () => {
            for (const flag of [...SEED_CLI_BOOLEAN_FLAGS, ...SEED_CLI_VALUE_FLAGS]) {
                expect(flag.startsWith('--')).toBe(true);
            }
        });
    });
});

describe('formatUnknownFlagsError', () => {
    it('lists every unknown flag on its own line', () => {
        const { unknown } = validateSeedCliFlags({ args: ['--status', '--nope'] });

        const message = formatUnknownFlagsError({ unknown });

        expect(message).toContain('--status');
        expect(message).toContain('--nope');
    });

    it('omits the hint line for a flag with no near-miss suggestion', () => {
        const { unknown } = validateSeedCliFlags({ args: ['--zzz-nonsense'] });

        const message = formatUnknownFlagsError({ unknown });

        expect(message).toContain('--zzz-nonsense');
        expect(message).not.toContain('did you mean');
    });
});
