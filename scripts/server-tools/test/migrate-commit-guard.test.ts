/**
 * Unit tests for the `hops db-migrate` commit-equality guard (HOS-1957 G4).
 *
 * Everything runs against pure functions plus injected fakes: no git, no
 * Docker and no database is touched.
 */

import { describe, expect, it } from 'bun:test';
import { parseMigrateArgs } from '../src/commands/db-migrate.ts';
import {
    checkMigrateCommit,
    type RunMigratePullPhaseInput,
    runMigratePullPhase
} from '../src/lib/migrate-commit-guard.ts';

const FULL_SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const OTHER_SHA = 'ffffffffff60718293a4b5c6d7e8f9012345678a';

describe('parseMigrateArgs --expect-commit', () => {
    it('is undefined when the flag is absent', () => {
        expect(parseMigrateArgs(['--pull']).expectCommit).toBeUndefined();
    });

    it('reads the --expect-commit=<sha> spelling', () => {
        expect(parseMigrateArgs(['--pull', `--expect-commit=${FULL_SHA}`]).expectCommit).toBe(
            FULL_SHA
        );
    });

    it('keeps an empty value as an empty string so the guard can refuse it', () => {
        expect(parseMigrateArgs(['--expect-commit=']).expectCommit).toBe('');
    });
});

describe('checkMigrateCommit', () => {
    it('accepts a full SHA equal to the checkout HEAD', () => {
        expect(checkMigrateCommit({ checkoutSha: FULL_SHA, expectedCommit: FULL_SHA }).ok).toBe(
            true
        );
    });

    it('accepts an abbreviated expected SHA of at least 10 chars, case-insensitively', () => {
        const result = checkMigrateCommit({
            checkoutSha: FULL_SHA,
            expectedCommit: FULL_SHA.slice(0, 10).toUpperCase()
        });
        expect(result.ok).toBe(true);
    });

    it('refuses a mismatch and names both SHAs', () => {
        const result = checkMigrateCommit({ checkoutSha: FULL_SHA, expectedCommit: OTHER_SHA });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain(FULL_SHA);
            expect(result.message).toContain(OTHER_SHA);
        }
    });

    it('refuses an unknown expected commit (fail closed)', () => {
        for (const expectedCommit of [undefined, '', '   ', 'unknown']) {
            const result = checkMigrateCommit({ checkoutSha: FULL_SHA, expectedCommit });
            expect(result.ok).toBe(false);
        }
    });

    it('refuses an expected value that is too short or not hex', () => {
        for (const expectedCommit of ['a1b2c3', 'staging', 'HEAD', 'zzzzzzzzzzzz']) {
            const result = checkMigrateCommit({ checkoutSha: FULL_SHA, expectedCommit });
            expect(result.ok).toBe(false);
        }
    });

    it('refuses an unreadable checkout SHA', () => {
        const result = checkMigrateCommit({ checkoutSha: '', expectedCommit: FULL_SHA });
        expect(result.ok).toBe(false);
    });
});

function buildInput(overrides: Partial<RunMigratePullPhaseInput> & { calls: string[] }) {
    const { calls, ...rest } = overrides;
    const input: RunMigratePullPhaseInput = {
        shouldPull: true,
        install: true,
        expectCommit: FULL_SHA,
        pull: async () => {
            calls.push('pull');
        },
        readCheckoutSha: async () => {
            calls.push('read');
            return FULL_SHA;
        },
        installDeps: async () => {
            calls.push('install');
        },
        ...rest
    };
    return input;
}

describe('runMigratePullPhase', () => {
    it('pulls, verifies, then installs when the checkout matches', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(buildInput({ calls }));
        expect(result.ok).toBe(true);
        expect(calls).toEqual(['pull', 'read', 'install']);
    });

    it('aborts on mismatch before install, so nothing downstream can run', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(buildInput({ calls, expectCommit: OTHER_SHA }));
        expect(result.ok).toBe(false);
        expect(calls).toEqual(['pull', 'read']);
    });

    it('aborts BEFORE pulling when a pull is requested without --expect-commit', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(buildInput({ calls, expectCommit: undefined }));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toContain('--expect-commit');
        expect(calls).toEqual([]);
    });

    it('aborts when the checkout SHA cannot be read', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(
            buildInput({
                calls,
                readCheckoutSha: async () => {
                    throw new Error('git rev-parse HEAD failed');
                }
            })
        );
        expect(result.ok).toBe(false);
        expect(calls).toEqual(['pull']);
    });

    it('skips install with --no-install but still verifies', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(buildInput({ calls, install: false }));
        expect(result.ok).toBe(true);
        expect(calls).toEqual(['pull', 'read']);
    });

    it('without a pull and without --expect-commit does nothing (unchanged behaviour)', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(
            buildInput({ calls, shouldPull: false, expectCommit: undefined })
        );
        expect(result.ok).toBe(true);
        expect(calls).toEqual([]);
    });

    it('without a pull but with --expect-commit still verifies the checkout', async () => {
        const calls: string[] = [];
        const result = await runMigratePullPhase(
            buildInput({ calls, shouldPull: false, expectCommit: OTHER_SHA })
        );
        expect(result.ok).toBe(false);
        expect(calls).toEqual(['read']);
    });
});
