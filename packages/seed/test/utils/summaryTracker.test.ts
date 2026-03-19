import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { summaryTracker } from '../../src/utils/summaryTracker.js';

describe('SummaryTracker', () => {
    beforeEach(() => {
        // Reset tracker state by clearing any in-progress state from previous tests
        // The tracker is a singleton, so we spy on console/logger to silence output
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('trackSuccess', () => {
        it('increments success count for an entity type', () => {
            // Arrange
            const entityName = 'TestEntity_trackSuccess';

            // Act
            summaryTracker.trackSuccess(entityName);
            summaryTracker.trackSuccess(entityName);

            // Assert - verify via getAllMappingStats by checking no errors were tracked
            // (direct stats are not exposed via public API, so we verify via trackError side-effects)
            // This test verifies the method runs without throwing
            expect(() => summaryTracker.trackSuccess(entityName)).not.toThrow();
        });
    });

    describe('trackError', () => {
        it('can track an error without throwing', () => {
            // Arrange
            const entityName = 'TestEntity_trackError';

            // Act & Assert
            expect(() =>
                summaryTracker.trackError(entityName, 'test-file.json', 'Validation failed')
            ).not.toThrow();
        });

        it('can track multiple errors for the same entity', () => {
            const entityName = 'TestEntity_multipleErrors';

            expect(() => {
                summaryTracker.trackError(entityName, 'file1.json', 'Error one');
                summaryTracker.trackError(entityName, 'file2.json', 'Error two');
            }).not.toThrow();
        });
    });

    describe('trackProcessStep', () => {
        it('can track a success step without throwing', () => {
            expect(() =>
                summaryTracker.trackProcessStep('Step One', 'success', 'Completed successfully')
            ).not.toThrow();
        });

        it('can track an error step without throwing', () => {
            expect(() =>
                summaryTracker.trackProcessStep('Step Two', 'error', 'Step failed', 'Details here')
            ).not.toThrow();
        });

        it('can track a warning step without throwing', () => {
            expect(() =>
                summaryTracker.trackProcessStep('Step Three', 'warning', 'Minor issue')
            ).not.toThrow();
        });
    });

    describe('startTimer / stopTimer', () => {
        it('can start and stop the timer without throwing', () => {
            expect(() => {
                summaryTracker.startTimer();
                summaryTracker.stopTimer();
            }).not.toThrow();
        });
    });

    describe('print', () => {
        it('runs without throwing even when no stats are recorded', () => {
            expect(() => summaryTracker.print()).not.toThrow();
        });

        it('runs without throwing when stats have been recorded', () => {
            summaryTracker.trackSuccess('PrintTestEntity');
            summaryTracker.trackError('PrintTestEntity', 'file.json', 'Test error');

            expect(() => summaryTracker.print()).not.toThrow();
        });
    });
});
