/**
 * Configuration management for TODO-Linear system
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import type { TodoLinearConfig } from '../types/index.js';

/**
 * Loads configuration from environment variables
 */
export function loadConfig(projectRoot: string): TodoLinearConfig {
    // Load environment variables from .env file
    config({ path: resolve(projectRoot, '.env') });
    config({ path: resolve(projectRoot, '.env.local') });

    const linearApiKey = process.env.TODO_LINEAR_API_KEY;
    const linearTeamId = process.env.TODO_LINEAR_TEAM_ID;
    const defaultUserEmail = process.env.TODO_LINEAR_DEFAULT_USER_EMAIL;
    const ideLabelName = process.env.TODO_LINEAR_IDE_LABEL_NAME || 'From IDE';
    const ideLinkTemplate = process.env.TODO_LINEAR_IDE_LINK_TEMPLATE || 'vscode://file//{filePath}:{lineNumber}';

    if (!linearApiKey) {
        throw new Error(
            'Missing required configuration: TODO_LINEAR_API_KEY\n' +
                'Please run `pnpm todo:setup` to configure the environment variables.'
        );
    }

    if (!linearTeamId) {
        throw new Error(
            'Missing required configuration: TODO_LINEAR_TEAM_ID\n' +
                'Please run `pnpm todo:setup` to configure the environment variables.'
        );
    }

    if (!defaultUserEmail) {
        throw new Error(
            'Missing required configuration: TODO_LINEAR_DEFAULT_USER_EMAIL\n' +
                'Please run `pnpm todo:setup` to configure the environment variables.'
        );
    }

    return {
        linearApiKey,
        linearTeamId,
        defaultUserEmail,
        includePatterns: [], // Will use defaults in FileScanner
        excludePatterns: [], // Will use defaults in FileScanner
        projectRoot,
        ideLabelName,
        ideLinkTemplate
    };
}

/**
 * Validates that all required configuration is present
 */
export function validateConfig(config: TodoLinearConfig): void {
    const requiredFields: (keyof TodoLinearConfig)[] = [
        'linearApiKey',
        'linearTeamId',
        'defaultUserEmail',
        'projectRoot'
    ];

    for (const field of requiredFields) {
        if (!config[field]) {
            throw new Error(`Missing required configuration: ${field}`);
        }
    }
}

/**
 * Finds the project root directory
 */
export function findProjectRoot(): string {
    let currentDir = process.cwd();

    // If we're running from within the tools-todo-linear package, go up to monorepo root
    if (currentDir.includes('packages/tools-todo-linear')) {
        const parts = currentDir.split('/');
        const packagesIndex = parts.lastIndexOf('packages');
        if (packagesIndex > 0) {
            currentDir = parts.slice(0, packagesIndex).join('/');
        }
    }

    // Look for package.json or pnpm-workspace.yaml to confirm project root
    const indicators = ['package.json', 'pnpm-workspace.yaml', '.git'];

    while (currentDir !== '/') {
        const hasIndicator = indicators.some((indicator) =>
            existsSync(resolve(currentDir, indicator))
        );

        if (hasIndicator) {
            return currentDir;
        }

        currentDir = resolve(currentDir, '..');
    }

    // Fallback to current working directory
    return process.cwd();
}

/**
 * Checks if the configuration is properly set up
 */
export function isConfigured(projectRoot: string): boolean {
    try {
        const config = loadConfig(projectRoot);
        validateConfig(config);
        return true;
    } catch {
        return false;
    }
}
