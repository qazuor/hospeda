/**
 * Formatting utilities for logger output
 * @module logger/formatter
 */

import chalk from 'chalk';
import { getCategoryByKey } from './categories.js';
import { getConfig } from './config.js';
import { LogLevel, type LoggerColorType, type LoggerOptions } from './types.js';

// Define ChalkFunction as a function that takes a string and returns a string
type ChalkFunction = (text: string) => string;

/**
 * Icons for different log levels
 */
export const levelIcons = {
    [LogLevel.INFO]: '💡',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.DEBUG]: '🐛',
    [LogLevel.LOG]: '📝'
};

/**
 * Colors for different log levels
 */
export const levelColors = {
    [LogLevel.LOG]: chalk.white,
    [LogLevel.INFO]: chalk.cyan,
    [LogLevel.WARN]: chalk.yellow,
    [LogLevel.ERROR]: chalk.red,
    [LogLevel.DEBUG]: chalk.magenta
};

/**
 * Background colors for different log levels
 */
export const levelBgColors = {
    [LogLevel.LOG]: chalk.bgWhite,
    [LogLevel.INFO]: chalk.bgCyan,
    [LogLevel.WARN]: chalk.bgYellow,
    [LogLevel.ERROR]: chalk.bgRed,
    [LogLevel.DEBUG]: chalk.bgMagenta
};

/**
 * Map a LoggerColorType to a chalk color function
 * @param color - Color type from LoggerColors enum
 * @returns chalk color function
 */
export function getColorFunction(color: LoggerColorType): ChalkFunction {
    // Use chalk's dynamic access pattern to get the color function
    return chalk[color as keyof typeof chalk] as ChalkFunction;
}

/**
 * Format timestamp for logs
 * @returns Formatted timestamp [YYYY-MM-DD HH:MM:SS]
 */
export function formatTimestamp(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    return `[${date} ${time}]`;
}

/**
 * Format a value for logging
 * @param value - Value to format
 * @param expandLevels - How many levels to expand objects
 * @param truncateText - Whether to truncate long text
 * @param truncateAt - Length at which to truncate text
 * @returns Formatted value as string
 */
export function formatValue(
    value: unknown,
    expandLevels = 2,
    truncateText = true,
    truncateAt = 100
): string {
    // For null or undefined, just return as string
    if (value === null || value === undefined) {
        return String(value);
    }

    // For simple types, return as string
    if (typeof value !== 'object') {
        const strValue = String(value);
        if (truncateText && strValue.length > truncateAt) {
            return `${strValue.substring(0, truncateAt)}...`;
        }
        return strValue;
    }

    // For objects and arrays, handle expansion
    try {
        if (expandLevels === -1) {
            // Expand all levels
            return JSON.stringify(value, null, 2);
        }

        if (expandLevels === 0) {
            // Don't expand at all
            return '[Object]';
        }
        // Expand to specified level
        const seen = new WeakSet();
        const expandObject = (obj: unknown, level: number): unknown => {
            if (obj === null || obj === undefined || typeof obj !== 'object') {
                return obj;
            }

            // Handle circular references
            if (seen.has(obj as object)) {
                return '[Circular]';
            }
            seen.add(obj as object);

            if (level <= 0) {
                return '[Object]';
            }

            if (Array.isArray(obj)) {
                return obj.map((item) => expandObject(item, level - 1));
            }

            const result: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(obj)) {
                result[key] = expandObject(val, level - 1);
            }
            return result;
        };

        return JSON.stringify(expandObject(value, expandLevels), null, 2);
    } catch (error) {
        return `[Object: ${error instanceof Error ? error.message : 'Error stringifying'}]`;
    }
}

/**
 * Format a log message
 * @param level - Log level
 * @param value - Value to log
 * @param label - Optional label/title
 * @param options - Optional logging options
 * @returns Formatted log message
 */
export function formatLogMessage(
    level: LogLevel,
    value: unknown,
    label?: string,
    options?: LoggerOptions
): string {
    const config = getConfig();
    const useColors = config.USE_COLORS;
    const parts: string[] = [];

    // Get category if specified
    const categoryKey = options?.category || 'DEFAULT';
    const category = getCategoryByKey(categoryKey);

    // Add category if not DEFAULT
    if (categoryKey !== 'DEFAULT') {
        const categoryText = `${category.name} `;
        if (useColors) {
            // Use level color for category background and black text
            const categoryColor = levelBgColors[level].black;
            parts.push(categoryColor(categoryText));
        } else {
            parts.push(categoryText);
        }
    }

    // Add level icon
    parts.push(levelIcons[level]);

    // Add level if configured
    if (config.INCLUDE_LEVEL) {
        const levelText = `[${level}]`;
        if (useColors) {
            parts.push(levelColors[level](levelText));
        } else {
            parts.push(levelText);
        }
    }

    // Add timestamp if configured
    if (config.INCLUDE_TIMESTAMPS) {
        const timestamp = formatTimestamp();
        if (useColors) {
            parts.push(chalk.gray(timestamp));
        } else {
            parts.push(timestamp);
        }
    }

    // Add label if provided
    if (label) {
        const labelText = `[${label}]`;
        if (useColors) {
            parts.push(chalk.cyan(labelText));
        } else {
            parts.push(labelText);
        }
    }

    // Determine expand levels
    const expandLevels =
        options?.expandObjectLevels !== undefined
            ? options.expandObjectLevels
            : category.options.expandObjectLevels !== undefined
              ? category.options.expandObjectLevels
              : config.EXPAND_OBJECT_LEVELS;

    // Determine truncation settings
    const truncateText =
        options?.truncateLongText !== undefined
            ? options.truncateLongText
            : category.options.truncateLongText !== undefined
              ? category.options.truncateLongText
              : config.TRUNCATE_LONG_TEXT;

    const truncateAt =
        options?.truncateLongTextAt !== undefined
            ? options.truncateLongTextAt
            : category.options.truncateLongTextAt !== undefined
              ? category.options.truncateLongTextAt
              : config.TRUNCATE_LONG_TEXT_AT;

    // Format the value
    const formattedValue = formatValue(value, expandLevels, truncateText, truncateAt);

    // Add arrow and value
    parts.push('=>');
    parts.push(formattedValue);

    return parts.join(' ');
}
