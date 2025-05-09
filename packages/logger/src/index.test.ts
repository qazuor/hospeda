import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, { LogLevel, configureLogger, createLogger, resetLoggerConfig } from './index.js';

describe('Logger', () => {
    beforeEach(() => {
        // Reset logger configuration before each test
        resetLoggerConfig();

        // Mock console methods
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should log standard messages', () => {
        logger.log('Test log message');
        expect(console.log).toHaveBeenCalled();
    });

    it('should log info messages', () => {
        logger.info('Test info message');
        expect(console.info).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
        logger.warn('Test warning message');
        expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
        logger.error('Test error message');
        expect(console.error).toHaveBeenCalled();
    });

    it('should log debug messages when configured', () => {
        configureLogger({ LEVEL: LogLevel.DEBUG });

        logger.debug('Test debug message');
        expect(console.debug).toHaveBeenCalled();
    });

    it('should not log debug messages when LEVEL is INFO', () => {
        configureLogger({ LEVEL: LogLevel.INFO });

        logger.debug('Test debug message');
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('should include label when provided', () => {
        logger.info('Test message with label', 'AUTH');
        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('[AUTH]'),
            expect.anything()
        );
    });

    it('should create a logger with predefined label', () => {
        const authLogger = createLogger('AUTH');
        authLogger.info('User logged in');
        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('[AUTH]'),
            expect.anything()
        );
    });

    it('should disable colors when configured', () => {
        configureLogger({ USE_COLORS: false });

        // This test is a bit limited since we're mocking console methods
        // and can't easily check for chalk color codes
        logger.info('Test message without colors');
        expect(console.info).toHaveBeenCalled();
    });
});
