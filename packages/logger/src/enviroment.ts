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
export function getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }

    return value.toLowerCase() === 'true';
}

/**
 * Get a number value from an environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Number value
 */
export function getNumberEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a log level from an environment variable
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Log level
 */
export function getLogLevelEnv(key: string, defaultValue: LogLevelType): LogLevelType {
    const value = process.env[key]?.toUpperCase();
    if (!value) {
        return defaultValue;
    }

    return Object.keys(LogLevel).includes(value) ? (value as LogLevelType) : defaultValue;
}

/**
 * Get configuration from environment variables
 * @param categoryKey - Optional category key to get specific configuration
 * @returns Partial configuration from environment
 */
export function getConfigFromEnv(categoryKey?: string): Partial<BaseLoggerConfig> {
    const prefix = categoryKey ? `LOG_${categoryKey}_` : 'LOG_';

    return {
        LEVEL: getLogLevelEnv(`${prefix}LEVEL`, 'WARN' as LogLevelType),
        SAVE: getBooleanEnv(`${prefix}SAVE`, false),
        EXPAND_OBJECT_LEVELS: getNumberEnv(`${prefix}EXPAND_OBJECT_LEVELS`, 2),
        TRUNCATE_LONG_TEXT: getBooleanEnv(`${prefix}TRUNCATE_LONG_TEXT`, true),
        TRUNCATE_LONG_TEXT_AT: getNumberEnv(`${prefix}TRUNCATE_LONG_TEXT_AT`, 100)
    };
}
