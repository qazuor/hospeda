/**
 * Frontend logger for the web application.
 * Provides a centralized logging interface that wraps console methods.
 * This allows future enhancements like:
 * - Sending logs to external services (Sentry, LogRocket, etc.)
 * - Filtering logs based on environment
 * - Adding metadata to all logs
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
    /** Category name shown in logs */
    category: string;
    /** Background color for the category badge */
    bgColor: string;
    /** Text color for the category badge */
    textColor?: string;
    /** Enable/disable logging (useful for production) */
    enabled?: boolean;
}

/**
 * Creates a frontend logger with styled console output
 */
function createFrontendLogger(options: LoggerOptions) {
    const { category, bgColor, textColor = '#000000', enabled = true } = options;

    const style = `color: ${textColor}; background-color: ${bgColor}; font-weight: bold; padding: 1px 5px;`;

    const createLogMethod = (level: LogLevel) => {
        return (message: string, data?: unknown) => {
            if (!enabled) return;

            const consoleMethod = console[level] ?? console.log;

            if (data !== undefined) {
                consoleMethod(`%c[${category}] ${message}`, style, data);
            } else {
                consoleMethod(`%c[${category}] ${message}`, style);
            }
        };
    };

    return {
        log: createLogMethod('log'),
        info: createLogMethod('info'),
        warn: createLogMethod('warn'),
        error: createLogMethod('error'),
        debug: createLogMethod('debug')
    };
}

/**
 * Web application logger instance.
 * Uses blue color to distinguish from other app logs.
 */
export const webLogger = createFrontendLogger({
    category: 'WEB',
    bgColor: '#3b82f6',
    textColor: '#ffffff',
    enabled: import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_LOGGING === 'true'
});

export { createFrontendLogger };
export type { LoggerOptions };
