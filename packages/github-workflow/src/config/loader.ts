/**
 * Configuration loader using cosmiconfig
 *
 * @module config/loader
 */

import { cosmiconfig } from 'cosmiconfig';
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader';
import type { WorkflowConfig } from './schemas';

/**
 * Module name for cosmiconfig
 */
const MODULE_NAME = 'github-workflow';

/**
 * Load configuration from file system using cosmiconfig
 *
 * Searches for configuration files in the following order:
 * - `.github-workflow.config.ts`
 * - `.github-workflow.config.js`
 * - `.github-workflowrc.json`
 * - `.github-workflowrc.yaml`
 * - `.github-workflowrc.yml`
 * - `package.json` (field: `github-workflow`)
 *
 * @param searchFrom - Directory to start searching from (defaults to cwd)
 * @returns Configuration object or null if not found
 *
 * @example
 * ```typescript
 * const config = await loadConfigFile();
 * if (config) {
 *   console.log('Config loaded:', config);
 * }
 * ```
 */
export async function loadConfigFile(searchFrom?: string): Promise<WorkflowConfig | null> {
    const explorer = cosmiconfig(MODULE_NAME, {
        searchPlaces: [
            `.${MODULE_NAME}.config.ts`,
            `.${MODULE_NAME}.config.js`,
            `.${MODULE_NAME}rc.json`,
            `.${MODULE_NAME}rc.yaml`,
            `.${MODULE_NAME}rc.yml`,
            'package.json'
        ],
        loaders: {
            '.ts': TypeScriptLoader()
        }
    });

    const result = await explorer.search(searchFrom);

    return result?.config ?? null;
}

/**
 * Load configuration from environment variables
 *
 * Supported environment variables:
 * - `GITHUB_TOKEN` - GitHub API token
 * - `GH_OWNER` - Repository owner/organization
 * - `GH_REPO` - Repository name
 *
 * @returns Partial configuration from environment variables
 *
 * @example
 * ```typescript
 * process.env.GITHUB_TOKEN = 'ghp_xxx';
 * process.env.GH_OWNER = 'hospeda';
 * process.env.GH_REPO = 'main';
 *
 * const envConfig = loadConfigFromEnv();
 * console.log(envConfig.github?.token); // 'ghp_xxx'
 * ```
 */
export function loadConfigFromEnv(): Partial<WorkflowConfig> {
    const envConfig: Partial<WorkflowConfig> = {};

    // GitHub config from env
    if (process.env.GITHUB_TOKEN || process.env.GH_OWNER || process.env.GH_REPO) {
        envConfig.github = {
            token: process.env.GITHUB_TOKEN ?? '',
            owner: process.env.GH_OWNER ?? '',
            repo: process.env.GH_REPO ?? ''
        };
    }

    return envConfig;
}
