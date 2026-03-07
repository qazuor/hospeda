/**
 * Frontend logger for the Hospeda web application.
 * Provides styled console output with category prefix for easy filtering.
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
    readonly category: string;
    readonly bgColor: string;
    readonly textColor?: string;
    readonly enabled?: boolean;
}

/**
 * Creates a frontend logger with styled console output.
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
 * Hospeda web logger instance.
 */
export const webLogger = createFrontendLogger({
    category: 'HOSPEDA-WEB',
    bgColor: '#3b82f6',
    textColor: '#ffffff',
    enabled: import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_LOGGING === 'true'
});
