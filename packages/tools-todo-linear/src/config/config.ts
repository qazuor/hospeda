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
    const ideLinkTemplate =
        process.env.TODO_LINEAR_IDE_LINK_TEMPLATE || 'vscode://file//{filePath}:{lineNumber}';

    // AI Configuration
    const aiEnabled = process.env.TODO_LINEAR_AI_ENABLED === 'true';
    const aiProvider = (process.env.TODO_LINEAR_AI_PROVIDER || 'disabled') as
        | 'openai'
        | 'anthropic'
        | 'gemini'
        | 'deepseek'
        | 'groq'
        | 'disabled';
    const aiModel = process.env.TODO_LINEAR_AI_MODEL || getDefaultModel(aiProvider);
    const aiMaxContextLines = Number.parseInt(
        process.env.TODO_LINEAR_AI_MAX_CONTEXT_LINES || '50',
        10
    );
    const aiLanguage = (process.env.TODO_LINEAR_AI_LANGUAGE || 'en') as
        | 'en'
        | 'es'
        | 'pt'
        | 'it'
        | 'de';
    const aiApiKey = process.env.TODO_LINEAR_AI_API_KEY;
    const aiBaseUrl = process.env.TODO_LINEAR_AI_BASE_URL;
    const aiBatchSize = Number.parseInt(process.env.TODO_LINEAR_AI_BATCH_SIZE || '3', 10);
    const aiDelayMs = Number.parseInt(process.env.TODO_LINEAR_AI_DELAY_MS || '3000', 10);
    const aiMaxRetries = Number.parseInt(process.env.TODO_LINEAR_AI_MAX_RETRIES || '3', 10);

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
        ideLinkTemplate,
        ai: {
            enabled: aiEnabled,
            provider: aiProvider,
            model: aiModel,
            maxContextLines: aiMaxContextLines,
            language: aiLanguage,
            apiKey: aiApiKey,
            baseUrl: aiBaseUrl,
            batchSize: aiBatchSize,
            delayMs: aiDelayMs,
            maxRetries: aiMaxRetries
        }
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

/**
 * Gets the default AI model for a given provider
 */
function getDefaultModel(provider: string): string {
    switch (provider) {
        case 'openai':
            return 'gpt-4o';
        case 'anthropic':
            return 'claude-3-5-sonnet-20241022';
        case 'gemini':
            return 'gemini-2.0-flash-exp';
        case 'deepseek':
            return 'deepseek-chat';
        case 'groq':
            return 'llama-3.1-8b-instant';
        default:
            return '';
    }
}

/**
 * Gets the API key signup URL for a given provider
 */
export function getApiKeyUrl(provider: string): string {
    switch (provider) {
        case 'openai':
            return 'https://platform.openai.com/api-keys';
        case 'anthropic':
            return 'https://console.anthropic.com/settings/keys';
        case 'gemini':
            return 'https://aistudio.google.com/app/apikey';
        case 'deepseek':
            return 'https://platform.deepseek.com/api_keys';
        case 'groq':
            return 'https://console.groq.com/keys';
        default:
            return '';
    }
}

/**
 * Gets the language name for display
 */
export function getLanguageName(language: string): string {
    switch (language) {
        case 'en':
            return 'English';
        case 'es':
            return 'Español';
        case 'pt':
            return 'Português';
        case 'it':
            return 'Italiano';
        case 'de':
            return 'Deutsch';
        default:
            return 'English';
    }
}

/**
 * Gets provider information including quota details
 */
export function getProviderInfo(provider: string): {
    name: string;
    quota: string;
    cost: string;
    speed: string;
} {
    switch (provider) {
        case 'openai':
            return {
                name: 'OpenAI GPT-4',
                quota: '3 RPM (free tier)',
                cost: 'Paid after $5 credit',
                speed: 'Fast'
            };
        case 'anthropic':
            return {
                name: 'Anthropic Claude',
                quota: '$5 free credit',
                cost: 'Paid after credit',
                speed: 'Fast'
            };
        case 'gemini':
            return {
                name: 'Google Gemini',
                quota: '50 requests/day (free)',
                cost: 'Free tier limited',
                speed: 'Fast'
            };
        case 'deepseek':
            return {
                name: 'DeepSeek Chat',
                quota: '10,000+ requests/day',
                cost: '🆓 COMPLETELY FREE',
                speed: 'Very Fast'
            };
        case 'groq':
            return {
                name: 'Groq (Llama 3)',
                quota: '6,000 tokens/minute',
                cost: '🆓 COMPLETELY FREE',
                speed: '⚡ ULTRA FAST'
            };
        default:
            return {
                name: 'Disabled',
                quota: 'N/A',
                cost: 'N/A',
                speed: 'N/A'
            };
    }
}

/**
 * Gets list of available providers
 */
export function getAvailableProviders(): Array<{
    id: string;
    info: ReturnType<typeof getProviderInfo>;
}> {
    const providers = ['deepseek', 'groq', 'openai', 'anthropic', 'gemini'];
    return providers.map((id) => ({
        id,
        info: getProviderInfo(id)
    }));
}
