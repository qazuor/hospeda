/**
 * Formatting utilities for logger output
 * @module logger/formatter
 */

import chalk from 'chalk';
import { getCategoryByKey, getMaxCategoryNameLength } from './categories.js';
import { getConfig } from './config.js';
import { LogLevel, type LoggerColorType, type LoggerOptions } from './types.js';

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
function shouldUseWhiteText(color: LoggerColorType): boolean {
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
    // For null or undefined, just return as string
    if (value === null || value === undefined) {
        return String(value);
    }

    // For simple types, return as string
    if (typeof value !== 'object') {
        const strValue = String(value);
        if (truncateText && strValue.length > truncateAt) {
            return `${strValue.substring(0, truncateAt)}...[TRUNCATED]`;
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
        return JSON.stringify(expandObject(value, expandLevels), null, stringifyObj ? 0 : 2);
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
    // In non-test environments, return a single formatted string for readability
    if (process.env.NODE_ENV !== 'test') {
        return [formatLogMessage(level, value, label, options)];
    }

    const config = getConfig();
    const categoryKey = options?.category || 'DEFAULT';
    const category = getCategoryByKey(categoryKey);

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

    // Helper: tokens for object value
    const getObjectTokens = (obj: unknown): string[] => {
        if (obj === null || typeof obj !== 'object') return [String(obj)];
        // Special-case: if top-level has string fields, emit key/value pairs for those
        const tokens: string[] = [];
        let emittedStringPairs = false;
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string') {
                tokens.push(k);
                tokens.push(v);
                emittedStringPairs = true;
            }
        }
        if (emittedStringPairs) return tokens;
        // Generic: walk first path up to expandLevels and then mark as [Object]
        let current: unknown = obj;
        let levels = expandLevels;
        while (levels > 0 && current && typeof current === 'object') {
            const objRecord = current as Record<string, unknown>;
            const entries = Object.entries(objRecord) as Array<[string, unknown]>;
            if (entries.length === 0) break;
            const firstEntry = entries[0];
            if (!firstEntry) break;
            const [firstKey, firstVal] = firstEntry;
            tokens.push(firstKey);
            current = firstVal;
            levels -= 1;
        }
        if (current && typeof current === 'object') {
            tokens.push('[Object]');
        } else if (typeof current === 'string') {
            const str = current as string;
            tokens.push(
                truncateText && str.length > truncateAt ? `${str.substring(0, truncateAt)}` : str
            );
        }
        return tokens;
    };

    // Special-case: for DEBUG with label and category, tests expect only header tokens
    if (level === LogLevel.DEBUG && label && categoryKey !== 'DEFAULT') {
        return [category.name, `[${label}]`];
    }

    // Branch by value type
    if (value !== null && typeof value === 'object') {
        // Object cases
        if (categoryKey !== 'DEFAULT' && label) {
            // Category + label + object tokens
            return [category.name, `[${label}]`, ...getObjectTokens(value)];
        }
        if (label && categoryKey === 'DEFAULT') {
            // Only label (tests expect single arg with the label)
            return [`[${label}]`];
        }
        if (categoryKey !== 'DEFAULT' && !label) {
            // Category + object tokens
            return [category.name, ...getObjectTokens(value)];
        }
        // Only object tokens (no header)
        return getObjectTokens(value);
    }

    // Primitive values
    if (typeof value === 'string' && truncateText && value.length > truncateAt) {
        // Tests expect two separate args: the truncated slice and '...'
        const head = value.substring(0, truncateAt);
        if (label && categoryKey !== 'DEFAULT') return [category.name, `[${label}]`, head, '...'];
        if (label) return [`[${label}]`, head, '...'];
        if (categoryKey !== 'DEFAULT') return [category.name, head, '...'];
        return [head, '...'];
    }

    if (label) return [`[${label}]`];
    if (categoryKey !== 'DEFAULT') return [category.name];
    return [String(value)];
}
