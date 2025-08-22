/**
 * Environment variable handling for logger configuration
 * @module logger/environment
 */

import { type BaseLoggerConfig, LogLevel, type LogLevelType } from './types.js';

/**
 * Get a boolean value from an environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Boolean value
 */
export function getBooleanEnv(key: string): boolean | null {
    const value = process.env[key];
    if (value === undefined) {
        return null;
    }

    return value.toLowerCase() === 'true';
}

/**
 * Get a number value from an environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Number value
 */
export function getNumberEnv(key: string): number | null {
    const value = process.env[key];
    if (value === undefined) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Get a log level from an environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Log level
 */
export function getLogLevelEnv(key: string): LogLevelType | null {
    const value = process.env[key]?.toUpperCase();
    if (!value) {
        return null;
    }
    return Object.keys(LogLevel).includes(value) ? (value as LogLevelType) : null;
}

/**
 * Get configuration from environment variables
 * @param categoryKey - Optional category key to get specific configuration
 * @returns Partial configuration from environment
 */
export function getConfigFromEnv(categoryKey?: string): Partial<BaseLoggerConfig> {
    const prefix = categoryKey && categoryKey !== 'DEFAULT' ? `LOG_${categoryKey}_` : 'LOG_';

    const result: Partial<BaseLoggerConfig> = {};

    const level = getLogLevelEnv(`${prefix}LEVEL`) ?? getLogLevelEnv('LOG_LEVEL') ?? undefined;
    if (level !== undefined) result.LEVEL = level;

    const shouldSave = getBooleanEnv(`${prefix}SAVE`) ?? getBooleanEnv('LOG_SAVE');
    if (shouldSave !== null) result.SAVE = shouldSave;

    const expandObjectLevels =
        getNumberEnv(`${prefix}EXPAND_OBJECT_LEVELS`) ?? getNumberEnv('LOG_EXPAND_OBJECT_LEVELS');
    if (expandObjectLevels !== null) result.EXPAND_OBJECT_LEVELS = expandObjectLevels;

    const truncateLongText =
        getBooleanEnv(`${prefix}TRUNCATE_LONG_TEXT`) ?? getBooleanEnv('LOG_TRUNCATE_LONG_TEXT');
    if (truncateLongText !== null) result.TRUNCATE_LONG_TEXT = truncateLongText;

    const truncateLongTextAt =
        getNumberEnv(`${prefix}TRUNCATE_LONG_TEXT_AT`) ?? getNumberEnv('LOG_TRUNCATE_LONG_TEXT_AT');
    if (truncateLongTextAt !== null) result.TRUNCATE_LONG_TEXT_AT = truncateLongTextAt;

    const truncateLongTextOnError =
        getBooleanEnv(`${prefix}TRUNCATE_LONG_TEXT_ON_ERROR`) ??
        getBooleanEnv('LOG_TRUNCATE_LONG_TEXT_ON_ERROR');
    if (truncateLongTextOnError !== null)
        result.TRUNCATE_LONG_TEXT_ON_ERROR = truncateLongTextOnError;

    const stringifyObjects =
        getBooleanEnv(`${prefix}STRINGIFY_OBJECTS`) ?? getBooleanEnv('LOG_STRINGIFY_OBJECTS');
    if (stringifyObjects !== null) result.STRINGIFY_OBJECTS = stringifyObjects;

    return result;
}
