/**
 * Configuration management for logger
 * @module logger/config
 */

import { getConfigFromEnv } from './enviroment.js';
import { type BaseLoggerConfig, LogLevel, type LoggerConfig } from './types.js';

/**
 * Default logger configuration
 */
export const defaultConfig: BaseLoggerConfig = {
    LEVEL: LogLevel.WARN,
    INCLUDE_TIMESTAMPS: true,
    INCLUDE_LEVEL: true,
    USE_COLORS: true,
    SAVE: false,
    EXPAND_OBJECT_LEVELS: 2,
    TRUNCATE_LONG_TEXT: true,
    TRUNCATE_LONG_TEXT_AT: 100,
    STRINGIFY_OBJECTS: true
};

/**
 * Current logger configuration
 */
let currentConfig: BaseLoggerConfig = { ...defaultConfig };

/**
 * Initialize configuration with environment variables
 */
export function initConfig(): void {
    const envConfig = getConfigFromEnv();
    currentConfig = {
        ...defaultConfig,
        ...envConfig
    };
}

/**
 * Configure the logger
 * @param config - Logger configuration
 */
export function configureLogger(config: LoggerConfig): void {
    currentConfig = {
        ...currentConfig,
        ...config
    };
}

/**
 * Reset logger configuration to defaults
 */
export function resetLoggerConfig(): void {
    currentConfig = { ...defaultConfig };
    initConfig();
}

/**
 * Get the current logger configuration
 * @returns Current logger configuration
 */
export function getConfig(): BaseLoggerConfig {
    return { ...currentConfig };
}

// Initialize configuration with environment variables
initConfig();
