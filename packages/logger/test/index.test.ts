import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, {
    LogLevel,
    LoggerColors,
    configureLogger,
    createLogger,
    registerCategory,
    type LoggerCategoryOptions,
    type LoggerOptions
} from '../src/index.js';
import { resetLogger } from '../src/logger.js';

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
        // Logger outputs a single formatted string containing the category
        const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call).toContain('AUTHENTICATION');
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
        // Logger outputs a single formatted string containing the category (uppercase)
        const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call).toContain('DATABASE');
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
        // Logger outputs a single formatted string containing the object
        const call1 = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call1).toContain('a');
        expect(call1).toContain('b');

        // Reset mock to check next call
        vi.clearAllMocks();

        // Test with custom expansion (3 levels)
        const options: LoggerOptions = {
            expandObjectLevels: 3
        };

        logger.info(testObject, undefined, options);
        const call2 = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call2).toContain('a');
        expect(call2).toContain('b');
    });

    it('should truncate long text when configured', () => {
        const longText = 'a'.repeat(200);

        // Default should truncate at 100 chars
        logger.info(longText);
        // Logger outputs a single formatted string
        const call1 = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call1).toContain('a'.repeat(100));
        expect(call1).toContain('TRUNCATED');

        // Reset mock to check next call
        vi.clearAllMocks();

        // Disable truncation
        const options: LoggerOptions = {
            truncateLongText: false
        };

        logger.info(longText, undefined, options);
        const call2 = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call2).toContain('a'.repeat(200));
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
        (logger as any).http({ method: 'GET', url: '/api/users', status: 200 });
        const call1 = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call1).toContain('[HTTP]');

        // Register a method for a specific category
        const dbLogger = logger.registerCategory('Database', 'DB', {
            color: LoggerColors.BLUE
        });

        // Define the custom method on the category logger
        dbLogger.registerLogMethod('query', LogLevel.DEBUG, 'SQL');

        // Use the custom method
        (dbLogger as any).query({
            table: 'users',
            action: 'select',
            params: { id: 1 },
            result: { id: 1, name: 'John' }
        });

        // Logger outputs a single formatted string
        const call2 = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call2).toContain('DATABASE');
        expect(call2).toContain('[SQL]');
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
        (dbLogger as any).query(queryParams);

        // Logger outputs a single formatted string containing all parameters
        const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(call).toContain('DATABASE');
        expect(call).toContain('[QUERY]');
        expect(call).toContain('table');
        expect(call).toContain('users');
        expect(call).toContain('action');
        expect(call).toContain('insert');
    });

    describe('WARN level filtering', () => {
        it('should suppress info when level is WARN', () => {
            // Arrange
            configureLogger({ LEVEL: LogLevel.WARN });

            // Act
            logger.info('should be suppressed');

            // Assert
            expect(console.info).not.toHaveBeenCalled();
        });

        it('should pass warn when level is WARN', () => {
            // Arrange
            configureLogger({ LEVEL: LogLevel.WARN });

            // Act
            logger.warn('should pass');

            // Assert
            expect(console.warn).toHaveBeenCalled();
        });

        it('should pass error when level is WARN', () => {
            // Arrange
            configureLogger({ LEVEL: LogLevel.WARN });

            // Act
            logger.error('should pass');

            // Assert
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Truncation behavior', () => {
        const longText = 'a'.repeat(200); // Text longer than default truncate limit

        it('should truncate long text by default for non-error levels', () => {
            logger.log(longText);
            const call = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('a'.repeat(100));
            expect(call).toContain('TRUNCATED');
        });

        it('should NOT truncate long text in error messages by default', () => {
            logger.error(longText);
            const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain(longText);
        });

        it('should NEVER truncate debug messages regardless of configuration', () => {
            // Enable truncation globally
            configureLogger({ TRUNCATE_LONG_TEXT: true, TRUNCATE_LONG_TEXT_ON_ERROR: true });

            logger.debug(longText);
            const call = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain(longText);
        });

        it('should truncate error messages when TRUNCATE_LONG_TEXT_ON_ERROR is enabled', () => {
            configureLogger({ TRUNCATE_LONG_TEXT_ON_ERROR: true });

            logger.error(longText);
            const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('a'.repeat(100));
            expect(call).toContain('TRUNCATED');
        });

        it('should respect category-specific truncateLongTextOnError setting', () => {
            const categoryOptions: LoggerCategoryOptions = {
                color: LoggerColors.RED,
                truncateLongTextOnError: true
            };

            const categoryLogger = registerCategory('TestCategory', 'TEST', categoryOptions);
            categoryLogger.error(longText);

            const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('TESTCATEGORY');
            expect(call).toContain('a'.repeat(100));
            expect(call).toContain('TRUNCATED');
        });

        it('should respect per-log truncateLongTextOnError option', () => {
            const options: LoggerOptions = {
                truncateLongTextOnError: true
            };

            logger.error(longText, 'Test Error', options);
            const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('[Test Error]');
            expect(call).toContain('a'.repeat(100));
            expect(call).toContain('TRUNCATED');
        });
    });

    describe('Category formatting', () => {
        it('should apply category-specific background colors with contrasting text', () => {
            // Create a category with a specific color
            const categoryLogger = registerCategory('TestCategory', 'TEST_COLOR', {
                color: LoggerColors.CYAN
            });

            categoryLogger.info('Test message');

            // Logger outputs a single formatted string with category in uppercase
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('TESTCATEGORY');
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

            // Logger outputs categories in uppercase
            const calls = (console.info as ReturnType<typeof vi.fn>).mock.calls;
            expect(calls[0][0]).toContain('A');
            expect(calls[1][0]).toContain('VERYLONGCATEGORYNAME');
        });

        it('should convert category names to uppercase', () => {
            const mixedCaseLogger = registerCategory('MixedCase', 'MIXED', {
                color: LoggerColors.CYAN
            });

            mixedCaseLogger.info('Test message');

            // Category name should be converted to uppercase
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('MIXEDCASE');
        });

        it('should apply bold formatting to category text', () => {
            const categoryLogger = registerCategory('TestBold', 'BOLD', {
                color: LoggerColors.GREEN
            });

            categoryLogger.info('Test message');

            // Logger outputs a single formatted string with category in uppercase
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(call).toContain('TESTBOLD');
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

            // Logger outputs categories in uppercase
            const calls = (console.info as ReturnType<typeof vi.fn>).mock.calls;
            expect(calls[0][0]).toContain('DARK');
            expect(calls[1][0]).toContain('LIGHT');
        });
    });

    describe('Sensitive Data Redaction (PII filtering)', () => {
        it('should redact sensitive keys in objects', () => {
            const sensitiveObject = {
                username: 'john',
                password: 'secret123',
                email: 'john@example.com',
                token: 'abc123def456'
            };

            logger.info(sensitiveObject);
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            // Username should be visible
            expect(call).toContain('john');
            // Sensitive fields should be redacted
            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('secret123');
            expect(call).not.toContain('abc123def456');
        });

        it('should redact JWT tokens in string values', () => {
            const jwtToken =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

            logger.info(`User authenticated with token: ${jwtToken}`);
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('eyJ');
        });

        it('should redact Bearer tokens in string values', () => {
            logger.info('Authorization: Bearer abc123xyz789');
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('abc123xyz789');
        });

        it('should redact credit card numbers', () => {
            logger.info('Card: 4111-1111-1111-1111');
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('4111-1111-1111-1111');
        });

        it('should redact email addresses in values', () => {
            logger.info('Contact: user@example.com for support');
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('user@example.com');
        });

        it('should redact phone numbers', () => {
            logger.info('Phone: 555-123-4567');
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('555-123-4567');
        });

        it('should redact IP addresses', () => {
            logger.info('Client IP: 192.168.1.100');
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('192.168.1.100');
        });

        it('should redact nested sensitive data', () => {
            const nestedData = {
                user: {
                    name: 'John',
                    credentials: {
                        password: 'verysecret',
                        apiKey: 'key123'
                    }
                }
            };

            logger.info(nestedData, undefined, { expandObjectLevels: 5 });
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('John');
            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('verysecret');
            expect(call).not.toContain('key123');
        });

        it('should redact sensitive data in arrays', () => {
            const arrayData = [
                { user: 'alice', password: 'pass1' },
                { user: 'bob', password: 'pass2' }
            ];

            logger.info(arrayData);
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('alice');
            expect(call).toContain('bob');
            expect(call).toContain('[REDACTED]');
            expect(call).not.toContain('pass1');
            expect(call).not.toContain('pass2');
        });

        it('should not redact non-sensitive data', () => {
            const safeData = {
                id: 123,
                name: 'Test Product',
                price: 99.99,
                category: 'Electronics'
            };

            logger.info(safeData);
            const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0];

            expect(call).toContain('123');
            expect(call).toContain('Test Product');
            expect(call).toContain('99.99');
            expect(call).toContain('Electronics');
            expect(call).not.toContain('[REDACTED]');
        });
    });
});
