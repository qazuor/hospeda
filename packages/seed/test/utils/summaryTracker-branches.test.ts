import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/utils/logger.js';
import { summaryTracker } from '../../src/utils/summaryTracker.js';

/**
 * Branch-coverage-focused tests for `SummaryTracker.print()` and its private
 * `getExecutionTime()` helper.
 *
 * `summaryTracker` is a module-level singleton, so the FIRST test in this
 * file (which must run before any other test in the whole suite touches this
 * module instance) relies on Vitest's per-file module isolation (`pool:
 * 'forks'`, default `isolate: true` in `vitest.config.ts`) to observe a
 * pristine, never-touched tracker: no timer started, no process steps, no
 * entity stats. Every other test in this file explicitly seeds the state it
 * needs instead of relying on ordering.
 */
describe('SummaryTracker.print — branch coverage', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prints N/A execution time and the empty-stats message on a pristine tracker', () => {
        // Arrange: this is the very first interaction with the singleton in this
        // isolated test file, so startTime/endTime/processSteps/stats are all unset.
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

        // Act
        summaryTracker.print();

        // Assert: getExecutionTime() short-circuits to 'N/A' because startTime is null
        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Total execution time: N/A'));
        // Assert: the process-steps section is skipped entirely (no steps recorded)
        const processStepsHeaderCalls = infoSpy.mock.calls.filter((call) =>
            String(call[0]).includes('Process steps:')
        );
        expect(processStepsHeaderCalls).toHaveLength(0);
        // Assert: the empty-stats branch fires
        expect(infoSpy).toHaveBeenCalledWith('   No entity statistics available');
    });

    it('formats execution time with a minutes component when the run takes over a minute', () => {
        // Arrange: 1 minute, 5 seconds, 500 milliseconds elapsed.
        // Start value is intentionally non-zero: `getExecutionTime()` treats
        // a falsy `startTime` as "timer never started" (`!this.startTime`),
        // and `0` is falsy in JS.
        const dateSpy = vi.spyOn(Date, 'now');
        dateSpy.mockReturnValueOnce(1_000); // consumed by startTimer()
        summaryTracker.startTimer();
        dateSpy.mockReturnValueOnce(66_500); // consumed by print() -> stopTimer()
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

        // Act
        summaryTracker.print();

        // Assert
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('Total execution time: 1m 5s 500ms')
        );
    });

    it('formats execution time with only seconds when the run takes under a minute', () => {
        // Arrange: 5 seconds elapsed, no minutes component
        const dateSpy = vi.spyOn(Date, 'now');
        dateSpy.mockReturnValueOnce(1_000); // consumed by startTimer()
        summaryTracker.startTimer();
        dateSpy.mockReturnValueOnce(6_000); // consumed by print() -> stopTimer()
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

        // Act
        summaryTracker.print();

        // Assert
        expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('Total execution time: 5s 0ms')
        );
    });

    it('prints an error step line without a details line when no details are given', () => {
        // Arrange
        summaryTracker.trackProcessStep('NoDetailsErrorStep', 'error', 'It failed');
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
        vi.spyOn(logger, 'info').mockImplementation(() => undefined);

        // Act
        summaryTracker.print();

        // Assert: the main error line is printed...
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('NoDetailsErrorStep: It failed')
        );
        // ...but no extra indented details line follows it, since `details` is undefined
        const detailsCalls = errorSpy.mock.calls.filter((call) => /^ {2}\S/.test(String(call[0])));
        expect(detailsCalls).toHaveLength(0);
    });

    it('prints a success step details line when details are given', () => {
        // Arrange
        summaryTracker.trackProcessStep(
            'WithDetailsStep',
            'success',
            'It worked',
            'extra info here'
        );
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

        // Act
        summaryTracker.print();

        // Assert
        expect(infoSpy).toHaveBeenCalledWith('  extra info here');
    });

    it('omits the error-details section when totalErrors is zero', () => {
        // Arrange
        summaryTracker.trackSuccess('NoErrorsEntity');
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

        // Act
        summaryTracker.print();

        // Assert: the totals line reports zero errors and the "Error details:" header
        // (only printed when totalErrors > 0) never appears
        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('successful, 0 errors'));
        const errorDetailsHeaderCalls = infoSpy.mock.calls.filter((call) =>
            String(call[0]).includes('Error details:')
        );
        expect(errorDetailsHeaderCalls).toHaveLength(0);
    });
});
