import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
});
