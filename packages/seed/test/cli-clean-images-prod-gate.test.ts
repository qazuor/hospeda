import { describe, expect, it } from 'vitest';
import { evaluateProdCleanupGate } from '../src/cli.js';

/**
 * GAP-078-117 + GAP-078-234 regression tests for the production safety gate
 * that protects destructive seed cleanup operations such as
 * `pnpm seed --clean-images`.
 *
 * The gate is exposed as the pure helper {@link evaluateProdCleanupGate} so
 * it can be exercised directly without spawning the CLI subprocess.
 */
describe('GAP-078-117/234: evaluateProdCleanupGate', () => {
    it('allows the operation in non-production environments', () => {
        const result = evaluateProdCleanupGate({ NODE_ENV: 'development' });
        expect(result.allowed).toBe(true);
    });

    it('allows the operation in test environments', () => {
        const result = evaluateProdCleanupGate({ NODE_ENV: 'test' });
        expect(result.allowed).toBe(true);
    });

    it('refuses the operation in production without the override flag', () => {
        const result = evaluateProdCleanupGate({ NODE_ENV: 'production' });
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/HOSPEDA_ALLOW_PROD_CLEANUP/);
    });

    it('refuses the operation when override flag is set to a non-true value', () => {
        for (const value of ['1', 'yes', 'TRUE', 'on', '']) {
            const result = evaluateProdCleanupGate({
                NODE_ENV: 'production',
                HOSPEDA_ALLOW_PROD_CLEANUP: value
            });
            expect(
                result.allowed,
                `expected gate to refuse for HOSPEDA_ALLOW_PROD_CLEANUP="${value}"`
            ).toBe(false);
        }
    });

    it('allows the operation in production when HOSPEDA_ALLOW_PROD_CLEANUP=true', () => {
        const result = evaluateProdCleanupGate({
            NODE_ENV: 'production',
            HOSPEDA_ALLOW_PROD_CLEANUP: 'true'
        });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
    });
});
