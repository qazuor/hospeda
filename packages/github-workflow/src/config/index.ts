/**
 * Configuration management and validation
 *
 * This module provides a complete configuration system for GitHub workflows
 * using cosmiconfig for file discovery and Zod for validation.
 *
 * @module config
 *
 * @example
 * ```typescript
 * import { loadConfig } from '@repo/github-workflow/config';
 *
 * const config = await loadConfig();
 * console.log(config.github.token);
 * console.log(config.sync?.planning?.enabled); // From defaults
 * ```
 */

import { loadConfigFile, loadConfigFromEnv } from './loader';
import type { WorkflowConfig } from './schemas';
import { validateConfig } from './validator';

// Re-export types and schemas
export * from './schemas';
export * from './defaults';
export { validateConfig } from './validator';

/**
 * Load and validate workflow configuration
 *
 * Configuration is loaded from multiple sources with the following priority:
 * 1. Config file (`.github-workflow.config.ts`, etc.)
 * 2. Environment variables (`GITHUB_TOKEN`, `GH_OWNER`, `GH_REPO`)
 * 3. Defaults (from `defaults.ts`)
 *
 * All sources are merged, with higher priority sources overriding lower ones.
 * The final configuration is validated with Zod schemas.
 *
 * @param searchFrom - Directory to start searching for config file (defaults to cwd)
 * @returns Validated configuration with defaults applied
 * @throws Error if configuration is invalid or required fields are missing
 *
 * @example
 * ```typescript
 * // With environment variables
 * process.env.GITHUB_TOKEN = 'ghp_xxx';
 * process.env.GH_OWNER = 'hospeda';
 * process.env.GH_REPO = 'main';
 *
 * const config = await loadConfig();
 * console.log(config.github.token); // 'ghp_xxx'
 * console.log(config.sync?.planning?.enabled); // true (default)
 * ```
 *
 * @example
 * ```typescript
 * // With config file (.github-workflow.config.ts)
 * export default {
 *   github: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'hospeda',
 *     repo: 'main',
 *   },
 *   sync: {
 *     planning: {
 *       enabled: false, // Override default
 *     },
 *   },
 * };
 *
 * const config = await loadConfig();
 * console.log(config.sync?.planning?.enabled); // false (from file)
 * ```
 */
export async function loadConfig(searchFrom?: string): Promise<WorkflowConfig> {
    // Load from file
    const fileConfig = await loadConfigFile(searchFrom);

    // Load from env
    const envConfig = loadConfigFromEnv();

    // Merge: file config takes precedence over env
    const userConfig = { ...envConfig, ...fileConfig };

    // Validate and merge with defaults
    return validateConfig(userConfig);
}
