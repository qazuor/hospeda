/**
 * HOS-735 — `runRequiredSteps` gives `continueOnError` the meaning its name
 * promises: each step is isolated, so a failure at step N no longer cancels
 * steps N+1..last. Pure (no DB): steps are stubs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type RequiredSeedStep,
    RequiredSeedStepsFailedError,
    runRequiredSteps
} from '../../src/required/runSteps.js';

vi.mock('../../src/utils/errorHistory.js', () => ({
    errorHistory: { recordError: vi.fn() }
}));
vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: { trackProcessStep: vi.fn() }
}));

/** Builds a step that records its execution into `log`. */
function step(params: { name: string; log: string[]; fail?: Error }): RequiredSeedStep {
    return {
        name: params.name,
        run: async () => {
            params.log.push(params.name);
            if (params.fail) throw params.fail;
        }
    };
}

describe('runRequiredSteps (HOS-735)', () => {
    let log: string[];

    beforeEach(() => {
        log = [];
    });

    it('runs every step in order when nothing fails', async () => {
        // Arrange
        const steps = [step({ name: 'a', log }), step({ name: 'b', log })];

        // Act
        const result = await runRequiredSteps({ steps, continueOnError: false });

        // Assert
        expect(log).toEqual(['a', 'b']);
        expect(result.failedSteps).toEqual([]);
    });

    it('default path: the first failure aborts and rethrows the ORIGINAL error', async () => {
        // Arrange
        const boom = new Error('duplicate key');
        const steps = [
            step({ name: 'a', log }),
            step({ name: 'users', log, fail: boom }),
            step({ name: 'sampleStep', log })
        ];

        // Act + Assert
        await expect(runRequiredSteps({ steps, continueOnError: false })).rejects.toBe(boom);
        expect(log).toEqual(['a', 'users']);
    });

    it('continueOnError: a failing step does NOT cancel the steps after it', async () => {
        // Arrange
        const boom = new Error('duplicate key');
        const steps = [
            step({ name: 'a', log }),
            step({ name: 'users', log, fail: boom }),
            step({ name: 'sampleStep', log }),
            step({ name: 'z', log })
        ];

        // Act
        const result = await runRequiredSteps({ steps, continueOnError: true });

        // Assert
        expect(log).toEqual(['a', 'users', 'sampleStep', 'z']);
        expect(result.failedSteps).toEqual([{ name: 'users', error: boom }]);
    });

    it('continueOnError: reports every failed step, in execution order', async () => {
        // Arrange
        const e1 = new Error('one');
        const e2 = new Error('two');
        const steps = [
            step({ name: 'first', log, fail: e1 }),
            step({ name: 'ok', log }),
            step({ name: 'second', log, fail: e2 })
        ];

        // Act
        const result = await runRequiredSteps({ steps, continueOnError: true });

        // Assert
        expect(result.failedSteps.map((failed) => failed.name)).toEqual(['first', 'second']);
    });

    it('RequiredSeedStepsFailedError names the failed steps', () => {
        // Arrange + Act
        const error = new RequiredSeedStepsFailedError({
            failedSteps: [
                { name: 'Users', error: new Error('x') },
                { name: 'Features', error: new Error('y') }
            ]
        });

        // Assert
        expect(error.message).toBe('2 required seed step(s) failed: Users, Features');
        expect(error.failedSteps).toHaveLength(2);
    });
});
