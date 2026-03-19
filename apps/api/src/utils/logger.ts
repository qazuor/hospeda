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

// Ensure .env.local is loaded before reading env vars.
// Per-app env strategy (SPEC-035): read from apps/api/.env.local, not the monorepo root.
const _loggerDirname = dirname(fileURLToPath(import.meta.url));
const _appDir = resolve(_loggerDirname, '../../..');
const _envLocal = resolve(_appDir, '.env.local');
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
 * This cast is safe and necessary because `registerLogMethod` adds the `permission` method to
 * the logger instance at runtime, but TypeScript cannot infer the specific method signature
 * from the dynamic `[key: string]: unknown` index on `ILogger`. The cast through `unknown`
 * is required since `ILogger` and `ApiLogger` are not directly assignable.
 */
const typedApiLogger = apiLogger as unknown as ApiLogger;

/**
 * Dedicated logger for the addon lifecycle subsystem.
 *
 * Registered under the `ADDON_LIFECYCLE` category key so it can be filtered
 * independently via the `ADDON_LIFECYCLE_LOG_LEVEL` environment variable.
 *
 * @example
 * ```ts
 * import { addonLogger } from '../utils/logger';
 * addonLogger.info({ customerId, addonSlug }, 'Addon purchased');
 * ```
 */
const addonLogger = logger.registerCategory('ADDON-LIFECYCLE', 'ADDON_LIFECYCLE', {
    color: LoggerColors.CYAN,
    truncateLongText: safeGetEnvBoolean('ADDON_LIFECYCLE_LOG_TRUNCATE_TEXT', true),
    truncateLongTextAt: safeGetEnvNumber('ADDON_LIFECYCLE_LOG_TRUNCATE_AT', 1000),
    save: safeGetEnvBoolean('ADDON_LIFECYCLE_LOG_SAVE', false),
    expandObjectLevels: safeGetEnvBoolean('ADDON_LIFECYCLE_LOG_EXPAND_OBJECTS', false) ? -1 : 0,
    stringifyObj: safeGetEnvBoolean('ADDON_LIFECYCLE_LOG_STRINGIFY', false)
});

export { typedApiLogger as apiLogger, addonLogger };
export type { ApiLogger };
