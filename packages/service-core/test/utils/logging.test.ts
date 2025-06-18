/**
 * logging.test.ts
 *
 * Tests for logging util functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logging from '../../src/utils/logging';
import { setLogger } from '../../src/utils/logging';
import type { ServiceLogger } from '../../src/utils/service-logger';
import '../setupTest';
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

let loggerMock: ServiceLogger;
beforeEach(() => {
    loggerMock = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => loggerMock),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => loggerMock),
        registerLogMethod: vi.fn(() => loggerMock),
        permission: vi.fn() as (...args: unknown[]) => void
    } as unknown as ServiceLogger;
    setLogger(loggerMock);
    vi.clearAllMocks();
});
afterEach(() => {
    (loggerMock.info as unknown as { mockRestore: () => void }).mockRestore();
    (loggerMock.error as unknown as { mockRestore: () => void }).mockRestore();
    (loggerMock.warn as unknown as { mockRestore: () => void }).mockRestore();
    (loggerMock.permission as unknown as { mockRestore: () => void }).mockRestore();
});

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
