import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHistory } from '../../src/utils/errorHistory.js';
import type { SeedError } from '../../src/utils/errorHistory.js';
import { logger } from '../../src/utils/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resets the errorHistory singleton to a clean state before each test.
 * Since ErrorHistory.clear() resets errors, startTime, and endTime, we use it
 * as the canonical "fresh state" method.
 */
function resetHistory(): void {
    errorHistory.clear();
}

// ---------------------------------------------------------------------------
// startTracking / stopTracking / clear
// ---------------------------------------------------------------------------

describe('ErrorHistory — startTracking / stopTracking / clear', () => {
    beforeEach(() => resetHistory());

    it('should start with zero errors after clear', () => {
        expect(errorHistory.getTotalErrors()).toBe(0);
    });

    it('should reset errors when startTracking is called', () => {
        // Arrange: record an error, then restart
        errorHistory.recordError('Users', 'user.json', 'Some error');
        expect(errorHistory.getTotalErrors()).toBe(1);

        // Act
        errorHistory.startTracking();

        // Assert
        expect(errorHistory.getTotalErrors()).toBe(0);
    });

    it('should allow getDuration to return N/A when startTime or endTime is not set', () => {
        // clear() sets both to null
        resetHistory();
        // Access via printSummary since getDuration is private — but we can
        // verify it indirectly through the output. Instead, we trigger
        // getDuration indirectly by calling printSummary after recording errors
        // (which calls getDuration internally).
        errorHistory.recordError('Entity', 'file.json', 'msg');
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // Should not throw even if startTime / endTime are null
        expect(() => errorHistory.printSummary()).not.toThrow();

        // The duration line should contain "N/A"
        const durationCall = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Session duration')
        );
        expect(durationCall).toBeDefined();
        expect(String(durationCall?.[0])).toContain('N/A');

        infoSpy.mockRestore();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('should compute a milliseconds-only duration string when under 1 second', () => {
        // Arrange
        resetHistory();
        errorHistory.startTracking();
        errorHistory.stopTracking(); // almost-instant → <1s

        // Assert via printSummary
        errorHistory.recordError('Entity', 'file.json', 'msg');
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        errorHistory.printSummary();

        const durationCall = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Session duration')
        );
        expect(durationCall).toBeDefined();
        // Duration should end with "ms" and not contain "m " or "s "
        const durationText = String(durationCall?.[0]);
        expect(durationText).toMatch(/\d+ms/);

        vi.restoreAllMocks();
    });
});

// ---------------------------------------------------------------------------
// recordError — severity routing
// ---------------------------------------------------------------------------

describe('ErrorHistory — recordError', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('should record an error with severity "error" by default', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordError('Users', 'user.json', 'Failed to create');

        // Assert
        expect(errorHistory.getTotalErrors()).toBe(1);
        const counts = errorHistory.getErrorCountBySeverity();
        expect(counts.error).toBe(1);
        expect(counts.warning).toBe(0);
        expect(counts.info).toBe(0);
    });

    it('should capture stack trace when error is an Error instance', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const cause = new Error('Original cause');

        // Act
        errorHistory.recordError('Destinations', 'dest.json', 'Wrapper msg', cause, 'error');

        // Assert — stack is captured from the Error instance
        const byEntity = errorHistory.getErrorsByEntity();
        const destErrors = byEntity.get('Destinations');
        expect(destErrors).toBeDefined();
        expect(destErrors?.[0]?.stack).toContain('Error: Original cause');
    });

    it('should set details to String(error) when error is not an Error instance', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordError('Tags', 'tag.json', 'Raw error', 'plain string error', 'error');

        // Assert
        const byEntity = errorHistory.getErrorsByEntity();
        const tagErrors = byEntity.get('Tags');
        expect(tagErrors?.[0]?.details).toBe('plain string error');
        expect(tagErrors?.[0]?.stack).toBeUndefined();
    });

    it('should call logger.error for "error" severity', () => {
        // Arrange
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordError('Entity', 'file.json', 'msg', undefined, 'error');

        // Assert
        expect(errorSpy).toHaveBeenCalled();
    });

    it('should call logger.error for "warning" severity (icon differs but same logger call)', () => {
        // Arrange
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordError('Entity', 'file.json', 'warn msg', undefined, 'warning');

        // Assert — recordError always calls logger.error regardless of severity
        expect(errorSpy).toHaveBeenCalled();
        const counts = errorHistory.getErrorCountBySeverity();
        expect(counts.warning).toBe(1);
    });

    it('should call logger.error for "info" severity', () => {
        // Arrange
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordError('Entity', 'file.json', 'info msg', undefined, 'info');

        // Assert
        expect(errorSpy).toHaveBeenCalled();
        const counts = errorHistory.getErrorCountBySeverity();
        expect(counts.info).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// recordWarning / recordInfo
// ---------------------------------------------------------------------------

describe('ErrorHistory — recordWarning / recordInfo', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('recordWarning should store entry with severity "warning"', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordWarning('Posts', 'post.json', 'Missing field');

        // Assert
        expect(errorHistory.getTotalErrors()).toBe(1);
        const counts = errorHistory.getErrorCountBySeverity();
        expect(counts.warning).toBe(1);
    });

    it('recordInfo should store entry with severity "info"', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});

        // Act
        errorHistory.recordInfo('Events', 'event.json', 'Skipped');

        // Assert
        expect(errorHistory.getTotalErrors()).toBe(1);
        const counts = errorHistory.getErrorCountBySeverity();
        expect(counts.info).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// getErrorsByEntity
// ---------------------------------------------------------------------------

describe('ErrorHistory — getErrorsByEntity', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('should return an empty Map when no errors are recorded', () => {
        const result = errorHistory.getErrorsByEntity();
        expect(result.size).toBe(0);
    });

    it('should group errors by entityType', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        errorHistory.recordError('Users', 'u1.json', 'err1');
        errorHistory.recordError('Users', 'u2.json', 'err2');
        errorHistory.recordError('Destinations', 'd1.json', 'err3');

        // Act
        const result = errorHistory.getErrorsByEntity();

        // Assert
        expect(result.size).toBe(2);
        expect(result.get('Users')).toHaveLength(2);
        expect(result.get('Destinations')).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// getErrorsBySeverity
// ---------------------------------------------------------------------------

describe('ErrorHistory — getErrorsBySeverity', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('should return an empty Map when no errors are recorded', () => {
        const result = errorHistory.getErrorsBySeverity();
        expect(result.size).toBe(0);
    });

    it('should group errors by severity', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        errorHistory.recordError('A', 'a.json', 'msg', undefined, 'error');
        errorHistory.recordError('B', 'b.json', 'msg', undefined, 'warning');
        errorHistory.recordError('C', 'c.json', 'msg', undefined, 'info');
        errorHistory.recordError('D', 'd.json', 'msg', undefined, 'error');

        // Act
        const result = errorHistory.getErrorsBySeverity();

        // Assert
        expect(result.get('error')).toHaveLength(2);
        expect(result.get('warning')).toHaveLength(1);
        expect(result.get('info')).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// getErrorCountBySeverity
// ---------------------------------------------------------------------------

describe('ErrorHistory — getErrorCountBySeverity', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('should return zero counts when no errors are recorded', () => {
        const counts = errorHistory.getErrorCountBySeverity();
        expect(counts).toEqual({ error: 0, warning: 0, info: 0 });
    });

    it('should count across mixed severities correctly', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        errorHistory.recordError('X', 'x.json', 'e', undefined, 'error');
        errorHistory.recordError('X', 'x.json', 'w', undefined, 'warning');
        errorHistory.recordError('X', 'x.json', 'i', undefined, 'info');
        errorHistory.recordError('X', 'x.json', 'e2', undefined, 'error');

        // Act
        const counts = errorHistory.getErrorCountBySeverity();

        // Assert
        expect(counts).toEqual({ error: 2, warning: 1, info: 1 });
    });
});

// ---------------------------------------------------------------------------
// printSummary — zero errors path
// ---------------------------------------------------------------------------

describe('ErrorHistory — printSummary (no errors)', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('should log a success message when there are no errors', () => {
        // Arrange
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

        // Act
        errorHistory.printSummary();

        // Assert — one specific "No errors" message is logged
        const noErrorCall = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('No errors recorded during seeding process')
        );
        expect(noErrorCall).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// printSummary — with errors (covers lines ~200-298)
// ---------------------------------------------------------------------------

describe('ErrorHistory — printSummary (with errors)', () => {
    beforeEach(() => resetHistory());
    afterEach(() => vi.restoreAllMocks());

    it('should not throw when printing summary with mixed-severity errors', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        errorHistory.recordError('Users', 'u1.json', 'hard failure', new Error('DB error'));
        errorHistory.recordError('Users', 'u2.json', 'another', undefined, 'warning');
        errorHistory.recordError('Posts', 'p1.json', 'info message', undefined, 'info');

        // Act + Assert
        expect(() => errorHistory.printSummary()).not.toThrow();
    });

    it('should print total issues count in the summary', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        errorHistory.recordError('Entity', 'f.json', 'err1');
        errorHistory.recordError('Entity', 'f.json', 'err2');

        // Act
        errorHistory.printSummary();

        // Assert
        const totalCall = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Total issues recorded: 2')
        );
        expect(totalCall).toBeDefined();
    });

    it('should print severity counts (errors, warnings, info)', () => {
        // Arrange
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        errorHistory.recordError('A', 'a.json', 'e', undefined, 'error');
        errorHistory.recordError('B', 'b.json', 'w', undefined, 'warning');
        errorHistory.recordError('C', 'c.json', 'i', undefined, 'info');

        // Act
        errorHistory.printSummary();

        // Assert: logger.error called with "Errors: 1", logger.warn with "Warnings: 1"
        const errorsLine = errorSpy.mock.calls.find((args) =>
            String(args[0]).includes('Errors: 1')
        );
        const warningLine = warnSpy.mock.calls.find((args) =>
            String(args[0]).includes('Warnings: 1')
        );
        expect(errorsLine).toBeDefined();
        expect(warningLine).toBeDefined();
    });

    it('should print stack trace section when errors with stacks are present', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const errorWithStack = new Error('Structured error');
        // Ensure stack is present (it always is for new Error() in Node)
        errorHistory.recordError('Services', 'svc.json', 'Service failed', errorWithStack, 'error');

        // Act
        errorHistory.printSummary();

        // Assert: the "Detailed error information" section is printed
        const detailsHeader = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Detailed error information')
        );
        expect(detailsHeader).toBeDefined();
    });

    it('should print each stack trace line indented', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const cause = new Error('Stack line test');
        errorHistory.recordError('Entities', 'ent.json', 'Wrapper', cause, 'error');

        // Act
        errorHistory.printSummary();

        // Assert: at least one indented stack line was logged
        const stackLine = infoSpy.mock.calls.find((args) => String(args[0]).startsWith('      '));
        expect(stackLine).toBeDefined();
    });

    it('should print errors-by-entity section showing entity name', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        errorHistory.recordError('SpecialEntity', 'sp.json', 'Error message');

        // Act
        errorHistory.printSummary();

        // Assert: "SpecialEntity (1 issues):" appears somewhere in info output
        const entitySection = infoSpy.mock.calls.find(
            (args) =>
                String(args[0]).includes('SpecialEntity') && String(args[0]).includes('issues')
        );
        expect(entitySection).toBeDefined();
    });

    it('should print details when error.details differs from error.message', () => {
        // Arrange
        const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // The original cause message ("DB detail") will be stored as `details`.
        // The wrapper message ("Outer message") is a different string.
        const cause = new Error('DB detail');
        errorHistory.recordError('Entities', 'ent.json', 'Outer message', cause, 'error');

        // Act
        errorHistory.printSummary();

        // Assert: "Details: DB detail" is logged via logger.error
        const detailsLine = errorSpy.mock.calls.find((args) =>
            String(args[0]).includes('Details: DB detail')
        );
        expect(detailsLine).toBeDefined();
    });

    it('should log duration in seconds when elapsed is >= 1 second', () => {
        // Arrange
        resetHistory();
        // Fake a start time 2 seconds in the past
        const now = Date.now();
        errorHistory.startTracking();
        // Override startTime by starting 2000ms ago via a spy on Date.now
        // Instead: just call stopTracking quickly and verify the format holds
        // We test the "seconds" branch by manipulating timestamps directly.
        // Since startTime is private, we use a real 1ms sleep workaround:
        // set start 2100ms in past and call stopTracking after an artificial delay.
        // Easiest: create a fresh error, record it, then force the time string
        // by verifying getDuration branches via printSummary with a controlled spy.

        // Use fake timers to control Date.now
        vi.useFakeTimers();
        vi.setSystemTime(now);
        errorHistory.startTracking(); // sets startTime = now
        vi.setSystemTime(now + 1500); // 1.5 seconds later
        errorHistory.stopTracking(); // sets endTime = now + 1500

        errorHistory.recordError('T', 't.json', 'msg');

        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // Act
        errorHistory.printSummary();

        // Assert: "1s" appears in the duration
        const durationCall = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Session duration')
        );
        expect(String(durationCall?.[0])).toContain('1s');

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should log duration in minutes when elapsed is >= 1 minute', () => {
        // Arrange
        resetHistory();
        const now = Date.now();

        vi.useFakeTimers();
        vi.setSystemTime(now);
        errorHistory.startTracking();
        vi.setSystemTime(now + 65000); // 65 seconds = 1m 5s
        errorHistory.stopTracking();

        errorHistory.recordError('T', 't.json', 'msg');

        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        // Act
        errorHistory.printSummary();

        // Assert: "1m" appears in the duration
        const durationCall = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Session duration')
        );
        expect(String(durationCall?.[0])).toContain('1m');

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should print issues-by-severity section', () => {
        // Arrange
        vi.spyOn(logger, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(logger, 'warn').mockImplementation(() => {});

        errorHistory.recordError('X', 'x.json', 'err', undefined, 'error');

        // Act
        errorHistory.printSummary();

        // Assert: "Issues by severity:" appears in output
        const severitySection = infoSpy.mock.calls.find((args) =>
            String(args[0]).includes('Issues by severity')
        );
        expect(severitySection).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// SeedError interface shape (type-level check)
// ---------------------------------------------------------------------------

describe('SeedError interface', () => {
    it('should satisfy the SeedError shape with required fields', () => {
        // Arrange + Act
        const error: SeedError = {
            timestamp: new Date(),
            entityType: 'Users',
            context: 'user.json',
            message: 'Test error',
            severity: 'error'
        };

        // Assert
        expect(error.entityType).toBe('Users');
        expect(error.severity).toBe('error');
        expect(error.stack).toBeUndefined();
        expect(error.details).toBeUndefined();
    });

    it('should accept optional stack and details fields', () => {
        // Arrange + Act
        const error: SeedError = {
            timestamp: new Date(),
            entityType: 'Posts',
            context: 'post.json',
            message: 'With details',
            severity: 'warning',
            stack: 'Error\n  at fn (file.ts:10)',
            details: 'Additional info'
        };

        // Assert
        expect(error.stack).toBe('Error\n  at fn (file.ts:10)');
        expect(error.details).toBe('Additional info');
    });
});
