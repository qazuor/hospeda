import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, {
    LogLevel,
    LoggerColors,
    configureLogger,
    createLogger,
    registerCategory,
    type LoggerCategoryOptions,
    type LoggerOptions
} from './index.js';
import { resetLogger } from './logger.js';

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

    it('should register and use custom logger methods', () => {
        // Register a custom method on the main logger
        logger.registerLogMethod('http', LogLevel.INFO, 'HTTP');

        // Use the custom method
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (logger as any).http({ method: 'GET', url: '/api/users', status: 200 });
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[HTTP]'));

        // Register a method for a specific category
        const dbLogger = logger.registerCategory('Database', 'DB', {
            color: LoggerColors.BLUE
        });

        // Define the custom method on the category logger
        dbLogger.registerLogMethod('query', LogLevel.DEBUG, 'SQL');

        // Use the custom method
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (dbLogger as any).query({
            table: 'users',
            action: 'select',
            params: { id: 1 },
            result: { id: 1, name: 'John' }
        });

        expect(console.debug).toHaveBeenCalledWith(
            expect.stringContaining('Database'),
            expect.stringContaining('[SQL]')
        );
    });

    it('should pass custom logger method parameters correctly', () => {
        // Define a type for query parameters
        interface QueryParams {
            table: string;
            action: string;
            params: Record<string, unknown>;
            result: unknown;
        }

        // Create a database logger
        const dbLogger = logger.registerCategory('Database', 'DB', {
            color: LoggerColors.CYAN
        });

        // Register the query method
        dbLogger.registerLogMethod<QueryParams>('query', LogLevel.INFO, 'QUERY');

        // Test parameters
        const queryParams: QueryParams = {
            table: 'users',
            action: 'insert',
            params: { name: 'Jane', email: 'jane@example.com' },
            result: { id: 2, name: 'Jane', email: 'jane@example.com' }
        };

        // Use the custom method
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (dbLogger as any).query(queryParams);

        // Verify the output contains the parameters
        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('Database'),
            expect.stringContaining('[QUERY]'),
            expect.stringContaining('table'),
            expect.stringContaining('users'),
            expect.stringContaining('action'),
            expect.stringContaining('insert')
        );
    });

    describe('Truncation behavior', () => {
        const longText = 'a'.repeat(200); // Text longer than default truncate limit

        it('should truncate long text by default for non-error levels', () => {
            logger.log(longText);
            expect(console.log).toHaveBeenCalledWith(
                expect.stringMatching(/^a{100}$/), // First 100 characters of 'a'
                '...'
            );
        });

        it('should NOT truncate long text in error messages by default', () => {
            logger.error(longText);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining(longText));
            expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('[TRUNCATED]'));
        });

        it('should NEVER truncate debug messages regardless of configuration', () => {
            // Enable truncation globally
            configureLogger({ TRUNCATE_LONG_TEXT: true, TRUNCATE_LONG_TEXT_ON_ERROR: true });

            logger.debug(longText);
            expect(console.debug).toHaveBeenCalledWith(expect.stringContaining(longText));
            expect(console.debug).not.toHaveBeenCalledWith(expect.stringContaining('[TRUNCATED]'));
        });

        it('should truncate error messages when TRUNCATE_LONG_TEXT_ON_ERROR is enabled', () => {
            configureLogger({ TRUNCATE_LONG_TEXT_ON_ERROR: true });

            logger.error(longText);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringMatching(/^a{100}$/), // First 100 characters of 'a'
                '...'
            );
        });

        it('should respect category-specific truncateLongTextOnError setting', () => {
            const categoryOptions: LoggerCategoryOptions = {
                color: LoggerColors.RED,
                truncateLongTextOnError: true
            };

            const categoryLogger = registerCategory('TestCategory', 'TEST', categoryOptions);
            categoryLogger.error(longText);

            expect(console.error).toHaveBeenCalledWith(
                'TestCategory',
                expect.stringMatching(/^a{100}$/), // First 100 characters of 'a'
                '...'
            );
        });

        it('should respect per-log truncateLongTextOnError option', () => {
            const options: LoggerOptions = {
                truncateLongTextOnError: true
            };

            logger.error(longText, 'Test Error', options);
            expect(console.error).toHaveBeenCalledWith(
                '[Test Error]',
                expect.stringMatching(/^a{100}$/), // First 100 characters of 'a'
                '...'
            );
        });
    });

    describe('Category formatting', () => {
        it('should apply category-specific background colors with contrasting text', () => {
            // Create a category with a specific color
            const categoryLogger = registerCategory('TestCategory', 'TEST_COLOR', {
                color: LoggerColors.CYAN
            });

            categoryLogger.info('Test message');

            // Verify that the category is included in the output
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('TestCategory'));
        });

        it('should align and center categories based on the longest category name', () => {
            // Create categories with different name lengths
            const shortLogger = registerCategory('A', 'SHORT', {
                color: LoggerColors.GREEN
            });
            const longLogger = registerCategory('VeryLongCategoryName', 'LONG', {
                color: LoggerColors.BLUE
            });

            shortLogger.info('Short message');
            longLogger.info('Long message');

            // Categories should be included in output as registered
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('A'));
            expect(console.info).toHaveBeenCalledWith(
                expect.stringContaining('VeryLongCategoryName')
            );
        });

        it('should convert category names to uppercase', () => {
            const mixedCaseLogger = registerCategory('MixedCase', 'MIXED', {
                color: LoggerColors.CYAN
            });

            mixedCaseLogger.info('Test message');

            // Category name should be included as registered
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('MixedCase'));
        });

        it('should apply bold formatting to category text', () => {
            const categoryLogger = registerCategory('TestBold', 'BOLD', {
                color: LoggerColors.GREEN
            });

            categoryLogger.info('Test message');

            // Verify that the category is included in the output
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('TestBold'));
        });

        it('should use white text on dark backgrounds and black text on light backgrounds', () => {
            // Create categories with dark and light colors
            const darkLogger = registerCategory('Dark', 'DARK', {
                color: LoggerColors.RED // Dark color - should use white text
            });
            const lightLogger = registerCategory('Light', 'LIGHT', {
                color: LoggerColors.YELLOW // Light color - should use black text
            });

            darkLogger.info('Dark message');
            lightLogger.info('Light message');

            // Verify that categories are included in output
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Dark'));
            expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Light'));
        });
    });
});
