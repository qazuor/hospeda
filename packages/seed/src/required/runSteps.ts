import { errorHistory } from '../utils/errorHistory.js';
import { describeError } from '../utils/errorSerialization.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * One unit of the required-seed pipeline: a name for reporting plus the work.
 */
export interface RequiredSeedStep {
    /** Human-readable step name, used in the failure summary. */
    readonly name: string;
    /** The seeder call. Rejecting marks the step as failed. */
    readonly run: () => Promise<void>;
}

/** A step that threw, kept so the end-of-run summary can name it. */
export interface FailedRequiredSeedStep {
    /** Name of the step that failed. */
    readonly name: string;
    /** The thrown value, unmodified. */
    readonly error: unknown;
}

/**
 * Raised when a `--continueOnError` run finished every step but at least one
 * of them failed, so the process still exits non-zero (HOS-735).
 */
export class RequiredSeedStepsFailedError extends Error {
    /** The steps that failed, in execution order. */
    public readonly failedSteps: readonly FailedRequiredSeedStep[];

    /**
     * @param params.failedSteps - The steps that failed, in execution order.
     */
    constructor(params: { readonly failedSteps: readonly FailedRequiredSeedStep[] }) {
        super(
            `${params.failedSteps.length} required seed step(s) failed: ${params.failedSteps
                .map((failed) => failed.name)
                .join(', ')}`
        );
        this.name = 'RequiredSeedStepsFailedError';
        this.failedSteps = params.failedSteps;
    }
}

/**
 * Runs the required-seed steps in order, giving `continueOnError` the meaning
 * its name promises (HOS-735).
 *
 * - `continueOnError: false` (default): the first failing step aborts the run
 *   and its ORIGINAL error is re-thrown, exactly as before.
 * - `continueOnError: true`: EACH step is isolated. A failure is recorded and
 *   the next step still runs. Before this, the whole chain shared one
 *   `try/catch`, so a failure at step 5 cancelled the 18 after it (among them
 *   the gastronomy and experience plans) and the flag only suppressed the final re-throw.
 *
 * The caller decides what to do with the returned failures; this function
 * never throws in continue mode.
 *
 * @param params.steps - Ordered steps.
 * @param params.continueOnError - Whether a failing step lets the next one run.
 * @returns The failed steps (always empty when `continueOnError` is false, since a failure throws).
 * @throws {unknown} The failing step's own error when `continueOnError` is false.
 *
 * @example
 * ```ts
 * const { failedSteps } = await runRequiredSteps({
 *     steps: [{ name: 'Users', run: () => seedUsers(context) }],
 *     continueOnError: true
 * });
 * ```
 */
export async function runRequiredSteps(params: {
    readonly steps: readonly RequiredSeedStep[];
    readonly continueOnError: boolean;
}): Promise<{ readonly failedSteps: readonly FailedRequiredSeedStep[] }> {
    const { steps, continueOnError } = params;
    const failedSteps: FailedRequiredSeedStep[] = [];

    for (const step of steps) {
        try {
            await step.run();
        } catch (error) {
            if (!continueOnError) {
                throw error;
            }
            failedSteps.push({ name: step.name, error });
            errorHistory.recordError('Required', step.name, 'Required seed step failed', error);
            summaryTracker.trackProcessStep(
                `Required: ${step.name}`,
                'error',
                'Step failed, continuing with the next one',
                describeError(error).message
            );
        }
    }

    return { failedSteps };
}
