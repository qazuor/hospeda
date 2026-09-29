/**
 * HOS-735 — a `--continueOnError` run whose required steps failed must still
 * end non-zero, but only AFTER the remaining groups had their chance to run.
 */
import { describe, expect, it, vi } from 'vitest';
import { runSeed } from '../src/index.js';
import { RequiredSeedStepsFailedError } from '../src/required/runSteps.js';

const { runRequiredSeeds, runExampleSeeds } = vi.hoisted(() => ({
    runRequiredSeeds: vi.fn(),
    runExampleSeeds: vi.fn()
}));

vi.mock('../src/required/index.js', () => ({ runRequiredSeeds }));
vi.mock('../src/example/index.js', () => ({ runExampleSeeds }));
vi.mock('../src/utils/db.js', () => ({ initSeedDb: vi.fn(), closeSeedDb: vi.fn() }));
vi.mock('../src/utils/validateAllManifests.js', () => ({ validateAllManifests: vi.fn() }));
vi.mock('../src/utils/superAdminLoader.js', () => ({
    loadSuperAdminAndGetActor: vi.fn(async () => ({ id: 'a', roles: [], permissions: [] }))
}));

describe('runSeed with failed required steps (HOS-735)', () => {
    it('runs the later groups, then rejects with RequiredSeedStepsFailedError', async () => {
        // Arrange
        runRequiredSeeds.mockResolvedValue({
            failedSteps: [{ name: 'Users', error: new Error('boom') }]
        });

        // Act
        const result = runSeed({ required: true, example: true, continueOnError: true });

        // Assert
        await expect(result).rejects.toBeInstanceOf(RequiredSeedStepsFailedError);
        expect(runExampleSeeds).toHaveBeenCalledTimes(1);
    });

    it('resolves when no required step failed', async () => {
        // Arrange
        runRequiredSeeds.mockResolvedValue({ failedSteps: [] });

        // Act + Assert
        await expect(runSeed({ required: true })).resolves.toBeUndefined();
    });
});
