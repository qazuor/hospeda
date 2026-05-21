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
    collectCloudinaryEnv,
    formatFlagSummary,
    parseArgs,
    resolveRepoRoot
} from '../src/commands/db-seed.ts';

const ENV_KEYS_TOUCHED = [
    'HOPS_REPO_ROOT',
    'HOSPEDA_CLOUDINARY_CLOUD_NAME',
    'HOSPEDA_CLOUDINARY_API_KEY',
    'HOSPEDA_CLOUDINARY_API_SECRET'
] as const;

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

        it('--clean-images enables clean-images', () => {
            expect(parseArgs(['--clean-images']).cleanImages).toBe(true);
        });

        it('clean-images is OFF by default', () => {
            expect(parseArgs([]).cleanImages).toBe(false);
        });

        it('build is ON by default', () => {
            expect(parseArgs([]).build).toBe(true);
        });

        it('--no-build disables build', () => {
            expect(parseArgs(['--no-build']).build).toBe(false);
        });

        it('push is ON by default', () => {
            expect(parseArgs([]).push).toBe(true);
        });

        it('--no-push disables push', () => {
            expect(parseArgs(['--no-push']).push).toBe(false);
        });

        it('applyExtras is ON by default', () => {
            expect(parseArgs([]).applyExtras).toBe(true);
        });

        it('--no-apply-extras disables applyExtras', () => {
            expect(parseArgs(['--no-apply-extras']).applyExtras).toBe(false);
        });

        it('combines multiple flags', () => {
            const parsed = parseArgs([
                '--no-reset',
                '--no-example',
                '--clean-images',
                '--no-build',
                '--no-push',
                '--no-apply-extras'
            ]);
            expect(parsed.reset).toBe(false);
            expect(parsed.required).toBe(true);
            expect(parsed.example).toBe(false);
            expect(parsed.cleanImages).toBe(true);
            expect(parsed.build).toBe(false);
            expect(parsed.push).toBe(false);
            expect(parsed.applyExtras).toBe(false);
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
            cleanImages: true,
            build: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual([
            '--filter',
            '@repo/seed',
            'seed',
            '--reset',
            '--required',
            '--example'
        ]);
    });

    it('drops --reset when reset is false', () => {
        const args = buildSeedArgs({
            reset: false,
            required: true,
            example: true,
            cleanImages: true,
            build: true,
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
            cleanImages: true,
            build: true,
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
            cleanImages: true,
            build: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed', '--reset', '--required']);
    });

    it('cleanImages does NOT appear in the pnpm args (it is forwarded via env vars instead)', () => {
        const args = buildSeedArgs({
            reset: true,
            required: true,
            example: true,
            cleanImages: false,
            build: true,
            pull: 'ask',
            skipConfirm: false
        });
        // Same output regardless of cleanImages — the seed's own --reset
        // implies --clean-images internally; hops only controls whether
        // the Cloudinary creds are forwarded to make the cleanup do
        // anything remote.
        expect(args).toEqual([
            '--filter',
            '@repo/seed',
            'seed',
            '--reset',
            '--required',
            '--example'
        ]);
    });

    it('required-only run (--no-reset --no-example)', () => {
        const args = buildSeedArgs({
            reset: false,
            required: true,
            example: false,
            cleanImages: true,
            build: true,
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
            cleanImages: false,
            build: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(args).toEqual(['--filter', '@repo/seed', 'seed']);
    });
});

describe('formatFlagSummary(parsed)', () => {
    it('renders the full default as "+reset +required +example +clean-images +build +push +apply-extras"', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: true,
                cleanImages: true,
                build: true,
                push: true,
                applyExtras: true,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +example +clean-images +build +push +apply-extras');
    });

    it('mixes on / off when some flags are disabled', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: false,
                cleanImages: true,
                build: true,
                push: true,
                applyExtras: true,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +clean-images +build +push +apply-extras -example');
    });

    it('renders all-off as "-reset -required -example -clean-images -build -push -apply-extras"', () => {
        expect(
            formatFlagSummary({
                reset: false,
                required: false,
                example: false,
                cleanImages: false,
                build: false,
                push: false,
                applyExtras: false,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('-reset -required -example -clean-images -build -push -apply-extras');
    });

    it('renders all-on as a single "+..." chunk (no leading "-" segment)', () => {
        const summary = formatFlagSummary({
            reset: true,
            required: true,
            example: true,
            cleanImages: true,
            build: true,
            push: true,
            applyExtras: true,
            pull: 'ask',
            skipConfirm: false
        });
        expect(summary.startsWith('+')).toBe(true);
        // The hyphens in "clean-images" and "apply-extras" are fine; what
        // we are ruling out is a `-foo` off-segment, which is always
        // preceded by a space (or start-of-string when on-list is empty).
        expect(/ -[a-z]+( |$)/.test(summary)).toBe(false);
    });

    it('shows -clean-images on its own when only that flag is off', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: true,
                cleanImages: false,
                build: true,
                push: true,
                applyExtras: true,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +example +build +push +apply-extras -clean-images');
    });

    it('shows -build when --no-build is passed', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: true,
                cleanImages: true,
                build: false,
                push: true,
                applyExtras: true,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +example +clean-images +push +apply-extras -build');
    });

    it('shows -push when --no-push is passed', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: true,
                cleanImages: true,
                build: true,
                push: false,
                applyExtras: true,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +example +clean-images +build +apply-extras -push');
    });

    it('shows -apply-extras when --no-apply-extras is passed', () => {
        expect(
            formatFlagSummary({
                reset: true,
                required: true,
                example: true,
                cleanImages: true,
                build: true,
                push: true,
                applyExtras: false,
                pull: 'ask',
                skipConfirm: false
            })
        ).toBe('+reset +required +example +clean-images +build +push -apply-extras');
    });
});

describe('collectCloudinaryEnv(cleanImages)', () => {
    it('returns an empty object when cleanImages is false', () => {
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = 'cloud';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = 'key';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = 'secret';
        expect(collectCloudinaryEnv(false)).toEqual({});
    });

    it('forwards all three vars when set and cleanImages is true', () => {
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = 'cloud';
        process.env.HOSPEDA_CLOUDINARY_API_KEY = 'key';
        process.env.HOSPEDA_CLOUDINARY_API_SECRET = 'secret';
        expect(collectCloudinaryEnv(true)).toEqual({
            HOSPEDA_CLOUDINARY_CLOUD_NAME: 'cloud',
            HOSPEDA_CLOUDINARY_API_KEY: 'key',
            HOSPEDA_CLOUDINARY_API_SECRET: 'secret'
        });
    });

    it('forwards only what is set (partial credentials)', () => {
        process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME = 'cloud';
        // _API_KEY and _API_SECRET deliberately not set
        const env = collectCloudinaryEnv(true);
        expect(env).toEqual({ HOSPEDA_CLOUDINARY_CLOUD_NAME: 'cloud' });
    });

    it('returns an empty object when cleanImages is true but no creds are set', () => {
        expect(collectCloudinaryEnv(true)).toEqual({});
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
