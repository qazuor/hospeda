/**
 * Frontend logger for the auth-ui package.
 * Provides a centralized logging interface that wraps console methods.
 * This allows future enhancements like:
 * - Sending logs to external services
 * - Filtering logs based on environment
 * - Adding metadata to all logs
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

/**
 * Creates a log method that wraps console with styled output
 */
const createLogMethod = (level: LogLevel, category: string, style: string) => {
    return (message: string, data?: unknown) => {
        const consoleMethod = console[level] ?? console.log;

        if (data !== undefined) {
            consoleMethod(`%c[${category}] ${message}`, style, data);
        } else {
            consoleMethod(`%c[${category}] ${message}`, style);
        }
    };
};

const AUTH_CATEGORY = 'AUTH';
const AUTH_STYLE =
    'color: #ffffff; background-color: #8b5cf6; font-weight: bold; padding: 1px 5px;';

/**
 * Auth UI logger instance.
 * Uses purple color to distinguish auth-related logs.
 */
export const authLogger = {
    log: createLogMethod('log', AUTH_CATEGORY, AUTH_STYLE),
    info: createLogMethod('info', AUTH_CATEGORY, AUTH_STYLE),
    warn: createLogMethod('warn', AUTH_CATEGORY, AUTH_STYLE),
    error: createLogMethod('error', AUTH_CATEGORY, AUTH_STYLE),
    debug: createLogMethod('debug', AUTH_CATEGORY, AUTH_STYLE)
};
