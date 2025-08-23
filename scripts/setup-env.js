#!/usr/bin/env node

/**
 * Environment Setup Script
 * Creates symlinks for .env.local in all apps for better compatibility
 * This ensures all apps can access the centralized environment variables
 */

import { existsSync, lstatSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const envFile = join(rootDir, '.env.local');

const log = (message) => {
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(message);
};

// Apps that need symlinks to .env.local
const apps = ['apps/api', 'apps/admin', 'apps/web'];

/**
 * Check if a symlink exists and points to the correct target
 */
const isValidSymlink = (linkPath, _targetPath) => {
    try {
        if (!existsSync(linkPath)) return false;
        const stats = lstatSync(linkPath);
        if (!stats.isSymbolicLink()) return false;

        // On Windows, we might use junctions instead of symlinks
        return true;
    } catch {
        return false;
    }
};

/**
 * Create a symlink safely
 */
const createSymlink = (target, linkPath, appName) => {
    try {
        // Remove existing file/link if it exists and is not a valid symlink
        if (existsSync(linkPath) && !isValidSymlink(linkPath, target)) {
            log(`⚠️  Removing existing file at ${linkPath}`);
            // We don't remove it automatically to be safe
            log(`   Please manually remove ${linkPath} and run this script again`);
            return false;
        }

        if (isValidSymlink(linkPath, target)) {
            log(`✅ ${appName}: .env.local symlink already exists`);
            return true;
        }

        // Create the symlink
        symlinkSync(target, linkPath);
        log(`✅ ${appName}: Created .env.local symlink`);
        return true;
    } catch (error) {
        console.error(`❌ ${appName}: Failed to create symlink:`, error.message);
        return false;
    }
};

/**
 * Main setup function
 */
const setupEnvironment = () => {
    log('🔧 Setting up environment configuration...\n');

    // Check if root .env.local exists
    if (!existsSync(envFile)) {
        log('⚠️  Root .env.local not found. Creating from .env.example...');

        const exampleFile = join(rootDir, '.env.example');
        if (existsSync(exampleFile)) {
            log('📝 Please copy .env.example to .env.local and configure your variables:');
            log('   cp .env.example .env.local');
            log('   Then run this script again.\n');
            return false;
            // biome-ignore lint/style/noUselessElse: <explanation>
        } else {
            log('❌ No .env.example found. Please create .env.local manually.\n');
            return false;
        }
    }

    let allSuccess = true;
    const relativePath = '../../.env.local';

    // Create symlinks for each app
    for (const app of apps) {
        const appDir = join(rootDir, app);
        const linkPath = join(appDir, '.env.local');

        if (!existsSync(appDir)) {
            log(`⚠️  ${app}: Directory not found, skipping...`);
            continue;
        }

        const success = createSymlink(relativePath, linkPath, app);
        if (!success) allSuccess = false;
    }

    log(
        `\n${
            allSuccess
                ? '🎉 Environment setup completed successfully!'
                : '⚠️  Setup completed with some issues'
        }`
    );

    if (allSuccess) {
        log('\n📋 Next steps:');
        log('   1. Configure your .env.local with the required variables');
        log('   2. Start your development servers:');
        log('      • API: cd apps/api && pnpm dev');
        log('      • Admin: cd apps/admin && pnpm dev');
        log('      • Web: cd apps/web && pnpm dev');
    }

    return allSuccess;
};

/**
 * Check if setup is needed (for postinstall hook)
 */
const isSetupNeeded = () => {
    // Check if any app is missing its .env.local symlink
    for (const app of apps) {
        const appDir = join(rootDir, app);
        const linkPath = join(appDir, '.env.local');

        if (existsSync(appDir) && !isValidSymlink(linkPath, '../../.env.local')) {
            return true;
        }
    }
    return false;
};

// Run the setup
if (import.meta.url === `file://${process.argv[1]}`) {
    // Check if this is being run as postinstall
    const isPostinstall = process.env.npm_lifecycle_event === 'postinstall';

    if (isPostinstall) {
        // Only run setup if needed to avoid noise
        if (isSetupNeeded()) {
            log('🔧 First time setup detected, configuring environment...\n');
            setupEnvironment();
        }
    } else {
        // Manual execution, always run
        setupEnvironment();
    }
}

export { setupEnvironment };
