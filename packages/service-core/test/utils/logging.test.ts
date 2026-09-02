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

    // HOS-858: logError now logs a structured `data` payload as the first
    // argument (so postgres-cause fields land as their own keys, not
    // concatenated into a string) and a short label as the second argument.
    it('logs error with a structured data payload and a short label', () => {
        logging.logError(mockMethodName, mockError, mockInput, mockActor);
        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({
                input: mockInput,
                actor: expect.objectContaining({ id: mockActor.id }),
                errorMessage: mockError.message
            }),
            expect.stringContaining('Error in')
        );
    });

    // HOS-109 / OQ-1: expected client outcomes (401/403/404) must not pollute
    // the error stream. logError downgrades them based on the ServiceError code.
    it('logs an expected 404 ServiceError at info, not error', () => {
        const error = new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.info).toHaveBeenCalledWith(
            expect.any(Object),
            expect.stringContaining('Error in')
        );
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('logs an expected 401 ServiceError at info, not error', () => {
        const error = new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.info).toHaveBeenCalledWith(
            expect.any(Object),
            expect.stringContaining('Error in')
        );
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('logs an expected 403 ServiceError at warn, not error', () => {
        const error = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Only self or USER_READ_ALL');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.warn).toHaveBeenCalledWith(
            expect.any(Object),
            expect.stringContaining('Error in')
        );
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('keeps a real 500 ServiceError at error level', () => {
        const error = new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'boom');
        logging.logError(mockMethodName, error, mockInput, mockActor);
        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.any(Object),
            expect.stringContaining('Error in')
        );
        expect(loggerMock.info).not.toHaveBeenCalled();
        expect(loggerMock.warn).not.toHaveBeenCalled();
    });

    // HOS-858 AC-1 + AC-3, exercised through the public logError entry point
    // (not just the extractor unit — see postgres-error-cause.test.ts for
    // deeper coverage of the chain-walk itself, including the RED-before-fix
    // case). Mirrors the exact ServiceError -> DrizzleQueryError ->
    // pg.DatabaseError wrapping `BaseService.runWithLoggingAndValidation`
    // produces for a real query failure.
    it('persists the Postgres SQLSTATE as its own data field and keeps the SQL out of the message', () => {
        const driverError = new Error(
            'duplicate key value violates unique constraint "users_email_unique"'
        ) as Error & { code?: string; constraint?: string; table?: string };
        driverError.code = '23505';
        driverError.constraint = 'users_email_unique';
        driverError.table = 'users';

        const drizzleError = new Error(
            'Failed query: insert into "users" ("id", "email") values ($1, $2)\nparams: 1,alice@example.com',
            { cause: driverError }
        );

        const serviceError = new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `An unexpected error occurred: ${drizzleError.message}`,
            drizzleError
        );

        logging.logError(mockMethodName, serviceError, mockInput, mockActor);

        expect(loggerMock.error).toHaveBeenCalledWith(
            expect.objectContaining({
                postgresErrorCode: '23505',
                postgresErrorConstraint: 'users_email_unique',
                postgresErrorTable: 'users'
            }),
            expect.any(String)
        );

        const [, label] = asMock(loggerMock.error).mock.calls[0] as [unknown, string];
        expect(label).not.toContain('Failed query');
        expect(label).not.toContain('insert into');
        expect(label).toContain('23505');
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

    // HOS-129: plan-gating denials (entitlement/limit gates) are routine,
    // expected client outcomes in the same class as FORBIDDEN — not faults.
    it('maps ENTITLEMENT_REQUIRED (403) to warn', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.ENTITLEMENT_REQUIRED)).toBe('warn');
    });

    it('maps LIMIT_REACHED (403) to warn', () => {
        expect(resolveErrorLogLevel(ServiceErrorCode.LIMIT_REACHED)).toBe('warn');
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
