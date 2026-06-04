/**
 * Formatting utilities for logger output
 * @module logger/formatter
 */

import chalk from 'chalk';

import { getCategoryByKey, getMaxCategoryNameLength } from './categories.js';
import { getConfig } from './config.js';
import { buildLogEntry } from './log-entry.js';
import { redactSensitiveData } from './redact.js';
import { LogFormat, LogLevel, type LoggerColorType, type LoggerOptions } from './types.js';

// `redactSensitiveData` now lives in ./redact.js (leaf module, no import cycle).
// Re-exported here for backward compatibility with existing imports.
export { redactSensitiveData };

// Define ChalkFunction as a function that takes a string and returns a string
type ChalkFunction = (text: string) => string;

/**
 * Icons for different log levels
 */
export const levelIcons = {
    [LogLevel.INFO]: '💡',
    [LogLevel.WARN]: '⚠️ ',
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
    // Map LoggerColors enum values to chalk color names
    const colorMap: Record<LoggerColorType, keyof typeof chalk> = {
        BLACK: 'black',
        RED: 'red',
        GREEN: 'green',
        YELLOW: 'yellow',
        BLUE: 'blue',
        MAGENTA: 'magenta',
        CYAN: 'cyan',
        WHITE: 'white',
        GRAY: 'gray',
        BLACK_BRIGHT: 'blackBright',
        RED_BRIGHT: 'redBright',
        GREEN_BRIGHT: 'greenBright',
        YELLOW_BRIGHT: 'yellowBright',
        BLUE_BRIGHT: 'blueBright',
        MAGENTA_BRIGHT: 'magentaBright',
        CYAN_BRIGHT: 'cyanBright',
        WHITE_BRIGHT: 'whiteBright'
    };

    const chalkColorName = colorMap[color];
    return chalk[chalkColorName] as ChalkFunction;
}

/**
 * Determine if a color needs white or black text for good contrast
 * @param color - Color type from LoggerColors enum
 * @returns true if white text should be used, false for black text
 */
export function shouldUseWhiteText(color: LoggerColorType): boolean {
    // Colors that are dark and need white text
    const darkColors: LoggerColorType[] = ['BLACK', 'RED', 'BLUE', 'MAGENTA'];

    return darkColors.includes(color);
}

/**
 * Get background color function with appropriate text color for category
 * @param color - Color type from LoggerColors enum
 * @returns chalk function that applies background color with contrasting text
 */
export function getCategoryBackgroundFunction(color: LoggerColorType): ChalkFunction {
    // Map LoggerColors enum values to chalk background color names
    const bgColorMap: Record<LoggerColorType, keyof typeof chalk> = {
        BLACK: 'bgBlack',
        RED: 'bgRed',
        GREEN: 'bgGreen',
        YELLOW: 'bgYellow',
        BLUE: 'bgBlue',
        MAGENTA: 'bgMagenta',
        CYAN: 'bgCyan',
        WHITE: 'bgWhite',
        GRAY: 'bgGray',
        BLACK_BRIGHT: 'bgBlackBright',
        RED_BRIGHT: 'bgRedBright',
        GREEN_BRIGHT: 'bgGreenBright',
        YELLOW_BRIGHT: 'bgYellowBright',
        BLUE_BRIGHT: 'bgBlueBright',
        MAGENTA_BRIGHT: 'bgMagentaBright',
        CYAN_BRIGHT: 'bgCyanBright',
        WHITE_BRIGHT: 'bgWhiteBright'
    };

    const bgColorName = bgColorMap[color];
    const useWhiteText = shouldUseWhiteText(color);

    // Create a function that applies both background and appropriate text color
    return (text: string) => {
        const bgFunction = chalk[bgColorName] as ChalkFunction;
        const textFunction = useWhiteText ? chalk.white : chalk.black;
        // Apply bold formatting to the text
        const boldTextFunction = textFunction.bold;
        return bgFunction(boldTextFunction(text));
    };
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
    truncateAt = 100,
    stringifyObj = false
): string {
    // Redact sensitive data first
    const redactedValue = redactSensitiveData(value);

    // For null or undefined, just return as string
    if (redactedValue === null || redactedValue === undefined) {
        return String(redactedValue);
    }

    // For simple types, return as string
    if (typeof redactedValue !== 'object') {
        const strValue = String(redactedValue);
        if (truncateText && strValue.length > truncateAt) {
            return `${strValue.substring(0, truncateAt)}...[TRUNCATED]`;
        }
        return strValue;
    }

    // For objects and arrays, handle expansion
    try {
        if (expandLevels === -1) {
            // Expand all levels
            return JSON.stringify(redactedValue, null, 2);
        }

        if (expandLevels === 0) {
            // Don't expand visually — serialize compactly (one line, no indent)
            // so the operator still sees the content. Returning a literal
            // '[Object]' hides information at the worst possible moment.
            try {
                return JSON.stringify(redactedValue);
            } catch {
                return Object.prototype.toString.call(redactedValue);
            }
        }
        // Expand to specified level
        const seen = new WeakSet();
        const expandObject = (obj: unknown, level: number): unknown => {
            if (obj === null || obj === undefined || typeof obj !== 'object') {
                if (typeof obj === 'string') {
                    const strValue = String(obj);
                    if (truncateText && strValue.length > truncateAt) {
                        return `${strValue.substring(0, truncateAt)}... [TRUNCATED]`;
                    }
                }
                return obj;
            }

            // Handle circular references
            if (seen.has(obj as object)) {
                return '[Circular]';
            }
            seen.add(obj as object);

            if (level <= 0) {
                // Depth budget exhausted — serialize compactly instead of
                // hiding the content behind '[Object]'.
                try {
                    return JSON.stringify(obj);
                } catch {
                    return Object.prototype.toString.call(obj);
                }
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
        return JSON.stringify(
            expandObject(redactedValue, expandLevels),
            null,
            stringifyObj ? 0 : 2
        );
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
        // Get maximum category name length for alignment
        const maxLength = getMaxCategoryNameLength();
        // Convert to uppercase and center the text
        const upperCaseName = category.name.toUpperCase();
        const totalPadding = maxLength - upperCaseName.length;
        const leftPadding = Math.floor(totalPadding / 2);
        const rightPadding = totalPadding - leftPadding;
        const centeredCategoryName =
            ' '.repeat(leftPadding) + upperCaseName + ' '.repeat(rightPadding);
        const categoryText = ` ${centeredCategoryName} `;

        if (useColors) {
            // Use category-specific background color with contrasting text
            const categoryBgFunction = getCategoryBackgroundFunction(category.options.color);
            parts.push(categoryBgFunction(categoryText));
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

    // Determine truncation settings based on log level
    let truncateText: boolean;

    if (level === LogLevel.DEBUG) {
        // Debug never truncates, regardless of configuration
        truncateText = false;
    } else if (level === LogLevel.ERROR) {
        // Error messages use truncateLongTextOnError configuration
        truncateText =
            options?.truncateLongTextOnError !== undefined
                ? options.truncateLongTextOnError
                : category.options.truncateLongTextOnError !== undefined
                  ? category.options.truncateLongTextOnError
                  : config.TRUNCATE_LONG_TEXT_ON_ERROR;
    } else {
        // Other levels use regular truncateLongText configuration
        truncateText =
            options?.truncateLongText !== undefined
                ? options.truncateLongText
                : category.options.truncateLongText !== undefined
                  ? category.options.truncateLongText
                  : config.TRUNCATE_LONG_TEXT;
    }

    const truncateAt =
        options?.truncateLongTextAt !== undefined
            ? options.truncateLongTextAt
            : category.options.truncateLongTextAt !== undefined
              ? category.options.truncateLongTextAt
              : config.TRUNCATE_LONG_TEXT_AT;

    const stringifyObj =
        options?.stringifyObj !== undefined
            ? options.stringifyObj
            : category.options.stringifyObj !== undefined
              ? category.options.stringifyObj
              : config.STRINGIFY_OBJECTS;

    // Format the value
    const formattedValue = formatValue(value, expandLevels, truncateText, truncateAt, stringifyObj);

    // Add arrow and value
    parts.push('=>');
    parts.push(formattedValue);

    return parts.join(' ');
}

/**
 * Prepare console arguments array for logging (prefix + formatted value as separate args).
 */
export function formatLogArgs(
    level: LogLevel,
    value: unknown,
    label?: string,
    options?: LoggerOptions
): unknown[] {
    // NDJSON mode: emit a single structured JSON line (no chalk, no emoji).
    // Sensitive data is redacted inside buildLogEntry before serialization.
    if (getConfig().FORMAT === LogFormat.JSON) {
        return [JSON.stringify(buildLogEntry(level, value, label, options))];
    }

    // Pretty mode (default): a single formatted string for consistency and redaction.
    return [formatLogMessage(level, value, label, options)];
}
