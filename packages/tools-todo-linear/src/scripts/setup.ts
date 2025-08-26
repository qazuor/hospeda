#!/usr/bin/env node

/**
 * Setup script - guides user through configuration
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { findProjectRoot } from '../config/config.js';
import logger from '../utils/logger.js';

interface SetupConfig {
    TODO_LINEAR_API_KEY: string;
    TODO_LINEAR_TEAM_ID: string;
    TODO_LINEAR_DEFAULT_USER_EMAIL: string;
}

async function main() {
    logger.info('🔧 TODO-Linear Setup v2');
    logger.info('Setting up environment variables for Linear integration...\n');

    try {
        const projectRoot = findProjectRoot();
        logger.info(`📁 Project root: ${projectRoot}`);

        const config = await promptForConfig();
        await saveConfig(projectRoot, config);

        logger.success('\n✅ Setup completed successfully!');
        logger.info('You can now run `pnpm todo:sync` to synchronize your TODOs with Linear.');
    } catch (error) {
        logger.error('💥 Setup failed:', error);
        process.exit(1);
    }
}

/**
 * Prompts user for configuration values
 */
async function promptForConfig(): Promise<SetupConfig> {
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

        return {
            TODO_LINEAR_API_KEY: TODO_LINEAR_API_KEY.trim(),
            TODO_LINEAR_TEAM_ID: TODO_LINEAR_TEAM_ID.trim(),
            TODO_LINEAR_DEFAULT_USER_EMAIL: TODO_LINEAR_DEFAULT_USER_EMAIL.trim()
        };
    } finally {
        rl.close();
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
    newLines.push('');

    // Add other existing variables (excluding the ones we just set)
    const todoLinearKeys = new Set([
        'TODO_LINEAR_API_KEY',
        'TODO_LINEAR_TEAM_ID',
        'TODO_LINEAR_DEFAULT_USER_EMAIL'
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
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
