/**
 * Logger module for centralized logging across the application
 * @module logger
 */

import chalk from 'chalk';
/**
 * Log levels enum
 */
export enum LogLevel {
    LOG = 'LOG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

export type LogLevelType = keyof typeof LogLevel;

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
    /**
     * Minimum log level to display
     */
    LEVEL: LogLevelType;

    /**
     * Whether to include timestamps in logs
     */
    INCLUDE_TIMESTAMPS: boolean;

    /**
     * Whether to include log level in logs
     */
    INCLUDE_LEVEL: boolean;

    /**
     * Whether to use colors in logs
     */
    USE_COLORS: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
    LEVEL: LogLevel.INFO,
    INCLUDE_TIMESTAMPS: true,
    INCLUDE_LEVEL: true,
    USE_COLORS: true
};

/**
 * Current logger configuration
 */
let currentConfig: LoggerConfig = defaultConfig;

/**
 * Configure the logger
 * @param config - Logger configuration
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    currentConfig = {
        ...defaultConfig,
        ...currentConfig,
        ...config
    };
}

/**
 * Reset logger configuration to defaults
 */
export function resetLoggerConfig(): void {
    currentConfig = defaultConfig;
}

/**
 * Color mapping for log levels
 */
const levelColors = {
    [LogLevel.LOG]: chalk.black.bgWhite.bold,
    [LogLevel.INFO]: chalk.black.bgCyan.bold,
    [LogLevel.WARN]: chalk.black.bgYellow.bold,
    [LogLevel.ERROR]: chalk.black.bgRed.bold,
    [LogLevel.DEBUG]: chalk.black.bgMagenta.bold
};

/**
 * Format a log message
 * @param level - Log level
 * @param message - Log message
 * @param label - Optional label/title
 * @returns Formatted log message
 */
function formatLogMessage(level: LogLevel, message: string, label?: string): string {
    const parts: string[] = [];

    if (currentConfig.INCLUDE_TIMESTAMPS) {
        const timestamp = new Date().toISOString();
        parts.push(currentConfig.USE_COLORS ? chalk.gray(`[${timestamp}]`) : `[${timestamp}]`);
    }

    if (currentConfig.INCLUDE_LEVEL) {
        const levelText = `[${level}]`;
        parts.push(currentConfig.USE_COLORS ? levelColors[level](levelText) : levelText);
    }

    if (label) {
        const labelText = `[${label}]`;
        parts.push(currentConfig.USE_COLORS ? chalk.cyan(labelText) : labelText);
    }

    parts.push(message);

    return parts.join(' ');
}

/**
 * Check if a log level should be displayed
 * @param level - Log level to check
 * @returns Whether the log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel) as LogLevelType[];
    const LEVELIndex = levels.indexOf(currentConfig.LEVEL);
    const currentLevelIndex = levels.indexOf(level);

    return currentLevelIndex >= LEVELIndex;
}

/**
 * Log a standard message
 * @param message - Log message
 * @param label - Optional label/title
 * @param args - Additional arguments
 */
export function log(message: string, label?: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.LOG)) {
        if (label) {
            const parts: string[] = [];
            if (currentConfig.INCLUDE_TIMESTAMPS) {
                const timestamp = new Date().toISOString();
                parts.push(
                    currentConfig.USE_COLORS ? chalk.gray(`[${timestamp}]`) : `[${timestamp}]`
                );
            }

            if (currentConfig.INCLUDE_LEVEL) {
                const levelText = `[${LogLevel.LOG}]`;
                parts.push(
                    currentConfig.USE_COLORS ? levelColors[LogLevel.LOG](levelText) : levelText
                );
            }

            parts.push(currentConfig.USE_COLORS ? chalk.cyan(label) : label);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(parts.join(' '), message, ...args);
            return;
        }
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log(message, ...args);
    }
}

/**
 * Log an informational message
 * @param message - Log message
 * @param label - Optional label/title
 * @param args - Additional arguments
 */
export function info(message: string, label?: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.INFO)) {
        console.info(formatLogMessage(LogLevel.INFO, message, label), ...args);
    }
}

/**
 * Log a warning message
 * @param message - Log message
 * @param label - Optional label/title
 * @param args - Additional arguments
 */
export function warn(message: string, label?: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.WARN)) {
        console.warn(formatLogMessage(LogLevel.WARN, message, label), ...args);
    }
}

/**
 * Log an error message
 * @param message - Log message
 * @param label - Optional label/title
 * @param args - Additional arguments
 */
export function error(message: string, label?: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.ERROR)) {
        console.error(formatLogMessage(LogLevel.ERROR, message, label), ...args);
    }
}

/**
 * Log a debug message
 * @param message - Log message
 * @param label - Optional label/title
 * @param args - Additional arguments
 */
export function debug(message: string, label?: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.DEBUG)) {
        console.debug(formatLogMessage(LogLevel.DEBUG, message, label), ...args);
    }
}

/**
 * Log a DB query with JSON-stringified params/results
 *
 * @param queryType  – e.g. 'select' | 'insert' | etc.
 * @param table      – name of the table involved
 * @param params     – any parameters you passed (will be JSON-stringified)
 * @param results    – any results you got back (will be JSON-stringified)
 */
export function query(queryType: string, table: string, params?: unknown, results?: unknown): void {
    if (!shouldLog(LogLevel.INFO)) return;

    // Safely stringify without throwing on circular refs
    const safeStringify = (obj: unknown) => {
        try {
            return JSON.stringify(obj);
        } catch {
            return String(obj);
        }
    };

    const paramStr = params !== undefined ? safeStringify(params) : '';
    const resultStr = results !== undefined ? safeStringify(results) : '';

    console.info(
        formatLogMessage(
            LogLevel.INFO,
            `params: ${paramStr}\nresults: ${resultStr}`,
            `DB:${queryType}:${table}`
        )
    );
}

/**
 * Create a logger with a predefined label
 * @param label - Label to use for all log messages
 * @returns Logger with predefined label
 */
export function createLogger(label: string) {
    return {
        log: (message: string, ...args: unknown[]) => log(message, label, ...args),
        info: (message: string, ...args: unknown[]) => info(message, label, ...args),
        warn: (message: string, ...args: unknown[]) => warn(message, label, ...args),
        error: (message: string, ...args: unknown[]) => error(message, label, ...args),
        debug: (message: string, ...args: unknown[]) => debug(message, label, ...args),
        query: (
            queryType: string,
            table: string,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            params?: Record<string, any>,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            results?: Record<string, any>
        ) => query(queryType, table, params, results)
    };
}

/**
 * Logger object with all methods
 */
export const logger = {
    log,
    info,
    warn,
    error,
    debug,
    query,
    configure: configureLogger,
    resetConfig: resetLoggerConfig,
    createLogger
};

export default logger;
