/**
 * This module configures and extends the base logger for admin specific logging.
 * It provides a standardized logging interface for the admin application with
 * appropriate categorization and formatting.
 */

// import logger, { type ILogger, LoggerColors } from '@repo/logger';

// /**
//  * Admin-specific logger instance with proper categorization and styling.
//  * Uses cyan color to distinguish admin logs from other application logs.
//  */
// const adminLogger = logger.registerCategory('ADMIN', 'ADMIN', {
//     color: LoggerColors.CYAN_BRIGHT,
//     truncateLongText: true,
//     truncateLongTextAt: 500,
//     save: false,
//     expandObjectLevels: 2,
//     stringifyObj: false
// });

// /**
//  * Typed admin logger for use throughout the admin application.
//  * Provides all standard logging methods (log, info, warn, error, debug)
//  * with admin-specific categorization.
//  */
// export { adminLogger };
// export type { ILogger as AdminLogger };

const adminLogger = {
    log: (value?: unknown, label?: string) => {
        if (label) {
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(
                `%c[ADMIN] ${label ?? ''}`,
                'color: #000000; background-color: #00ff00; font-weight: bold; padding: 1px 5px;',
                value
            );
        } else {
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(
                `%c[ADMIN] ${value ?? ''}`,
                'color: #000000; background-color: #00ff00; font-weight: bold; padding: 1px 5px;'
            );
        }
    },
    info: (value?: unknown, label?: string) => {
        if (label) {
            console.info(
                `%c[ADMIN] ${label ?? ''}`,
                'color: #000000; background-color: #0006ba; font-weight: bold; padding: 1px 5px; color: #ffffff;',
                value
            );
        } else {
            console.info(
                `%c[ADMIN] ${value ?? ''}`,
                'color: #000000; background-color: #0006ba; font-weight: bold; padding: 1px 5px; color: #ffffff;'
            );
        }
    },
    warn: (value?: unknown, label?: string) => {
        if (label) {
            console.warn(
                `%c[ADMIN] ${label ?? ''}`,
                'color: #000000; background-color: #fbf600; font-weight: bold; padding: 1px 5px;',
                value
            );
        } else {
            console.warn(
                `%c[ADMIN] ${value ?? ''}`,
                'color: #000000; background-color: #fbf600; font-weight: bold; padding: 1px 5px;'
            );
        }
    },
    error: (value?: unknown, label?: string) => {
        if (label) {
            console.error(
                `%c[ADMIN] ${label ?? ''}`,
                'color: #000000; background-color: #ff0000; font-weight: bold; padding: 1px 5px;',
                value
            );
        } else {
            console.error(
                `%c[ADMIN] ${value ?? ''}`,
                'color: #000000; background-color: #ff0000; font-weight: bold; padding: 1px 5px;'
            );
        }
    },
    debug: (value?: unknown, label?: string) => {
        if (label) {
            console.debug(
                `%c[ADMIN] ${label ?? ''}`,
                'color: #000000; background-color: #ff00ee; font-weight: bold; padding: 1px 5px;',
                value
            );
        } else {
            console.debug(
                `%c[ADMIN] ${value ?? ''}`,
                'color: #000000; background-color: #ff00ee; font-weight: bold; padding: 1px 5px;'
            );
        }
    }
};

export { adminLogger };
