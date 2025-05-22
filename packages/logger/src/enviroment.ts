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

    let level = getLogLevelEnv(`${prefix}LEVEL`);
    if (!level) {
        level = getLogLevelEnv('LOG_LEVEL');
        if (!level) {
            level = 'WARN' as LogLevelType;
        }
    }
    let shouldSave = getBooleanEnv(`${prefix}SAVE`);
    if (shouldSave === null) {
        shouldSave = getBooleanEnv('LOG_SAVE');
        if (shouldSave === null) {
            shouldSave = false;
        }
    }
    let expandObjectLevels = getNumberEnv(`${prefix}EXPAND_OBJECT_LEVELS`);
    if (expandObjectLevels === null) {
        expandObjectLevels = getNumberEnv(`${prefix}EXPAND_OBJECT_LEVELS`);
        if (expandObjectLevels === null) {
            expandObjectLevels = 2;
        }
    }
    let truncateLongText = getBooleanEnv(`${prefix}TRUNCATE_LONG_TEXT`);
    if (truncateLongText === null) {
        truncateLongText = getBooleanEnv(`${prefix}TRUNCATE_LONG_TEXT`);
        if (truncateLongText === null) {
            truncateLongText = true;
        }
    }
    let truncateLongTextAt = getNumberEnv(`${prefix}TRUNCATE_LONG_TEXT_AT`);
    if (truncateLongTextAt === null) {
        truncateLongTextAt = getNumberEnv(`${prefix}TRUNCATE_LONG_TEXT_AT`);
        if (truncateLongTextAt === null) {
            truncateLongTextAt = 100;
        }
    }

    let stringifyObjects = getBooleanEnv(`${prefix}STRINGIFY_OBJECTS`);
    if (stringifyObjects === null) {
        stringifyObjects = getBooleanEnv(`${prefix}STRINGIFY_OBJECT`);
        if (stringifyObjects === null) {
            stringifyObjects = true;
        }
    }

    return {
        LEVEL: level,
        SAVE: shouldSave,
        EXPAND_OBJECT_LEVELS: expandObjectLevels,
        TRUNCATE_LONG_TEXT: truncateLongText,
        TRUNCATE_LONG_TEXT_AT: truncateLongTextAt,
        STRINGIFY_OBJECTS: stringifyObjects
    };
}
