/**
 * Centralized logging utility for TODO-Linear system
 */

import chalk from 'chalk';

/**
 * Log levels for controlling output verbosity
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    VERBOSE = 4
}

/**
 * Logger configuration
 */
interface LoggerConfig {
    level: LogLevel;
    prefix?: string;
    timestamp?: boolean;
}

/**
 * Centralized logger for the TODO-Linear system
 */
class Logger {
    private config: LoggerConfig;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: LogLevel.INFO,
            prefix: '',
            timestamp: false,
            ...config
        };
    }

    /**
     * Sets the log level
     */
    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    /**
     * Sets the logger prefix
     */
    setPrefix(prefix: string): void {
        this.config.prefix = prefix;
    }

    /**
     * Enables or disables timestamps
     */
    setTimestamp(enabled: boolean): void {
        this.config.timestamp = enabled;
    }

    /**
     * Formats a log message with optional timestamp and prefix
     */
    private formatMessage(level: string, message: string): string {
        let formatted = message;

        if (this.config.prefix) {
            formatted = `[${this.config.prefix}] ${formatted}`;
        }

        if (this.config.timestamp) {
            const timestamp = new Date().toISOString();
            formatted = `${timestamp} ${level} ${formatted}`;
        }

        return formatted;
    }

    /**
     * Checks if a log level should be output
     */
    private shouldLog(level: LogLevel): boolean {
        return level <= this.config.level;
    }

    /**
     * Error logging - always shown
     */
    error(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const formatted = this.formatMessage('ERROR', message);
            console.error(chalk.red(formatted), ...args);
        }
    }

    /**
     * Warning logging
     */
    warn(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            const formatted = this.formatMessage('WARN', message);
            console.warn(chalk.yellow(formatted), ...args);
        }
    }

    /**
     * Info logging - general information
     */
    info(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formatted = this.formatMessage('INFO', message);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(chalk.white(formatted), ...args);
        }
    }

    /**
     * Success logging - positive outcomes
     */
    success(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formatted = this.formatMessage('SUCCESS', message);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(chalk.green(formatted), ...args);
        }
    }

    /**
     * Debug logging - detailed information
     */
    debug(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formatted = this.formatMessage('DEBUG', message);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(chalk.gray(formatted), ...args);
        }
    }

    /**
     * Verbose logging - very detailed information
     */
    verbose(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.VERBOSE)) {
            const formatted = this.formatMessage('VERBOSE', message);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(chalk.dim(formatted), ...args);
        }
    }

    /**
     * Progress logging - for showing progress indicators
     */
    progress(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formatted = this.formatMessage('PROGRESS', message);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(chalk.blue(formatted), ...args);
        }
    }

    /**
     * Step logging - for showing process steps
     */
    step(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formatted = this.formatMessage('STEP', message);
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(chalk.cyan(formatted), ...args);
        }
    }

    /**
     * Raw console.log without formatting (for special cases)
     */
    raw(...args: unknown[]): void {
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log(...args);
    }

    /**
     * AI-specific warning logging with warning icon and yellow color
     */
    aiWarn(message: string, ...args: unknown[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            const formatted = this.formatMessage('WARN', `⚠️  ${message}`);
            console.warn(chalk.yellow(formatted), ...args);
        }
    }

    /**
     * Creates a child logger with a specific prefix
     */
    child(prefix: string): Logger {
        const childPrefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix;

        return new Logger({
            ...this.config,
            prefix: childPrefix
        });
    }
}

// Create default logger instance
const defaultLogger = new Logger();

// Export the default logger and class
export { Logger };
export default defaultLogger;

// Convenience exports for common logging functions
export const {
    error,
    warn,
    info,
    success,
    debug,
    verbose,
    progress,
    step,
    raw,
    aiWarn,
    setLevel,
    setPrefix,
    setTimestamp,
    child
} = defaultLogger;
