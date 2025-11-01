/**
 * Configuration validation and merging logic
 *
 * @module config/validator
 */

import { ZodError } from 'zod';
import { defaultConfig } from './defaults';
import { type WorkflowConfig, workflowConfigSchema } from './schemas';

/**
 * Validate and merge configuration with defaults
 *
 * Performs the following operations:
 * 1. Deep merge user config with defaults
 * 2. Validate merged config with Zod schema
 * 3. Return validated, type-safe configuration
 *
 * @param userConfig - User-provided configuration (partial)
 * @returns Validated and merged configuration
 * @throws Error if validation fails with detailed error messages
 *
 * @example
 * ```typescript
 * const userConfig = {
 *   github: {
 *     token: 'ghp_xxx',
 *     owner: 'hospeda',
 *     repo: 'main',
 *   },
 * };
 *
 * const validatedConfig = validateConfig(userConfig);
 * console.log(validatedConfig.sync?.planning?.enabled); // true (from defaults)
 * ```
 */
export function validateConfig(userConfig: Partial<WorkflowConfig>): WorkflowConfig {
    // Deep merge with defaults
    const merged = deepMerge(defaultConfig, userConfig);

    // Validate with Zod
    try {
        return workflowConfigSchema.parse(merged);
    } catch (error) {
        if (error instanceof ZodError) {
            const messages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
            throw new Error(`Configuration validation failed:\n${messages.join('\n')}`);
        }
        throw error;
    }
}

/**
 * Deep merge two objects
 *
 * - Arrays are replaced (not merged)
 * - Objects are merged recursively
 * - `undefined` values in source are ignored
 * - `null` values in source override target
 *
 * @param target - Base object (defaults)
 * @param source - Override object (user config)
 * @returns Merged object
 *
 * @example
 * ```typescript
 * const target = { a: 1, b: { c: 2 } };
 * const source = { b: { d: 3 } };
 * const result = deepMerge(target, source);
 * // Result: { a: 1, b: { c: 2, d: 3 } }
 * ```
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
            sourceValue &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            targetValue &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)
        ) {
            // Recursive merge for nested objects
            result[key] = deepMerge(targetValue, sourceValue);
        } else if (sourceValue !== undefined) {
            // Direct assignment for primitives, arrays, null, etc.
            result[key] = sourceValue as T[Extract<keyof T, string>];
        }
    }

    return result;
}
