#!/usr/bin/env node

/**
 * Setup script - guides user through configuration
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { findProjectRoot, getApiKeyUrl, getAvailableProviders } from '../config/config.js';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SetupConfig {
    TODO_LINEAR_API_KEY: string;
    TODO_LINEAR_TEAM_ID: string;
    TODO_LINEAR_DEFAULT_USER_EMAIL: string;
    TODO_LINEAR_IDE_LABEL_NAME?: string;
    TODO_LINEAR_IDE_LINK_TEMPLATE?: string;
    TODO_LINEAR_AI_ENABLED?: string;
    TODO_LINEAR_AI_PROVIDER?: string;
    TODO_LINEAR_AI_MODEL?: string;
    TODO_LINEAR_AI_LANGUAGE?: string;
    TODO_LINEAR_AI_API_KEY?: string;
    TODO_LINEAR_AI_BASE_URL?: string;
    TODO_LINEAR_AI_MAX_CONTEXT_LINES?: string;
    TODO_LINEAR_AI_BATCH_SIZE?: string;
    TODO_LINEAR_AI_DELAY_MS?: string;
    TODO_LINEAR_AI_MAX_RETRIES?: string;
}

/**
 * Creates .todoLinear directory structure and copies default prompts
 */
async function setupProjectStructure(projectRoot: string) {
    const todoLinearDir = resolve(projectRoot, '.todoLinear');
    const promptsDir = resolve(todoLinearDir, 'prompts');

    logger.info('\n📁 Setting up .todoLinear directory structure...');

    // Create .todoLinear directory
    if (existsSync(todoLinearDir)) {
        logger.info(chalk.gray('   ↳ .todoLinear directory already exists'));
    } else {
        mkdirSync(todoLinearDir, { recursive: true });
        logger.info(chalk.green('   ✓ Created .todoLinear directory'));
    }

    // Create prompts directory
    if (existsSync(promptsDir)) {
        logger.info(chalk.gray('   ↳ .todoLinear/prompts directory already exists'));
    } else {
        mkdirSync(promptsDir, { recursive: true });
        logger.info(chalk.green('   ✓ Created .todoLinear/prompts directory'));
    }

    // Copy default prompt templates
    await copyDefaultPrompts(promptsDir);

    logger.info(chalk.green('📁 Directory structure setup complete!'));
}

/**
 * Copies default prompt templates to .todoLinear/prompts/
 */
async function copyDefaultPrompts(promptsDir: string) {
    logger.info('\n📋 Copying default prompt templates...');

    // Source directory with default prompts
    const sourceDir = resolve(__dirname, '../../prompts');

    const providers = ['anthropic', 'deepseek', 'gemini', 'groq', 'openai'];

    for (const provider of providers) {
        const sourceFile = resolve(sourceDir, `${provider}.default.md`);
        const targetFile = resolve(promptsDir, `${provider}.default.md`);

        if (existsSync(sourceFile)) {
            copyFileSync(sourceFile, targetFile);
            logger.info(chalk.green(`   ✓ Copied ${provider}.default.md`));
        } else {
            logger.warn(chalk.yellow(`   ⚠ Missing source file: ${provider}.default.md`));
        }
    }

    logger.info(chalk.blue('\n💡 To customize prompts:'));
    logger.info(chalk.blue('   • Copy .default.md files to .prompt.md'));
    logger.info(chalk.blue('   • Edit .prompt.md files (they take precedence over defaults)'));
    logger.info(chalk.blue('   • Example: anthropic.prompt.md overrides anthropic.default.md'));
}

async function main() {
    logger.info('🔧 TODO-Linear Setup v3');
    logger.info('Setting up Linear integration for your project...\n');

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(prompt, resolve);
        });
    };

    try {
        const projectRoot = findProjectRoot();
        logger.info(`📁 Project root: ${projectRoot}`);

        // Step 1: Setup directory structure
        await setupProjectStructure(projectRoot);

        // Step 2: Configuration
        const config = await promptForConfig(rl, question);

        // Step 3: Save configuration
        await saveConfig(projectRoot, config);

        // Step 4: Ask about initial synchronization
        logger.info('\n🔄 Initial Synchronization');
        logger.info('Would you like to run an initial sync to find and sync TODOs now?');
        const shouldSync = await question(chalk.white('Run initial sync? (y/N): '));

        if (shouldSync.toLowerCase().startsWith('y')) {
            logger.info('\n🚀 Running initial synchronization...');

            // Importamos y ejecutamos el sync
            const { runSync } = await import('./sync.js');
            await runSync({ skipAi: false, force: false });

            logger.success('✅ Initial synchronization completed!');
        } else {
            logger.info('⏭️ Skipping initial sync. You can run it later with `pnpm todo:sync`');
        }

        rl.close();

        logger.success('\n🎉 Setup completed successfully!');
        logger.info('\n📚 Next steps:');
        logger.info('   • Add TODO comments to your code');
        logger.info('   • Run `pnpm todo:sync` to synchronize with Linear');
        logger.info('   • Check your Linear workspace for new issues');

        if (config.TODO_LINEAR_AI_ENABLED === 'true') {
            logger.info('   • AI will generate descriptions automatically');
            logger.info('   • Customize prompts in .todoLinear/prompts/ if needed');
        }
    } catch (error) {
        logger.error('💥 Setup failed:', error);
        process.exit(1);
    }
}

/**
 * Prompts user for configuration values
 */
async function promptForConfig(
    _rl: ReturnType<typeof createInterface>,
    question: (prompt: string) => Promise<string>
): Promise<SetupConfig> {
    try {
        logger.info('📝 Please provide the following configuration:');
        logger.info('(You can find these values in your Linear workspace settings)\n');

        // Linear API Key
        logger.info('1. Linear API Key');
        logger.info('   Go to Linear → Settings → API → Create new token');
        const TODO_LINEAR_API_KEY = await question(chalk.white('   Enter your Linear API key: '));

        if (!TODO_LINEAR_API_KEY.trim()) {
            throw new Error('Linear API key is required');
        }

        // Linear Team ID
        logger.info('\n2. Linear Team ID');
        logger.info('   Go to Linear → Team Settings → General → Team ID');
        const TODO_LINEAR_TEAM_ID = await question(chalk.white('   Enter your Linear Team ID: '));

        if (!TODO_LINEAR_TEAM_ID.trim()) {
            throw new Error('Linear Team ID is required');
        }

        // Default User Email
        logger.info('\n3. Default User Email');
        logger.info('   Email address for assigning TODOs when no @user is specified');
        const TODO_LINEAR_DEFAULT_USER_EMAIL = await question(
            chalk.white('   Enter default user email: ')
        );

        if (!TODO_LINEAR_DEFAULT_USER_EMAIL.trim()) {
            throw new Error('Default user email is required');
        }

        // IDE Label Name (optional)
        logger.info('\n4. IDE Label Name (optional)');
        logger.info('   Label name to add to issues created from your IDE (default: "From IDE")');
        const TODO_LINEAR_IDE_LABEL_NAME = await question(
            chalk.white('   Enter IDE label name (press Enter for default): ')
        );

        // IDE Link Template (optional)
        logger.info('\n5. IDE Link Template (optional)');
        logger.info('   Template for creating links to open files in your IDE');
        logger.info('   Use {filePath} and {lineNumber} as placeholders');
        logger.info('   Default: vscode://file//{filePath}:{lineNumber}');
        const TODO_LINEAR_IDE_LINK_TEMPLATE = await question(
            chalk.white('   Enter IDE link template (press Enter for default): ')
        );

        // AI Configuration (optional)
        logger.info('\n6. AI Enhancement (optional)');
        logger.info(
            '   Enable AI to automatically analyze TODO comments and enhance Linear issues'
        );
        logger.info('   with priority, descriptions, labels, and suggestions');
        const enableAI = await question(chalk.white('   Enable AI enhancement? (y/N): '));

        const aiConfig: Partial<SetupConfig> = {};

        if (enableAI.toLowerCase() === 'y' || enableAI.toLowerCase() === 'yes') {
            logger.info('\n🤖 Choose AI Provider:');
            logger.info(chalk.dim('   Providers ordered by generosity (free quota first):\n'));

            const providers = getAvailableProviders();
            providers.forEach((provider, index) => {
                const { name, quota, cost, speed } = provider.info;
                const number = index + 1;
                logger.info(`   ${number}. ${chalk.bold(name)}`);
                logger.info(`      ${chalk.green('Quota:')} ${quota}`);
                logger.info(`      ${chalk.blue('Cost:')} ${cost}`);
                logger.info(`      ${chalk.yellow('Speed:')} ${speed}\n`);
            });

            const providerChoice = await question(
                chalk.white(`   Enter choice (1-${providers.length}): `)
            );

            const providerIndex = Number.parseInt(providerChoice) - 1;
            const selectedProvider = providers[providerIndex];

            if (selectedProvider) {
                const provider = selectedProvider.id;
                aiConfig.TODO_LINEAR_AI_ENABLED = 'true';
                aiConfig.TODO_LINEAR_AI_PROVIDER = provider;

                // Language selection
                logger.info('\n🌍 Choose AI Language:');
                logger.info('   1. English (en) - Default');
                logger.info('   2. Español (es) - Spanish');
                logger.info('   3. Português (pt) - Portuguese');
                logger.info('   4. Italiano (it) - Italian');
                logger.info('   5. Deutsch (de) - German');

                const languageChoice = await question(
                    chalk.white('   Enter choice (1-5, press Enter for English): ')
                );

                const languages = { '1': 'en', '2': 'es', '3': 'pt', '4': 'it', '5': 'de' };
                const language = languages[languageChoice as keyof typeof languages] || 'en';
                aiConfig.TODO_LINEAR_AI_LANGUAGE = language;

                // API Key setup
                const apiUrl = getApiKeyUrl(provider);
                if (apiUrl) {
                    logger.info(`\n🔑 Get your API key at: ${chalk.cyan(apiUrl)}`);
                }

                const providerName = selectedProvider.info.name;
                const apiKey = await question(chalk.white(`   Enter ${providerName} API key: `));
                if (apiKey.trim()) {
                    aiConfig.TODO_LINEAR_AI_API_KEY = apiKey.trim();
                }

                // Model configuration
                const defaultModels = {
                    openai: 'gpt-4o',
                    anthropic: 'claude-3-5-sonnet-20241022',
                    gemini: 'gemini-2.0-flash-exp',
                    deepseek: 'deepseek-chat',
                    groq: 'llama-3.1-8b-instant'
                };

                const defaultModel = defaultModels[provider as keyof typeof defaultModels];
                if (defaultModel) {
                    const model = await question(
                        chalk.white(`   Enter model name (press Enter for ${defaultModel}): `)
                    );
                    if (model.trim()) {
                        aiConfig.TODO_LINEAR_AI_MODEL = model.trim();
                    }
                }

                const maxContext = await question(
                    chalk.white('   Max context lines around TODO (press Enter for 50): ')
                );
                if (maxContext.trim()) {
                    aiConfig.TODO_LINEAR_AI_MAX_CONTEXT_LINES = maxContext.trim();
                }

                // Batch processing configuration
                logger.info('\n⚙️  Batch Processing Configuration:');
                logger.info(
                    '   Configure how AI processes multiple TODOs for better performance and rate limiting'
                );

                const batchSize = await question(
                    chalk.white('   Batch size - TODOs per request (press Enter for 3): ')
                );
                if (batchSize.trim()) {
                    const size = Number.parseInt(batchSize.trim(), 10);
                    if (size > 0 && size <= 20) {
                        aiConfig.TODO_LINEAR_AI_BATCH_SIZE = batchSize.trim();
                    } else {
                        logger.warn('   ⚠️  Batch size must be between 1 and 20, using default (3)');
                    }
                }

                const delayMs = await question(
                    chalk.white(
                        '   Delay between requests in milliseconds (press Enter for 3000): '
                    )
                );
                if (delayMs.trim()) {
                    const delay = Number.parseInt(delayMs.trim(), 10);
                    if (delay >= 0 && delay <= 30000) {
                        aiConfig.TODO_LINEAR_AI_DELAY_MS = delayMs.trim();
                    } else {
                        logger.warn(
                            '   ⚠️  Delay must be between 0 and 30000ms, using default (3000)'
                        );
                    }
                }

                const maxRetries = await question(
                    chalk.white('   Max retries on error (press Enter for 3): ')
                );
                if (maxRetries.trim()) {
                    const retries = Number.parseInt(maxRetries.trim(), 10);
                    if (retries >= 0 && retries <= 10) {
                        aiConfig.TODO_LINEAR_AI_MAX_RETRIES = maxRetries.trim();
                    } else {
                        logger.warn(
                            '   ⚠️  Max retries must be between 0 and 10, using default (3)'
                        );
                    }
                }

                logger.info('\n💡 Batch Processing Tips:');
                logger.info('   • Lower batch size = more reliable but slower');
                logger.info('   • Higher delay = safer for rate limits but slower');
                logger.info('   • More retries = more resilient but may take longer on failures');
            }
        }

        const config: SetupConfig = {
            TODO_LINEAR_API_KEY: TODO_LINEAR_API_KEY.trim(),
            TODO_LINEAR_TEAM_ID: TODO_LINEAR_TEAM_ID.trim(),
            TODO_LINEAR_DEFAULT_USER_EMAIL: TODO_LINEAR_DEFAULT_USER_EMAIL.trim(),
            ...aiConfig
        };

        if (TODO_LINEAR_IDE_LABEL_NAME.trim()) {
            config.TODO_LINEAR_IDE_LABEL_NAME = TODO_LINEAR_IDE_LABEL_NAME.trim();
        }

        if (TODO_LINEAR_IDE_LINK_TEMPLATE.trim()) {
            config.TODO_LINEAR_IDE_LINK_TEMPLATE = TODO_LINEAR_IDE_LINK_TEMPLATE.trim();
        }

        return config;
    } catch (error) {
        logger.error('Configuration failed:', error);
        throw error;
    }
}

/**
 * Saves configuration to .env file
 */
async function saveConfig(projectRoot: string, config: SetupConfig) {
    const envPath = resolve(projectRoot, '.env');
    const envLocalPath = resolve(projectRoot, '.env.local');

    // Determine which file to use (.env.local takes precedence)
    const targetPath = existsSync(envLocalPath) ? envLocalPath : envPath;

    logger.info(`\n💾 Saving configuration to ${targetPath}...`);

    let existingContent = '';
    if (existsSync(targetPath)) {
        existingContent = readFileSync(targetPath, 'utf-8');
    }

    // Parse existing environment variables
    const existingVars = new Map<string, string>();
    const lines = existingContent.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                existingVars.set(key.trim(), valueParts.join('='));
            }
        }
    }

    // Update with new values
    existingVars.set('TODO_LINEAR_API_KEY', config.TODO_LINEAR_API_KEY);
    existingVars.set('TODO_LINEAR_TEAM_ID', config.TODO_LINEAR_TEAM_ID);
    existingVars.set('TODO_LINEAR_DEFAULT_USER_EMAIL', config.TODO_LINEAR_DEFAULT_USER_EMAIL);

    if (config.TODO_LINEAR_IDE_LABEL_NAME) {
        existingVars.set('TODO_LINEAR_IDE_LABEL_NAME', config.TODO_LINEAR_IDE_LABEL_NAME);
    }

    if (config.TODO_LINEAR_IDE_LINK_TEMPLATE) {
        existingVars.set('TODO_LINEAR_IDE_LINK_TEMPLATE', config.TODO_LINEAR_IDE_LINK_TEMPLATE);
    }

    // AI Configuration
    if (config.TODO_LINEAR_AI_ENABLED) {
        existingVars.set('TODO_LINEAR_AI_ENABLED', config.TODO_LINEAR_AI_ENABLED);
    }

    if (config.TODO_LINEAR_AI_PROVIDER) {
        existingVars.set('TODO_LINEAR_AI_PROVIDER', config.TODO_LINEAR_AI_PROVIDER);
    }

    if (config.TODO_LINEAR_AI_MODEL) {
        existingVars.set('TODO_LINEAR_AI_MODEL', config.TODO_LINEAR_AI_MODEL);
    }

    if (config.TODO_LINEAR_AI_API_KEY) {
        existingVars.set('TODO_LINEAR_AI_API_KEY', config.TODO_LINEAR_AI_API_KEY);
    }

    if (config.TODO_LINEAR_AI_BASE_URL) {
        existingVars.set('TODO_LINEAR_AI_BASE_URL', config.TODO_LINEAR_AI_BASE_URL);
    }

    if (config.TODO_LINEAR_AI_MAX_CONTEXT_LINES) {
        existingVars.set(
            'TODO_LINEAR_AI_MAX_CONTEXT_LINES',
            config.TODO_LINEAR_AI_MAX_CONTEXT_LINES
        );
    }

    if (config.TODO_LINEAR_AI_BATCH_SIZE) {
        existingVars.set('TODO_LINEAR_AI_BATCH_SIZE', config.TODO_LINEAR_AI_BATCH_SIZE);
    }

    if (config.TODO_LINEAR_AI_DELAY_MS) {
        existingVars.set('TODO_LINEAR_AI_DELAY_MS', config.TODO_LINEAR_AI_DELAY_MS);
    }

    if (config.TODO_LINEAR_AI_MAX_RETRIES) {
        existingVars.set('TODO_LINEAR_AI_MAX_RETRIES', config.TODO_LINEAR_AI_MAX_RETRIES);
    }

    // Build new content
    const newLines: string[] = [];

    // Add header comment if file is new
    if (!existsSync(targetPath)) {
        newLines.push('# Environment variables for hospeda project');
        newLines.push('');
    }

    // Add TODO-Linear section
    newLines.push('# TODO-Linear Configuration');
    newLines.push(`TODO_LINEAR_API_KEY=${config.TODO_LINEAR_API_KEY}`);
    newLines.push(`TODO_LINEAR_TEAM_ID=${config.TODO_LINEAR_TEAM_ID}`);
    newLines.push(`TODO_LINEAR_DEFAULT_USER_EMAIL=${config.TODO_LINEAR_DEFAULT_USER_EMAIL}`);

    if (config.TODO_LINEAR_IDE_LABEL_NAME) {
        newLines.push(`TODO_LINEAR_IDE_LABEL_NAME=${config.TODO_LINEAR_IDE_LABEL_NAME}`);
    }

    if (config.TODO_LINEAR_IDE_LINK_TEMPLATE) {
        newLines.push(`TODO_LINEAR_IDE_LINK_TEMPLATE=${config.TODO_LINEAR_IDE_LINK_TEMPLATE}`);
    }

    // AI Configuration
    if (config.TODO_LINEAR_AI_ENABLED) {
        newLines.push('');
        newLines.push('# AI Enhancement Configuration');
        newLines.push(`TODO_LINEAR_AI_ENABLED=${config.TODO_LINEAR_AI_ENABLED}`);

        if (config.TODO_LINEAR_AI_PROVIDER) {
            newLines.push(`TODO_LINEAR_AI_PROVIDER=${config.TODO_LINEAR_AI_PROVIDER}`);
        }

        if (config.TODO_LINEAR_AI_LANGUAGE) {
            newLines.push(`TODO_LINEAR_AI_LANGUAGE=${config.TODO_LINEAR_AI_LANGUAGE}`);
        }

        if (config.TODO_LINEAR_AI_MODEL) {
            newLines.push(`TODO_LINEAR_AI_MODEL=${config.TODO_LINEAR_AI_MODEL}`);
        }

        if (config.TODO_LINEAR_AI_API_KEY) {
            newLines.push(`TODO_LINEAR_AI_API_KEY=${config.TODO_LINEAR_AI_API_KEY}`);
        }

        if (config.TODO_LINEAR_AI_BASE_URL) {
            newLines.push(`TODO_LINEAR_AI_BASE_URL=${config.TODO_LINEAR_AI_BASE_URL}`);
        }

        if (config.TODO_LINEAR_AI_MAX_CONTEXT_LINES) {
            newLines.push(
                `TODO_LINEAR_AI_MAX_CONTEXT_LINES=${config.TODO_LINEAR_AI_MAX_CONTEXT_LINES}`
            );
        }

        if (config.TODO_LINEAR_AI_BATCH_SIZE) {
            newLines.push(`TODO_LINEAR_AI_BATCH_SIZE=${config.TODO_LINEAR_AI_BATCH_SIZE}`);
        }

        if (config.TODO_LINEAR_AI_DELAY_MS) {
            newLines.push(`TODO_LINEAR_AI_DELAY_MS=${config.TODO_LINEAR_AI_DELAY_MS}`);
        }

        if (config.TODO_LINEAR_AI_MAX_RETRIES) {
            newLines.push(`TODO_LINEAR_AI_MAX_RETRIES=${config.TODO_LINEAR_AI_MAX_RETRIES}`);
        }
    }

    newLines.push('');

    // Add other existing variables (excluding the ones we just set)
    const todoLinearKeys = new Set([
        'TODO_LINEAR_API_KEY',
        'TODO_LINEAR_TEAM_ID',
        'TODO_LINEAR_DEFAULT_USER_EMAIL',
        'TODO_LINEAR_IDE_LABEL_NAME',
        'TODO_LINEAR_IDE_LINK_TEMPLATE',
        'TODO_LINEAR_AI_ENABLED',
        'TODO_LINEAR_AI_PROVIDER',
        'TODO_LINEAR_AI_LANGUAGE',
        'TODO_LINEAR_AI_MODEL',
        'TODO_LINEAR_AI_API_KEY',
        'TODO_LINEAR_AI_BASE_URL',
        'TODO_LINEAR_AI_MAX_CONTEXT_LINES',
        'TODO_LINEAR_AI_BATCH_SIZE',
        'TODO_LINEAR_AI_DELAY_MS',
        'TODO_LINEAR_AI_MAX_RETRIES'
    ]);
    for (const [key, value] of existingVars) {
        if (!todoLinearKeys.has(key)) {
            newLines.push(`${key}=${value}`);
        }
    }

    // Write the file
    const newContent = newLines.join('\n');
    writeFileSync(targetPath, newContent, 'utf-8');

    logger.success(`✅ Configuration saved to ${targetPath}`);

    // Show what was configured
    logger.info('\n📋 Configuration summary:');
    logger.info(`   Linear API Key: ${config.TODO_LINEAR_API_KEY.substring(0, 8)}...`);
    logger.info(`   Linear Team ID: ${config.TODO_LINEAR_TEAM_ID}`);
    logger.info(`   Default User Email: ${config.TODO_LINEAR_DEFAULT_USER_EMAIL}`);

    if (config.TODO_LINEAR_IDE_LABEL_NAME) {
        logger.info(`   IDE Label Name: ${config.TODO_LINEAR_IDE_LABEL_NAME}`);
    } else {
        logger.info('   IDE Label Name: From IDE (default)');
    }

    if (config.TODO_LINEAR_IDE_LINK_TEMPLATE) {
        logger.info(`   IDE Link Template: ${config.TODO_LINEAR_IDE_LINK_TEMPLATE}`);
    } else {
        logger.info('   IDE Link Template: vscode://file//{filePath}:{lineNumber} (default)');
    }

    // AI Configuration Summary
    if (config.TODO_LINEAR_AI_ENABLED === 'true') {
        logger.info('\n🤖 AI Enhancement:');
        logger.info('   Enabled: Yes');
        logger.info(`   Provider: ${config.TODO_LINEAR_AI_PROVIDER || 'Not set'}`);
        logger.info(`   Model: ${config.TODO_LINEAR_AI_MODEL || 'Default'}`);

        if (config.TODO_LINEAR_AI_API_KEY) {
            logger.info(`   API Key: ${config.TODO_LINEAR_AI_API_KEY.substring(0, 8)}...`);
        }

        if (config.TODO_LINEAR_AI_BASE_URL) {
            logger.info(`   Base URL: ${config.TODO_LINEAR_AI_BASE_URL}`);
        }

        logger.info(
            `   Max Context Lines: ${config.TODO_LINEAR_AI_MAX_CONTEXT_LINES || '50 (default)'}`
        );

        if (
            config.TODO_LINEAR_AI_BATCH_SIZE ||
            config.TODO_LINEAR_AI_DELAY_MS ||
            config.TODO_LINEAR_AI_MAX_RETRIES
        ) {
            logger.info('\n⚙️  Batch Processing:');
            logger.info(
                `   Batch Size: ${config.TODO_LINEAR_AI_BATCH_SIZE || '3 (default)'} TODOs per request`
            );
            logger.info(
                `   Delay: ${config.TODO_LINEAR_AI_DELAY_MS || '3000 (default)'} ms between requests`
            );
            logger.info(
                `   Max Retries: ${config.TODO_LINEAR_AI_MAX_RETRIES || '3 (default)'} on errors`
            );
        }
    } else {
        logger.info('\n🤖 AI Enhancement: Disabled');
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
