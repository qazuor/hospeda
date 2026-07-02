/**
 * Unit tests for `src/commands/db-seed-test-users.ts` — pure argv parsing
 * and seed-args composition.
 *
 * The side-effecting bits (git pull, pnpm seed, the --target=prod guard)
 * are not covered here — they shell out to the runner / call die() and
 * would need integration tests with mocked processes. This file focuses on
 * the pure helpers that decide what to do before any side effects run.
 */

import { describe, expect, it } from 'bun:test';
import { buildSeedArgs, parseArgs } from '../src/commands/db-seed-test-users.ts';

describe('parseArgs(argv)', () => {
    describe('defaults (no flags)', () => {
        it('build is OFF by default', () => {
            expect(parseArgs([]).build).toBe(false);
        });

        it('leaves pull as "ask" when neither --pull nor --no-pull is given', () => {
            expect(parseArgs([]).pull).toBe('ask');
        });

        it('does not skip confirm by default', () => {
            expect(parseArgs([]).skipConfirm).toBe(false);
        });
    });

    describe('feature toggles', () => {
        it('--build enables build', () => {
            expect(parseArgs(['--build']).build).toBe(true);
        });

        it('--pull sets pull to "on"', () => {
            expect(parseArgs(['--pull']).pull).toBe('on');
        });

        it('--no-pull sets pull to "off"', () => {
            expect(parseArgs(['--no-pull']).pull).toBe('off');
        });

        it('--yes sets skipConfirm to true', () => {
            expect(parseArgs(['--yes']).skipConfirm).toBe(true);
        });

        it('combines multiple flags', () => {
            const parsed = parseArgs(['--build', '--no-pull', '--yes']);
            expect(parsed).toEqual({ build: true, pull: 'off', skipConfirm: true });
        });
    });

    describe('flag order is irrelevant', () => {
        it('parses flags identically regardless of order', () => {
            const a = parseArgs(['--build', '--pull', '--yes']);
            const b = parseArgs(['--yes', '--pull', '--build']);
            expect(a).toEqual(b);
        });
    });
});

describe('buildSeedArgs()', () => {
    it('is always --filter @repo/seed seed --test-users (no reset flag exists)', () => {
        expect(buildSeedArgs()).toEqual(['--filter', '@repo/seed', 'seed', '--test-users']);
    });
});
