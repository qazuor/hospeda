/**
 * Core logging functionality
 * @module logger/logger
 */

import { clearCategories, getCategoryByKey, registerCategoryInternal } from './categories.js';
import { configureLogger, getConfig, resetLoggerConfig } from './config.js';
import { formatLogMessage } from './formatter.js';
import {
    type ILogger,
    LogLevel,
    type LogLevelType,
    type LoggerCategoryOptions,
    type LoggerOptions
} from './types.js';

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

    const levels = Object.values(LogLevel) as LogLevelType[];
    const configLevelIndex = levels.indexOf(configLevel);
    const currentLevelIndex = levels.indexOf(level);

    return currentLevelIndex >= configLevelIndex;
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

    const formattedMessage = formatLogMessage(level, value, label, options);

    // Log to console based on level
    switch (level) {
        case LogLevel.LOG:
            // biome-ignore lint/suspicious/noConsoleLog: Log method needs to use console.log
            console.log(formattedMessage);
            break;
        case LogLevel.INFO:
            console.info(formattedMessage);
            break;
        case LogLevel.WARN:
            console.warn(formattedMessage);
            break;
        case LogLevel.ERROR:
            console.error(formattedMessage);
            break;
        case LogLevel.DEBUG:
            console.debug(formattedMessage);
            break;
    }

    // TODO: Implement file logging if save is enabled
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
 * Create a logger with a predefined category
 * @param categoryKey - Key of the category to use
 * @returns Logger with predefined category
 */
export function createLogger(categoryKey: string): ILogger {
    return {
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
        createLogger
    };
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
    createLogger
};
