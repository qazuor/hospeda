/**
 * Unit tests for `src/commands/billing-test-reset.ts`.
 *
 * Covers pure helper functions only: argv parsing (`--execute`, `--yes`,
 * `--delete-user`), dry-run vs execute mode resolution, and the prod
 * `--yes`/`-y` guard. Discovery/count/transaction SQL building
 * (`billing-test-reset-queries.ts`) and the interactive prompt/docker-exec
 * flow are side-effecting and are not covered here — see
 * `billing-test-reset-queries.test.ts` for the pure transaction-builder
 * coverage that IS unit-testable without a live Postgres container.
 */

import { describe, expect, it } from 'bun:test';
import {
    parseBillingTestResetArgs,
    resolveResetMode,
    validateExecuteGuard
} from '../src/commands/billing-test-reset.ts';

describe('parseBillingTestResetArgs(argv)', () => {
    describe('required --email', () => {
        it('returns null when --email is missing', () => {
            expect(parseBillingTestResetArgs([])).toBeNull();
        });

        it('parses --email <value> (two-token form)', () => {
            const parsed = parseBillingTestResetArgs(['--email', 'a@b.com']);
            expect(parsed?.email).toBe('a@b.com');
        });

        it('parses --email=<value> (single-token form)', () => {
            const parsed = parseBillingTestResetArgs(['--email=a@b.com']);
            expect(parsed?.email).toBe('a@b.com');
        });
    });

    describe('defaults (email only)', () => {
        const parsed = parseBillingTestResetArgs(['--email=a@b.com']);

        it('deleteUser is false by default', () => {
            expect(parsed?.deleteUser).toBe(false);
        });

        it('skipConfirm is false by default', () => {
            expect(parsed?.skipConfirm).toBe(false);
        });

        it('execute is false by default (dry run)', () => {
            expect(parsed?.execute).toBe(false);
        });
    });

    describe('--execute', () => {
        it('sets execute to true when present', () => {
            expect(parseBillingTestResetArgs(['--email=a@b.com', '--execute'])?.execute).toBe(true);
        });

        it('leaves execute false when absent', () => {
            expect(parseBillingTestResetArgs(['--email=a@b.com'])?.execute).toBe(false);
        });
    });

    describe('--yes / -y', () => {
        it('--yes sets skipConfirm to true', () => {
            expect(parseBillingTestResetArgs(['--email=a@b.com', '--yes'])?.skipConfirm).toBe(true);
        });

        it('-y sets skipConfirm to true', () => {
            expect(parseBillingTestResetArgs(['--email=a@b.com', '-y'])?.skipConfirm).toBe(true);
        });
    });

    describe('--delete-user', () => {
        it('sets deleteUser to true when present', () => {
            expect(parseBillingTestResetArgs(['--email=a@b.com', '--delete-user'])?.deleteUser).toBe(
                true
            );
        });
    });

    describe('flag order is irrelevant', () => {
        it('parses flags identically regardless of order', () => {
            const a = parseBillingTestResetArgs([
                '--email=a@b.com',
                '--execute',
                '--yes',
                '--delete-user'
            ]);
            const b = parseBillingTestResetArgs([
                '--delete-user',
                '--yes',
                '--execute',
                '--email=a@b.com'
            ]);
            expect(a).toEqual(b);
        });
    });

    describe('combined flags', () => {
        it('parses all flags together', () => {
            const parsed = parseBillingTestResetArgs([
                '--email=a@b.com',
                '--execute',
                '--yes',
                '--delete-user'
            ]);
            expect(parsed).toEqual({
                email: 'a@b.com',
                deleteUser: true,
                skipConfirm: true,
                execute: true
            });
        });
    });
});

describe('resolveResetMode(execute)', () => {
    it("returns 'preview' when execute is false (dry run default)", () => {
        expect(resolveResetMode(false)).toBe('preview');
    });

    it("returns 'execute' when execute is true", () => {
        expect(resolveResetMode(true)).toBe('execute');
    });
});

describe('validateExecuteGuard(input)', () => {
    describe('the only rejected combination: prod + execute + skipConfirm', () => {
        it('rejects --target=prod --execute --yes', () => {
            const result = validateExecuteGuard({ target: 'prod', execute: true, skipConfirm: true });
            expect(result.ok).toBe(false);
            expect(result.message).toContain('prod');
            expect(result.message).toContain('--execute');
        });
    });

    describe('allowed combinations', () => {
        it('allows --target=prod --execute without --yes (typed-email confirm still required downstream)', () => {
            const result = validateExecuteGuard({
                target: 'prod',
                execute: true,
                skipConfirm: false
            });
            expect(result.ok).toBe(true);
            expect(result.message).toBeUndefined();
        });

        it('allows --target=prod dry run (no --execute) even with --yes — preview never confirms', () => {
            const result = validateExecuteGuard({ target: 'prod', execute: false, skipConfirm: true });
            expect(result.ok).toBe(true);
        });

        it('allows --target=staging --execute --yes', () => {
            const result = validateExecuteGuard({
                target: 'staging',
                execute: true,
                skipConfirm: true
            });
            expect(result.ok).toBe(true);
        });

        it('allows --target=staging --execute without --yes', () => {
            const result = validateExecuteGuard({
                target: 'staging',
                execute: true,
                skipConfirm: false
            });
            expect(result.ok).toBe(true);
        });

        it('allows --target=staging dry run', () => {
            const result = validateExecuteGuard({
                target: 'staging',
                execute: false,
                skipConfirm: false
            });
            expect(result.ok).toBe(true);
        });
    });
});
