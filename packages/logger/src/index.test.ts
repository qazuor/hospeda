import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, {
    LogLevel,
    LoggerColors,
    configureLogger,
    createLogger,
    type LoggerCategoryOptions,
    type LoggerOptions
} from './index.js';
import { registerCategory, resetLogger } from './logger.js';

describe('Logger', () => {
    beforeEach(() => {
        // Reset logger configuration before each test
        resetLogger();

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
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[AUTH]'));
    });

    it('should create a logger with predefined category', () => {
        const categoryOptions: LoggerCategoryOptions = {
            color: LoggerColors.BLUE
        };

        registerCategory('Authentication', 'AUTH', categoryOptions);
        const authLogger = createLogger('AUTH');

        authLogger.info('User logged in');
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Authentication'));
    });

    it('should register a new category and return a logger for it', () => {
        const categoryOptions: LoggerCategoryOptions = {
            color: LoggerColors.GREEN,
            expandObjectLevels: 3
        };

        const dbLogger = logger.registerCategory('Database', 'DB', categoryOptions);
        expect(dbLogger).toBeDefined();

        // Test that the logger uses the category
        dbLogger.info('Connected to database');
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Database'));
    });

    it('should disable colors when configured', () => {
        configureLogger({ USE_COLORS: false });

        // This test is a bit limited since we're mocking console methods
        // and can't easily check for chalk color codes
        logger.info('Test message without colors');
        expect(console.info).toHaveBeenCalled();
    });

    it('should expand objects based on expandObjectLevels option', () => {
        const testObject = { a: { b: { c: 'deep value' } } };

        // Test with default expansion (2 levels)
        logger.info(testObject);
        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('a'),
            expect.stringContaining('b'),
            expect.stringContaining('[Object]')
        );

        // Reset mock to check next call
        vi.clearAllMocks();

        // Test with custom expansion (3 levels)
        const options: LoggerOptions = {
            expandObjectLevels: 3
        };

        logger.info(testObject, undefined, options);
        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('a'),
            expect.stringContaining('b'),
            expect.stringContaining('c'),
            expect.stringContaining('deep value')
        );
    });

    it('should truncate long text when configured', () => {
        const longText = 'a'.repeat(200);

        // Default should truncate at 100 chars
        logger.info(longText);
        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('a'.repeat(100)),
            expect.stringContaining('...')
        );

        // Reset mock to check next call
        vi.clearAllMocks();

        // Disable truncation
        const options: LoggerOptions = {
            truncateLongText: false
        };

        logger.info(longText, undefined, options);
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('a'.repeat(200)));
        expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('...'));
    });

    it('should override configuration with options', () => {
        // Set global config
        configureLogger({ LEVEL: LogLevel.ERROR });

        // Should not log debug by default
        logger.debug('This should not be logged');
        expect(console.debug).not.toHaveBeenCalled();

        // Should log debug with debug option
        const options: LoggerOptions = {
            debug: true
        };

        logger.debug('This should be logged', undefined, options);
        expect(console.debug).toHaveBeenCalled();
    });

    it('should use LoggerColors enum for category colors', () => {
        const redLogger = logger.registerCategory('Error Handler', 'ERR_HANDLER', {
            color: LoggerColors.RED
        });

        redLogger.error('A critical error occurred');
        expect(console.error).toHaveBeenCalled();

        const blueLogger = logger.registerCategory('API', 'API', {
            color: LoggerColors.BLUE
        });

        blueLogger.info('API request received');
        expect(console.info).toHaveBeenCalled();
    });
});
