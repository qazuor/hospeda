/**
 * Unit tests for `resolveStep3DatabaseUrl` (HOS-1745 third correction).
 *
 * The V6 step 3 cutover script used to destructure `env` from the API env module
 * before calling `validateApiEnv()`. Because `env` is an `export let`, that copy
 * kept the `undefined` it had at import time. These tests pin the contract that
 * the module namespace is kept and `env` is read only after validation.
 */
import { describe, expect, it, vi } from 'vitest';
import { resolveStep3DatabaseUrl } from '../../../src/services/cutover-v6/step-3.env.js';

const DATABASE_URL = 'postgresql://fake-host/db';

/** Mutable stand-in for the env module namespace, reproducing `export let env`. */
interface FakeEnvModule {
    validateApiEnv: () => void;
    env: { readonly HOSPEDA_DATABASE_URL: string } | undefined;
}

describe('TEST:1745c:1 resolveStep3DatabaseUrl reads env after validateApiEnv', () => {
    it('returns the database url assigned during validation and validates once', async () => {
        // Arrange
        const validateApiEnv = vi.fn();
        const fakeModule: FakeEnvModule = { validateApiEnv, env: undefined };
        validateApiEnv.mockImplementation(() => {
            fakeModule.env = { HOSPEDA_DATABASE_URL: DATABASE_URL };
        });

        // Act
        const result = await resolveStep3DatabaseUrl({ loadEnvModule: async () => fakeModule });

        // Assert
        expect(result).toEqual({ databaseUrl: DATABASE_URL });
        expect(validateApiEnv).toHaveBeenCalledTimes(1);
    });

    it('propagates a validation error without touching env', async () => {
        // Arrange
        const boom = new Error('env validation failed');
        const fakeModule: FakeEnvModule = {
            validateApiEnv: () => {
                throw boom;
            },
            env: undefined
        };

        // Act
        const promise = resolveStep3DatabaseUrl({ loadEnvModule: async () => fakeModule });

        // Assert
        await expect(promise).rejects.toBe(boom);
        expect(fakeModule.env).toBeUndefined();
    });

    it('throws a named error when validation leaves env unset', async () => {
        // Arrange
        const fakeModule: FakeEnvModule = { validateApiEnv: () => {}, env: undefined };

        // Act
        const promise = resolveStep3DatabaseUrl({ loadEnvModule: async () => fakeModule });

        // Assert
        await expect(promise).rejects.toThrow(
            'HOSPEDA_DATABASE_URL is not set after validateApiEnv()'
        );
    });

    it('witness: reading env before validation is undefined while the function still resolves', async () => {
        // Arrange
        const fakeModule: FakeEnvModule = {
            validateApiEnv: () => {
                fakeModule.env = { HOSPEDA_DATABASE_URL: DATABASE_URL };
            },
            env: undefined
        };
        const readBeforeValidation = fakeModule.env;

        // Act
        const result = await resolveStep3DatabaseUrl({ loadEnvModule: async () => fakeModule });

        // Assert
        expect(readBeforeValidation).toBeUndefined();
        expect(fakeModule.env).toEqual({ HOSPEDA_DATABASE_URL: DATABASE_URL });
        expect(result.databaseUrl).toBe(DATABASE_URL);
    });
});
