/**
 * Category management for logger
 * @module logger/categories
 */

import { getConfigFromEnv } from './enviroment.js';
import { type LoggerCategory, type LoggerCategoryOptions, LoggerColors } from './types.js';

/**
 * Map of registered categories
 */
const categories = new Map<string, LoggerCategory>();

/**
 * Register the default category
 */
export function registerDefaultCategory(): void {
    registerCategoryInternal('DEFAULT', 'DEFAULT', {
        color: LoggerColors.WHITE
    });
}

/**
 * Internal function to register a new category
 * @param name - Display name of the category
 * @param key - Unique key for the category (used in env vars)
 * @param options - Category-specific options
 * @returns The registered category
 */
export function registerCategoryInternal(
    name: string,
    key: string,
    options: LoggerCategoryOptions
): LoggerCategory {
    // Get environment configuration for this category
    const envConfig = getConfigFromEnv(key);
    // Create the category with merged options
    const category: LoggerCategory = {
        name,
        key,
        options: {
            ...options,
            save: options.save !== undefined ? options.save : envConfig.SAVE,
            expandObjectLevels:
                options.expandObjectLevels !== undefined
                    ? options.expandObjectLevels
                    : envConfig.EXPAND_OBJECT_LEVELS,
            truncateLongText:
                options.truncateLongText !== undefined
                    ? options.truncateLongText
                    : envConfig.TRUNCATE_LONG_TEXT,
            truncateLongTextAt:
                options.truncateLongTextAt !== undefined
                    ? options.truncateLongTextAt
                    : envConfig.TRUNCATE_LONG_TEXT_AT,
            level: options.level !== undefined ? options.level : envConfig.LEVEL,
            stringifyObj: options.stringifyObj
        }
    };

    // Store the category
    categories.set(key, category);

    return category;
}

/**
 * Get a category by its key
 * @param key - Category key
 * @returns Category object
 */
export function getCategoryByKey(key: string): LoggerCategory {
    const category = categories.get(key);
    if (!category) {
        // If category doesn't exist, return DEFAULT
        return categories.get('DEFAULT') as LoggerCategory;
    }
    return category;
}

/**
 * Clear all registered categories
 */
export function clearCategories(): void {
    categories.clear();
}

// Register the default category
registerDefaultCategory();
