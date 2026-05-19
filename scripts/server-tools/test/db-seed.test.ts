/**
 * Unit tests for `src/commands/db-seed.ts` — pure argv parsing,
 * seed-args composition, flag summary, and repo-root resolution.
 *
 * The destructive bits (git pull, pnpm seed) are not covered here — they
 * shell out to the runner and would need integration tests with mocked
 * processes. This file focuses on the pure helpers that decide what to
 * do before any side effects run.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
    buildSeedArgs,
    formatFlagSummary,
    parseArgs,
    resolveRepoRoot
} from '../src/commands/db-seed.ts';

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

describe('parseArgs(argv)', () => {
    describe('defaults (no flags)', () => {
        it('enables reset, required, and example by default', () => {
            const parsed = parseArgs([]);
            expect(parsed.reset).toBe(true);
            expect(parsed.required).toBe(true);
            expect(parsed.example).toBe(true);
        });

        it('leaves pull as "ask" when neither --pull nor --no-pull is given', () => {
            expect(parseArgs([]).pull).toBe('ask');
        });

        it('does not skip confirm by default', () => {
            expect(parseArgs([]).skipConfirm).toBe(false);
        });
    });

    describe('feature toggles', () => {
        it('--no-reset disables reset', () => {
            expect(parseArgs(['--no-reset']).reset).toBe(false);
        });

        it('--no-required disables required', () => {
            expect(parseArgs(['--no-required']).required).toBe(false);
        });

        it('--no-example disables example', () => {
            expect(parseArgs(['--no-example']).example).toBe(false);
        });

        it('combines multiple --no-* flags', () => {
            const parsed = parseArgs(['--no-reset', '--no-example']);
            expect(parsed.reset).toBe(false);
            expect(parsed.required).toBe(true);
            expect(parsed.example).toBe(false);
        });
    });

    describe('pull resolution', () => {
        it('--pull sets pull to "on"', () => {
            expect(parseArgs(['--pull']).pull).toBe('on');
        });

        it('--no-pull sets pull to "off"', () => {
            expect(parseArgs(['--no-pull']).pull).toBe('off');
        });
    });

    describe('--yes', () => {
        it('sets skipConfirm to true', () => {
            expect(parseArgs(['--yes']).skipConfirm).toBe(true);
        });

        it('does not affect pull resolution', () => {
            expect(parseArgs(['--yes']).pull).toBe('ask');
        });
    });

    describe('flag order is irrelevant', () => {
        it('parses flags identically regardless of order', () => {
            const a = parseArgs(['--no-reset', '--pull', '--yes']);
            const b = parseArgs(['--yes', '--pull', '--no-reset']);
            expect(a).toEqual(b);
        });
    });
});

describe('buildSeedArgs(parsed)', () => {
    it('full default: --filter @repo/seed seed --reset --required --example', () => {
        const args = buildSeedArgs({
            reset: true,
            required: true,
            example: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed', '--reset', '--required', '--example']);
    });

    it('drops --reset when reset is false', () => {
        const args = buildSeedArgs({
            reset: false,
            required: true,
            example: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed', '--required', '--example']);
    });

    it('drops --required when required is false', () => {
        const args = buildSeedArgs({
            reset: true,
            required: false,
            example: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed', '--reset', '--example']);
    });

    it('drops --example when example is false', () => {
        const args = buildSeedArgs({
            reset: true,
            required: true,
            example: false,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed', '--reset', '--required']);
    });

    it('required-only run (--no-reset --no-example)', () => {
        const args = buildSeedArgs({
            reset: false,
            required: true,
            example: false,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed', '--required']);
    });

    it('keeps the --filter @repo/seed prefix even when nothing else is enabled', () => {
        // The dbSeed entry point rejects the all-off case before this
        // runs, but the helper itself must not silently drop the prefix.
        const args = buildSeedArgs({
            reset: false,
            required: false,
            example: false,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed']);
    });
});

describe('formatFlagSummary(parsed)', () => {
    it('renders the full default as "+reset +required +example"', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: true,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +example');
    });

    it('mixes on / off when some flags are disabled', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: false,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required -example');
    });

    it('renders all-off as "-reset -required -example"', () => {
        expect(
            formatFlagSummary({
                reset: false,
                required: false,
                example: false,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('-reset -required -example');
    });

    it('renders all-on as a single "+..." chunk', () => {
        const summary = formatFlagSummary({
            reset: true,
            required: true,
            example: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(summary.startsWith('+')).toBe(true);
        expect(summary.includes('-')).toBe(false);
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

    it('treats an empty HOPS_REPO_ROOT as unset', () => {
        process.env.HOPS_REPO_ROOT = '';
        expect(resolveRepoRoot()).toBe(join(homedir(), 'hospeda'));
    });
});
