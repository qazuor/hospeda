/**
 * This module configures and extends the base logger for api specific logging.
 * It introduces a custom `permission` log method to standardize how access control
 * checks are recorded throughout the api application.
 *
 * NOTE: We load dotenv here because this module executes at import time (side-effect)
 * and may run before env.ts has loaded .env.local. Without this, process.env vars
 * like API_LOG_EXPAND_OBJECTS would be undefined when registerCategory runs.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import logger, { type ILogger, LoggerColors, LogLevel } from '@repo/logger';
import { config } from 'dotenv';

// Ensure .env.local is loaded before reading env vars
const _loggerDirname = dirname(fileURLToPath(import.meta.url));
const _rootDir = resolve(_loggerDirname, '../../../..');
const _envLocal = resolve(_rootDir, '.env.local');
if (existsSync(_envLocal)) {
    config({ path: _envLocal });
}

// Safe environment access for logger initialization
const safeGetEnvBoolean = (key: string, defaultValue: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true';
};

const safeGetEnvNumber = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? defaultValue : parsed;
};

const apiLogger = logger.registerCategory('API', 'API', {
    color: LoggerColors.BLUE,
    truncateLongText: safeGetEnvBoolean('API_LOG_TRUNCATE_TEXT', true),
    truncateLongTextAt: safeGetEnvNumber('API_LOG_TRUNCATE_AT', 1000),
    save: safeGetEnvBoolean('API_LOG_SAVE', false),
    expandObjectLevels: safeGetEnvBoolean('API_LOG_EXPAND_OBJECTS', false) ? -1 : 0,
    stringifyObj: safeGetEnvBoolean('API_LOG_STRINGIFY', false)
});

/**
 * Defines the structure for parameters passed to the custom 'permission' log method.
 */
interface PermissionValidationParams {
    /** The permission string being validated (e.g., 'ACCOMMODATION_CREATE_ANY'). */
    permission: string;
    /** The ID of the user whose permission is being checked. */
    userId: string;
    /** The role of the user. */
    role: string;
    /** Any additional data relevant to the permission check. */
    extraData: unknown;
}
apiLogger.registerLogMethod<PermissionValidationParams>('permission', LogLevel.INFO, 'Permission');

/**
 * Extends the base `ILogger` interface with a service-specific `permission` method.
 */
type ApiLogger = ILogger & {
    /**
     * Logs a permission validation event.
     * @param params - An object containing details about the permission check.
     */
    permission: (params: PermissionValidationParams) => void;
};

/**
 * This cast is safe and necessary to extend the logger instance with a custom 'permission' method
 * for service-level permission logging. The base logger does not include this method, but our
 * service logging infrastructure expects it. This approach allows us to add the method while
 * preserving the base logger's type safety for all other methods. The extended logger is then
 * exported for use throughout the service layer.
 */
const typedApiLogger = apiLogger as unknown as ApiLogger;

export { typedApiLogger as apiLogger };
export type { ApiLogger };
