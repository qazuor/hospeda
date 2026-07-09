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

import { ServiceErrorCode } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../src/types';
import * as logging from '../../src/utils/logging';
import { resolveErrorLogLevel, setLogger } from '../../src/utils/logging';
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
    // I3: method start/end log at DEBUG (not INFO) so they are silenced at the
    // default prod level — they fire on every service call with full payloads.
    it('logs method start at debug level', () => {
        logging.logMethodStart(mockMethodName, mockInput, mockActor);
        expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('Starting'));
        expect(loggerMock.info).not.toHaveBeenCalled();
    });

    it('logs method end at debug level', () => {
        logging.logMethodEnd(mockMethodName, mockOutput);
        expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('Completed'));
        expect(loggerMock.info).not.toHaveBeenCalled();
    });

    it('logs error', () => {
        logging.logError(mockMethodName, mockError, mockInput, mockActor);
        expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Error in'));
    });

    // HOS-109 / OQ-1: expected client outcomes (401/403/404) must not pollute
    // the error stream. logError downgrades them based on the ServiceError code.
    it('logs an expected 404 ServiceError at info, not error', () => {
        const error = new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Error in'));
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('logs an expected 401 ServiceError at info, not error', () => {
        const error = new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Error in'));
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('logs an expected 403 ServiceError at warn, not error', () => {
        const error = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Only self or USER_READ_ALL');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('Error in'));
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('keeps a real 500 ServiceError at error level', () => {
        const error = new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'boom');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Error in'));
        expect(loggerMock.info).not.toHaveBeenCalled();
        expect(loggerMock.warn).not.toHaveBeenCalled();
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

/**
 * Unit tests for the pure error-code → log-level mapping (HOS-109 / OQ-1).
 */
describe('resolveErrorLogLevel', () => {
    it('maps NOT_FOUND (404) to info', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.NOT_FOUND)).toBe('info');
    });

    it('maps UNAUTHORIZED (401) to info', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.UNAUTHORIZED)).toBe('info');
    });

    it('maps FORBIDDEN (403) to warn', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.FORBIDDEN)).toBe('warn');
    });

    it('maps INTERNAL_ERROR to error', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.INTERNAL_ERROR)).toBe('error');
    });

    it('maps VALIDATION_ERROR to error', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.VALIDATION_ERROR)).toBe('error');
    });

    it('defaults undefined (non-ServiceError) to error', () => {
        expect(resolveErrorLogLevel(undefined)).toBe('error');
    });
});
