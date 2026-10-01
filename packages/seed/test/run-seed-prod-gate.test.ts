import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSeed } from '../src/index.js';

/**
 * HOS-564: the gate must be wired into the `runSeed` entrypoint itself, so a
 * direct `pnpm seed --example` against production aborts by code.
 */
describe('HOS-564: runSeed production gate wiring', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('rejects --example when NODE_ENV=production, before touching the database', async () => {
        // Arrange
        vi.stubEnv('NODE_ENV', 'production');

        // Act + Assert
        await expect(runSeed({ example: true, required: true })).rejects.toThrow(
            /Refusing to run --example in production/
        );
    });

    it('rejects --test-users when NODE_ENV=production', async () => {
        vi.stubEnv('NODE_ENV', 'production');

        await expect(runSeed({ testUsers: true })).rejects.toThrow(/--test-users/);
    });
});
