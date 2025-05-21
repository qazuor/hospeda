/**
 * Types for the logger package
 * @module logger/types
 */

/**
 * Available colors for logger categories
 * These represent the colors available in chalk
 */
export enum LoggerColors {
    BLACK = 'BLACK',
    RED = 'RED',
    GREEN = 'GREEN',
    YELLOW = 'YELLOW',
    BLUE = 'BLUE',
    MAGENTA = 'MAGENTA',
    CYAN = 'CYAN',
    WHITE = 'WHITE',
    GRAY = 'GRAY',
    BLACK_BRIGHT = 'BLACK_BRIGHT',
    RED_BRIGHT = 'RED_BRIGHT',
    GREEN_BRIGHT = 'GREEN_BRIGHT',
    YELLOW_BRIGHT = 'YELLOW_BRIGHT',
    BLUE_BRIGHT = 'BLUE_BRIGHT',
    MAGENTA_BRIGHT = 'MAGENTA_BRIGHT',
    CYAN_BRIGHT = 'CYAN_BRIGHT',
    WHITE_BRIGHT = 'WHITE_BRIGHT'
}

export type LoggerColorType = keyof typeof LoggerColors;

/**
 * Log level enum
 */
export enum LogLevel {
    LOG = 'LOG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

export type LogLevelType = keyof typeof LogLevel;

/**
 * Base logger configuration interface
 */
export interface BaseLoggerConfig {
    /**
     * Minimum log level to display
     */
    LEVEL: LogLevelType;

    /**
     * Whether to include timestamps in logs
     */
    INCLUDE_TIMESTAMPS: boolean;

    /**
     * Whether to include log level in logs
     */
    INCLUDE_LEVEL: boolean;

    /**
     * Whether to use colors in logs
     */
    USE_COLORS: boolean;

    /**
     * Whether to save logs to a file
     */
    SAVE: boolean;

    /**
     * How many levels to expand objects in logs
     * -1 = expand all levels
     * 0 = don't expand (show [Object])
     * n = expand n levels
     */
    EXPAND_OBJECT_LEVELS: number;

    /**
     * Whether to truncate long text
     */
    TRUNCATE_LONG_TEXT: boolean;

    /**
     * At what length to truncate text
     */
    TRUNCATE_LONG_TEXT_AT: number;
}

/**
 * Logger configuration with optional properties for partial updates
 */
export type LoggerConfig = Partial<BaseLoggerConfig>;

/**
 * Options for a specific logger category
 */
export interface LoggerCategoryOptions {
    /**
     * Color to use for the category
     */
    color: LoggerColorType;

    /**
     * Whether to save logs from this category to a file
     */
    save?: boolean;

    /**
     * How many levels to expand objects in logs for this category
     */
    expandObjectLevels?: number;

    /**
     * Whether to truncate long text for this category
     */
    truncateLongText?: boolean;

    /**
     * At what length to truncate text for this category
     */
    truncateLongTextAt?: number;

    /**
     * Minimum log level for this category
     */
    level?: LogLevelType;
}

/**
 * Options for a specific log entry
 */
export interface LoggerOptions {
    /**
     * Category for this log
     */
    category?: string;

    /**
     * Override the log level for this entry
     */
    level?: LogLevelType;

    /**
     * Force debug output for this entry
     */
    debug?: boolean;

    /**
     * Whether to save this log entry to a file
     */
    save?: boolean;

    /**
     * How many levels to expand objects in this log entry
     */
    expandObjectLevels?: number;

    /**
     * Whether to truncate long text for this entry
     */
    truncateLongText?: boolean;

    /**
     * At what length to truncate text for this entry
     */
    truncateLongTextAt?: number;
}

/**
 * Logger category information
 */
export interface LoggerCategory {
    /**
     * Name of the category
     */
    name: string;

    /**
     * Unique key for the category (used in environment variables)
     */
    key: string;

    /**
     * Category-specific options
     */
    options: LoggerCategoryOptions;
}

/**
 * Logger interface with all methods
 */
export interface ILogger {
    /**
     * Log a standard message
     * @param value - Value to log
     * @param label - Optional label/title
     * @param options - Optional logging options
     */
    log(value: unknown, label?: string, options?: LoggerOptions): void;

    /**
     * Log an informational message
     * @param value - Value to log
     * @param label - Optional label/title
     * @param options - Optional logging options
     */
    info(value: unknown, label?: string, options?: LoggerOptions): void;

    /**
     * Log a warning message
     * @param value - Value to log
     * @param label - Optional label/title
     * @param options - Optional logging options
     */
    warn(value: unknown, label?: string, options?: LoggerOptions): void;

    /**
     * Log an error message
     * @param value - Value to log
     * @param label - Optional label/title
     * @param options - Optional logging options
     */
    error(value: unknown, label?: string, options?: LoggerOptions): void;

    /**
     * Log a debug message
     * @param value - Value to log
     * @param label - Optional label/title
     * @param options - Optional logging options
     */
    debug(value: unknown, label?: string, options?: LoggerOptions): void;

    /**
     * Register a new category for logging and return a logger for that category
     * @param name - Display name for the category
     * @param key - Unique key for the category (used in env vars)
     * @param options - Category-specific options
     * @returns Logger instance for the registered category
     */
    registerCategory(name: string, key: string, options: LoggerCategoryOptions): ILogger;

    /**
     * Configure the logger
     * @param config - Logger configuration
     */
    configure(config: LoggerConfig): void;

    /**
     * Reset logger configuration to defaults
     */
    resetConfig(): void;

    /**
     * Create a logger with a predefined category
     * @param categoryKey - Key of the category to use
     * @returns Logger with predefined category
     * @deprecated Use registerCategory instead which returns a logger
     */
    createLogger(categoryKey: string): ILogger;
}
