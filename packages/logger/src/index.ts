/**
 * Logger module for centralized logging across the application
 * @module logger
 */

import chalk from 'chalk';
import dotenv from 'dotenv';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../../../');

dotenv.config({ path: path.join(monorepoRoot, '.env') });
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

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
    /**
     * Minimum log level to display
     */
    minLevel: LogLevel;

    /**
     * Whether to include timestamps in logs
     */
    includeTimestamps: boolean;

    /**
     * Whether to include log level in logs
     */
    includeLevel: boolean;

    /**
     * Whether to use colors in logs
     */
    useColors: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
    minLevel: LogLevel.INFO,
    includeTimestamps: true,
    includeLevel: true,
    useColors: true
};

/**
 * Current logger configuration
 */
let currentConfig: LoggerConfig = loadConfigFromEnv();

/**
 * Load configuration from environment variables
 * @returns Logger configuration
 */
function loadConfigFromEnv(): LoggerConfig {
    const config = { ...defaultConfig };

    // Load log level from environment variable
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLogLevel && Object.values(LogLevel).includes(envLogLevel as LogLevel)) {
        config.minLevel = envLogLevel as LogLevel;
    }

    // Load other configuration options from environment variables
    if (process.env.LOG_INCLUDE_TIMESTAMPS === 'false') {
        config.includeTimestamps = false;
    }

    if (process.env.LOG_INCLUDE_LEVEL === 'false') {
        config.includeLevel = false;
    }

    if (process.env.LOG_USE_COLORS === 'false') {
        config.useColors = false;
    }

    return config;
}

/**
 * Configure the logger
 * @param config - Logger configuration
 */
export function configure(config: Partial<LoggerConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

/**
 * Reset logger configuration to defaults
 */
export function resetConfig(): void {
    currentConfig = loadConfigFromEnv();
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

    if (currentConfig.includeTimestamps) {
        const timestamp = new Date().toISOString();
        parts.push(currentConfig.useColors ? chalk.gray(`[${timestamp}]`) : `[${timestamp}]`);
    }

    if (currentConfig.includeLevel) {
        const levelText = `[${level}]`;
        parts.push(currentConfig.useColors ? levelColors[level](levelText) : levelText);
    }

    if (label) {
        const labelText = `[${label}]`;
        parts.push(currentConfig.useColors ? chalk.cyan(labelText) : labelText);
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
    const levels = Object.values(LogLevel);
    const minLevelIndex = levels.indexOf(currentConfig.minLevel);
    const currentLevelIndex = levels.indexOf(level);

    return currentLevelIndex >= minLevelIndex;
}

/**
 * Log a standard message
 * @param message - Log message
 * @param label - Optional label/title
 * @param args - Additional arguments
 */
export function log(message: string, label?: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.LOG)) {
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log(formatLogMessage(LogLevel.LOG, message, label), ...args);
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
        debug: (message: string, ...args: unknown[]) => debug(message, label, ...args)
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
    configure,
    resetConfig,
    createLogger
};

export default logger;
