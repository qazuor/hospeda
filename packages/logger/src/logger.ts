/**
 * Core logging functionality
 * @module logger/logger
 */

import {
    clearCategories,
    getCategoryByKey,
    registerCategoryInternal,
    registerDefaultCategory
} from './categories.js';
import { configureLogger, getConfig, resetLoggerConfig } from './config.js';
import { formatLogArgs } from './formatter.js';
import {
    type ILogger,
    LogLevel,
    type LogLevelType,
    type LoggerCategoryOptions,
    type LoggerOptions
} from './types.js';

/**
 * Store for custom logger methods
 */
const customLogMethods = new Map<string, { level: LogLevel; defaultLabel?: string }>();

/**
 * Check if a log level should be displayed
 * @param level - Log level to check
 * @param options - Optional logging options
 * @returns Whether the log level should be displayed
 */
function shouldLog(level: LogLevel, options?: LoggerOptions): boolean {
    const config = getConfig();

    // If debug option is true, always log
    if (options?.debug === true) {
        return true;
    }

    // Get level from options, category, or global config
    const configLevel =
        options?.level ||
        (options?.category
            ? (getCategoryByKey(options.category).options.level as LogLevelType | undefined)
            : undefined) ||
        config.LEVEL;

    // Visibility model per threshold
    switch (configLevel) {
        case 'ERROR':
            return level === LogLevel.ERROR;
        case 'WARN':
            return level === LogLevel.WARN || level === LogLevel.ERROR;
        case 'INFO':
            return level === LogLevel.INFO || level === LogLevel.WARN || level === LogLevel.ERROR;
        // case 'LOG':
        // case 'DEBUG':
        default:
            // Most permissive: show all levels (including DEBUG)
            return true;
    }
}

/**
 * Log a message with specified level
 * @param level - Log level
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 */
function logWithLevel(
    level: LogLevel,
    value: unknown,
    label?: string,
    options?: LoggerOptions
): void {
    if (!shouldLog(level, options)) {
        return;
    }

    const args = formatLogArgs(level, value, label, options);

    // Log to console based on level
    switch (level) {
        case LogLevel.LOG:
            // biome-ignore lint/suspicious/noConsoleLog: Log method needs to use console.log
            // biome-ignore lint/suspicious/noConsoleLog: Log method needs to use console.log
            console.log(...args);
            break;
        case LogLevel.INFO:
            console.info(...args);
            break;
        case LogLevel.WARN:
            console.warn(...args);
            break;
        case LogLevel.ERROR:
            console.error(...args);
            break;
        case LogLevel.DEBUG:
            console.debug(...args);
            break;
    }

    // TODO [868ec349-452b-487d-b867-1b9db90507a9]: Implement file logging if save is enabled
    // This would check config.SAVE, category.options.save, and options.save
}

/**
 * Log a standard message
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 */
export function log(value: unknown, label?: string, options?: LoggerOptions): void {
    logWithLevel(LogLevel.LOG, value, label, options);
}

/**
 * Log an informational message
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 */
export function info(value: unknown, label?: string, options?: LoggerOptions): void {
    logWithLevel(LogLevel.INFO, value, label, options);
}

/**
 * Log a warning message
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 */
export function warn(value: unknown, label?: string, options?: LoggerOptions): void {
    logWithLevel(LogLevel.WARN, value, label, options);
}

/**
 * Log an error message
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 */
export function error(value: unknown, label?: string, options?: LoggerOptions): void {
    logWithLevel(LogLevel.ERROR, value, label, options);
}

/**
 * Log a debug message
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 */
export function debug(value: unknown, label?: string, options?: LoggerOptions): void {
    logWithLevel(LogLevel.DEBUG, value, label, options);
}

/**
 * Register a custom log method for the logger
 * @param methodName - Name of the method to register
 * @param level - Log level to use for this method
 * @param defaultLabel - Default label to use for this method (optional)
 * @param categoryKey - Category key if this is for a specific category logger
 * @returns The logger instance with the registered method
 */
function registerCustomLogMethod<T>(
    methodName: string,
    level: LogLevel,
    defaultLabel?: string,
    categoryKey?: string
): ILogger {
    // Store the custom method configuration
    customLogMethods.set(methodName, { level, defaultLabel });

    // Create the custom method implementation
    const customMethod = (params: T, options?: LoggerOptions) => {
        const mergedOptions = {
            ...options,
            category: categoryKey || options?.category
        };
        logWithLevel(level, params, defaultLabel, mergedOptions);
    };

    // Add the method to the main logger if not category-specific
    if (!categoryKey) {
        (logger as ILogger & { [key: string]: unknown })[methodName] = customMethod;
        return logger;
    }

    // For category loggers, return the logger from createLogger
    return createLogger(categoryKey);
}

/**
 * Create a logger with a predefined category
 * @param categoryKey - Key of the category to use
 * @returns Logger with predefined category
 */
export function createLogger(categoryKey: string): ILogger {
    const categoryLogger: ILogger = {
        log: (value: unknown, label?: string, options?: LoggerOptions) =>
            log(value, label, { ...options, category: categoryKey }),
        info: (value: unknown, label?: string, options?: LoggerOptions) =>
            info(value, label, { ...options, category: categoryKey }),
        warn: (value: unknown, label?: string, options?: LoggerOptions) =>
            warn(value, label, { ...options, category: categoryKey }),
        error: (value: unknown, label?: string, options?: LoggerOptions) =>
            error(value, label, { ...options, category: categoryKey }),
        debug: (value: unknown, label?: string, options?: LoggerOptions) =>
            debug(value, label, { ...options, category: categoryKey }),
        registerCategory,
        configure: configureLogger,
        resetConfig: resetLoggerConfig,
        createLogger,
        registerLogMethod: <T>(
            methodName: string,
            level: LogLevel,
            defaultLabel?: string
        ): ILogger => {
            // Store method configuration
            customLogMethods.set(methodName, { level, defaultLabel });

            // Create and attach the method to this category logger
            (categoryLogger as ILogger)[methodName] = (params: T, options?: LoggerOptions) => {
                logWithLevel(level, params, defaultLabel, { ...options, category: categoryKey });
            };

            return categoryLogger;
        }
    };

    // Add any existing custom methods to this category logger
    customLogMethods.forEach(({ level, defaultLabel }, methodName) => {
        (categoryLogger as ILogger)[methodName] = (params: unknown, options?: LoggerOptions) => {
            logWithLevel(level, params, defaultLabel, { ...options, category: categoryKey });
        };
    });

    return categoryLogger;
}

/**
 * Register a new category and return a logger for that category
 * @param name - Display name for the category
 * @param key - Unique key for the category (used in env vars)
 * @param options - Category-specific options
 * @returns Logger instance for the registered category
 */
export function registerCategory(
    name: string,
    key: string,
    options: LoggerCategoryOptions
): ILogger {
    // Register the category internally
    registerCategoryInternal(name, key, options);

    // Return a logger for this category
    return createLogger(key);
}

/**
 * Reset the logger state
 * For testing purposes
 */
export function resetLogger(): void {
    resetLoggerConfig();
    clearCategories();
    customLogMethods.clear();

    // Remove all custom methods from the logger
    const knownMethods = [
        'log',
        'info',
        'warn',
        'error',
        'debug',
        'registerCategory',
        'configure',
        'resetConfig',
        'createLogger',
        'registerLogMethod'
    ];

    for (const key of Object.keys(logger)) {
        if (!knownMethods.includes(key)) {
            delete (logger as Record<string, unknown>)[key];
        }
    }

    // Ensure DEFAULT category is available after reset
    registerDefaultCategory();
}

/**
 * Main logger instance
 */
export const logger: ILogger = {
    log,
    info,
    warn,
    error,
    debug,
    registerCategory,
    configure: configureLogger,
    resetConfig: resetLoggerConfig,
    createLogger,
    registerLogMethod: <T>(methodName: string, level: LogLevel, defaultLabel?: string): ILogger => {
        return registerCustomLogMethod<T>(methodName, level, defaultLabel);
    },
    getConfig: getConfig
};
