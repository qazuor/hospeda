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

    /**
     * Whether to stringify objects
     */
    STRINGIFY_OBJECTS: boolean;
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

    /**
     * Whether to stringify objects for this category
     */
    stringifyObj?: boolean;
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

    /**
     * Whether to stringify objects for this entry
     */
    stringifyObj?: boolean;
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
 * Type for custom logger methods
 * @template T The type of parameters the custom logger accepts
 */
export type CustomLoggerMethod<T> = (params: T, options?: LoggerOptions) => void;

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

    /**
     * Register a custom logger method
     * @template T The type of parameters the custom logger accepts
     * @param methodName - Name of the custom logger method
     * @param level - Log level to use for this method
     * @param defaultLabel - Default label to use for this method (optional)
     * @returns The logger instance for chaining
     *
     * @example
     * ```typescript
     * interface QueryParams {
     *   table: string;
     *   action: string;
     *   params: Record<string, unknown>;
     *   result: unknown;
     * }
     *
     * // Register the query method on the dbLogger
     * dbLogger.registerLogMethod<QueryParams>('query', LogLevel.INFO, 'SQL');
     *
     * // Use the custom method
     * dbLogger.query({
     *   table: 'users',
     *   action: 'insert',
     *   params: { name: 'John' },
     *   result: { id: 1, name: 'John' }
     * });
     * ```
     */
    registerLogMethod<_T>(methodName: string, level: LogLevel, defaultLabel?: string): ILogger;

    /**
     * Dynamic property access for custom logger methods
     */
    [key: string]: unknown;
}
