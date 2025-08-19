/**
 * This module configures and extends the base logger for admin specific logging.
 * It provides a standardized logging interface for the admin application with
 * appropriate categorization and formatting.
 */

import logger, { type ILogger, LoggerColors } from '@repo/logger';

/**
 * Admin-specific logger instance with proper categorization and styling.
 * Uses cyan color to distinguish admin logs from other application logs.
 */
const adminLogger = logger.registerCategory('ADMIN', 'ADMIN', {
    color: LoggerColors.CYAN_BRIGHT,
    truncateLongText: true,
    truncateLongTextAt: 500,
    save: false,
    expandObjectLevels: 2,
    stringifyObj: false
});

/**
 * Typed admin logger for use throughout the admin application.
 * Provides all standard logging methods (log, info, warn, error, debug)
 * with admin-specific categorization.
 */
export { adminLogger };
export type { ILogger as AdminLogger };
