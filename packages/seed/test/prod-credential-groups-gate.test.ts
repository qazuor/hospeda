import { describe, expect, it } from 'vitest';
import {
    assertCredentialGroupsAllowed,
    evaluateProdCredentialGroupsGate
} from '../src/utils/prodCredentialGroupsGate.js';

/**
 * HOS-564 regression tests: `--example` / `--test-users` create accounts with
 * the repo-committed password and must abort by code in production.
 */
describe('HOS-564: evaluateProdCredentialGroupsGate', () => {
    it('refuses --example in production', () => {
        const result = evaluateProdCredentialGroupsGate({
            env: { NODE_ENV: 'production' },
            example: true
        });
        expect(result.allowed).toBe(false);
        expect(result.refusedGroups).toEqual(['--example']);
        expect(result.reason).toContain('--example');
    });

    it('refuses --test-users in production', () => {
        const result = evaluateProdCredentialGroupsGate({
            env: { NODE_ENV: 'production' },
            testUsers: true
        });
        expect(result.allowed).toBe(false);
        expect(result.refusedGroups).toEqual(['--test-users']);
    });

    it('is not overridable by the existing prod opt-in env vars', () => {
        const result = evaluateProdCredentialGroupsGate({
            env: {
                NODE_ENV: 'production',
                HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION: 'true',
                HOSPEDA_ALLOW_PROD_CLEANUP: 'true'
            } as never,
            example: true
        });
        expect(result.allowed).toBe(false);
    });

    it('allows --example outside production', () => {
        for (const NODE_ENV of ['development', 'test', undefined]) {
            expect(
                evaluateProdCredentialGroupsGate({ env: { NODE_ENV }, example: true }).allowed
            ).toBe(true);
        }
    });

    it('allows a production run that requests neither credential group', () => {
        expect(evaluateProdCredentialGroupsGate({ env: { NODE_ENV: 'production' } }).allowed).toBe(
            true
        );
    });

    it('assertCredentialGroupsAllowed throws in production and is silent otherwise', () => {
        expect(() =>
            assertCredentialGroupsAllowed({ env: { NODE_ENV: 'production' }, example: true })
        ).toThrow(/Refusing to run --example in production/);
        expect(() =>
            assertCredentialGroupsAllowed({ env: { NODE_ENV: 'development' }, example: true })
        ).not.toThrow();
    });
});
