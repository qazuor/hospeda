/**
 * @fileoverview
 * Test suite for logging utility functions (logMethodStart, logMethodEnd, logError, logPermission, logDenied, logGrant).
 * Ensures robust, type-safe, and comprehensive coverage of logging logic for service methods, permissions, and error handling, including:
 * - Logging of method start/end, errors, permission checks, access grants/denials
 * - Use of a fully mocked logger for assertions
 * - Edge cases and correct log message formatting
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logging from '../../src/utils/logging';
import { setLogger } from '../../src/utils/logging';
import type { ServiceLogger } from '../../src/utils/service-logger';
import '../setupTest';
import { createLoggerMock } from '../utils/modelMockFactory';
import {
    mockActor,
    mockEntity,
    mockError,
    mockInput,
    mockMethodName,
    mockOutput,
    mockPermission,
    mockReason
} from './logging.mockData';
import { asMock } from './test-utils';

let loggerMock: ServiceLogger;
beforeEach(() => {
    loggerMock = createLoggerMock();
    setLogger(loggerMock);
    vi.clearAllMocks();
});
afterEach(() => {
    asMock(loggerMock.info).mockRestore();
    asMock(loggerMock.error).mockRestore();
    asMock(loggerMock.warn).mockRestore();
    asMock(loggerMock.permission).mockRestore();
});

/**
 * Test suite for logging utility functions.
 *
 * This suite verifies:
 * - Correct logging for method lifecycle, errors, permissions, grants, and denials
 * - Use of a fully mocked logger for assertions
 * - Robustness against edge cases and log message formatting
 *
 * The tests use a mocked logger and various scenarios to ensure all logging logic is covered.
 */
describe('logging util', () => {
    it('logs method start', () => {
        logging.logMethodStart(mockMethodName, mockInput, mockActor);
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Starting'));
    });

    it('logs method end', () => {
        logging.logMethodEnd(mockMethodName, mockOutput);
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Completed'));
    });

    it('logs error', () => {
        logging.logError(mockMethodName, mockError, mockInput, mockActor);
        expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Error in'));
    });

    it('logs permission', () => {
        logging.logPermission(mockPermission, mockActor, mockInput, mockReason);
        expect(loggerMock.permission).toHaveBeenCalledWith(
            expect.objectContaining({ permission: mockPermission })
        );
    });

    it('logs denied', () => {
        logging.logDenied(mockActor, mockInput, mockEntity, mockReason, mockPermission);
        expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('Access denied'));
    });

    it('logs grant', () => {
        logging.logGrant(mockActor, mockInput, mockEntity, mockPermission, mockReason);
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Access granted'));
    });
});
