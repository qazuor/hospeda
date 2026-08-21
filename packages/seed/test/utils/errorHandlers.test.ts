import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createBasicErrorHandler,
    createContinueOnErrorHandler,
    createDetailedErrorHandler,
    createGroupedErrorHandler,
    createRetryErrorHandler,
    defaultErrorHandler
} from '../../src/utils/errorHandlers.js';
import { IdMapper } from '../../src/utils/idMapper.js';
import type { SeedContext } from '../../src/utils/seedContext.js';
import { summaryTracker } from '../../src/utils/summaryTracker.js';

/**
 * Creates a minimal SeedContext for testing error handlers.
 * Uses dontLoadSavedMappings=true to avoid filesystem side effects.
 */
const createTestContext = (overrides: Partial<SeedContext> = {}): SeedContext => ({
    continueOnError: false,
    validateManifests: false,
    resetDatabase: false,
    exclude: [],
    idMapper: new IdMapper(true),
    currentEntity: 'TestEntity',
    currentFile: 'test-file.json',
    ...overrides
});

describe('defaultErrorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not throw when given a basic error', () => {
        const context = createTestContext();
        const error = new Error('Something went wrong');

        expect(() => defaultErrorHandler(error, {}, context)).not.toThrow();
    });

    it('does not throw when currentEntity and currentFile are undefined', () => {
        const context = createTestContext({ currentEntity: undefined, currentFile: undefined });
        const error = new Error('Context-less error');

        expect(() => defaultErrorHandler(error, {}, context)).not.toThrow();
    });

    it('calls summaryTracker.trackError', () => {
        const trackErrorSpy = vi.spyOn(summaryTracker, 'trackError').mockImplementation(() => {});
        const context = createTestContext({
            currentEntity: 'Users',
            currentFile: 'user-001.json'
        });
        const error = new Error('Validation failed');

        defaultErrorHandler(error, {}, context);

        expect(trackErrorSpy).toHaveBeenCalledWith('Users', 'user-001.json', 'Validation failed');
        vi.restoreAllMocks();
    });
});

describe('createDetailedErrorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a function that does not throw', () => {
        const handler = createDetailedErrorHandler('Users');
        const error = new Error('Detailed error');

        expect(() => handler({}, 0, error)).not.toThrow();
    });

    it('accepts item and index arguments', () => {
        const handler = createDetailedErrorHandler('Destinations');
        const item = { name: 'Test Destination' };
        const error = new Error('Failed');

        expect(() => handler(item, 5, error)).not.toThrow();
    });
});

describe('createContinueOnErrorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not throw for errors with matching continue-on codes', () => {
        const handler = createContinueOnErrorHandler(['DUPLICATE_KEY']);
        const context = createTestContext();
        const error = Object.assign(new Error('Duplicate'), { code: 'DUPLICATE_KEY' });

        expect(() => handler(error, {}, context)).not.toThrow();
    });

    it('does not throw for errors with non-matching codes', () => {
        const handler = createContinueOnErrorHandler(['DUPLICATE_KEY']);
        const context = createTestContext();
        const error = Object.assign(new Error('Other error'), { code: 'OTHER_CODE' });

        expect(() => handler(error, {}, context)).not.toThrow();
    });
});

describe('createRetryErrorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a function that does not throw for non-retryable errors', () => {
        const handler = createRetryErrorHandler(3);
        const context = createTestContext();
        const error = new Error('Non-retryable error');

        expect(() => handler(error, {}, context)).not.toThrow();
    });

    it('adds retryable errors to the retry queue', () => {
        const handler = createRetryErrorHandler(3);
        const context = createTestContext();
        const error = new Error('Connection timeout');

        handler(error, { id: 'item-1' }, context);

        // The extended context should now have a retry queue
        const extendedContext = context as typeof context & {
            retryQueue?: unknown[];
        };
        expect(extendedContext.retryQueue).toBeDefined();
        expect(extendedContext.retryQueue?.length).toBe(1);
    });
});

describe('createGroupedErrorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a function that does not throw', () => {
        const handler = createGroupedErrorHandler();
        const context = createTestContext();
        const error = new Error('Grouped error');

        expect(() => handler(error, {}, context)).not.toThrow();
    });

    it('handles multiple errors of the same type without throwing', () => {
        const handler = createGroupedErrorHandler();
        const context = createTestContext();

        for (let i = 0; i < 5; i++) {
            const error = new Error(`Repeated error: details ${i}`);
            expect(() => handler(error, {}, context)).not.toThrow();
        }
    });

    it('groups errors without a message under "Unknown Error" and stops individual logging after 3', () => {
        // Arrange
        const handler = createGroupedErrorHandler();
        const context = createTestContext();
        const trackErrorSpy = vi.spyOn(summaryTracker, 'trackError').mockImplementation(() => {});

        // Act: 5 errors with an empty message all fall into the same 'Unknown Error' group
        for (let i = 0; i < 5; i++) {
            handler(new Error(), {}, context);
        }

        // Assert: only the first 3 occurrences of the group trigger individual logging
        expect(trackErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('falls back to Unknown/unknown labels when context lacks entity/file info', () => {
        // Arrange
        const handler = createGroupedErrorHandler();
        const context = createTestContext({ currentEntity: undefined, currentFile: undefined });
        const trackErrorSpy = vi.spyOn(summaryTracker, 'trackError').mockImplementation(() => {});

        // Act
        handler(new Error('Boom: details'), {}, context);

        // Assert
        expect(trackErrorSpy).toHaveBeenCalledWith('Unknown', 'unknown', 'Boom: details');
    });
});

describe('createRetryErrorHandler — entity/file fallback and retryable conditions', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('falls back to Unknown/unknown labels when context lacks entity/file info while retrying', () => {
        // Arrange
        const handler = createRetryErrorHandler(3);
        const context = createTestContext({ currentEntity: undefined, currentFile: undefined });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = new Error('Connection timeout');

        // Act
        handler(error, {}, context);

        // Assert
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying Unknown (unknown)'));
    });

    it('retries when the error message indicates a network failure (ECONNRESET)', () => {
        // Arrange
        const handler = createRetryErrorHandler(3);
        const context = createTestContext();
        const error = new Error('socket hang up: ECONNRESET');

        // Act
        handler(error, { id: 'net-1' }, context);

        // Assert
        const extendedContext = context as typeof context & { retryQueue?: unknown[] };
        expect(extendedContext.retryQueue).toHaveLength(1);
    });

    it('retries when the error code is in the retryable codes list', () => {
        // Arrange
        const handler = createRetryErrorHandler(3);
        const context = createTestContext();
        const error = Object.assign(new Error('rate limited'), { code: 'RATE_LIMIT_EXCEEDED' });

        // Act
        handler(error, { id: 'code-1' }, context);

        // Assert
        const extendedContext = context as typeof context & { retryQueue?: unknown[] };
        expect(extendedContext.retryQueue).toHaveLength(1);
    });
});

describe('createContinueOnErrorHandler — entity/file fallback', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('falls back to Unknown/unknown labels when context lacks entity/file info', () => {
        // Arrange
        const handler = createContinueOnErrorHandler(['DUPLICATE_KEY']);
        const context = createTestContext({ currentEntity: undefined, currentFile: undefined });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = Object.assign(new Error('Duplicate'), { code: 'DUPLICATE_KEY' });

        // Act
        handler(error, {}, context);

        // Assert
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Continuing on DUPLICATE_KEY for Unknown (unknown)')
        );
    });
});

describe('createDetailedErrorHandler — item and cause branches', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not log input data when item is falsy', () => {
        // Arrange
        const handler = createDetailedErrorHandler('Users');
        const error = new Error('Detailed error');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        // Act
        handler(undefined, 2, error);

        // Assert
        const inputDataCalls = errorSpy.mock.calls.filter((call) =>
            String(call[0]).startsWith('Input data:')
        );
        expect(inputDataCalls).toHaveLength(0);
    });

    it('logs the error cause when present', () => {
        // Arrange
        const handler = createDetailedErrorHandler('Users');
        const error = Object.assign(new Error('Detailed error'), { cause: 'underlying issue' });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        // Act
        handler({}, 0, error);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith('Cause: underlying issue');
    });
});

describe('defaultErrorHandler — cause branch', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs the error cause when present', () => {
        // Arrange
        const context = createTestContext();
        const error = Object.assign(new Error('Failed with cause'), { cause: 'root cause detail' });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        // Act
        defaultErrorHandler(error, {}, context);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith('Cause: root cause detail');
    });
});

describe('createBasicErrorHandler', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs error details without a cause line when no cause is present', () => {
        // Arrange
        const handler = createBasicErrorHandler();
        const error = new Error('Basic failure');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        // Act
        handler({}, 3, error);

        // Assert
        const causeCalls = errorSpy.mock.calls.filter((call) =>
            String(call[0]).startsWith('Cause:')
        );
        expect(causeCalls).toHaveLength(0);
        expect(errorSpy).toHaveBeenCalledWith('Message: Basic failure');
    });

    it('logs the cause when present', () => {
        // Arrange
        const handler = createBasicErrorHandler();
        const error = Object.assign(new Error('Basic failure with cause'), { cause: 'root' });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        // Act
        handler({}, 4, error);

        // Assert
        expect(errorSpy).toHaveBeenCalledWith('Cause: root');
    });
});
