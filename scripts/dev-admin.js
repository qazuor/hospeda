#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, rmSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const adminRoot = join(projectRoot, 'apps/admin');
const packagesRoot = join(projectRoot, 'packages');
const viteCache = join(adminRoot, 'node_modules/.vite');

// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log('🚀 Starting admin dev server with auto-cache clearing...\n');

// Function to clear Vite cache
function clearViteCache() {
    if (existsSync(viteCache)) {
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('🧹 Clearing Vite cache...');
        rmSync(viteCache, { recursive: true, force: true });
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('✅ Cache cleared\n');
    }
}

// Start the dev server
function startDevServer() {
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('📦 Starting Vite dev server...');
    const devProcess = spawn('pnpm', ['dev'], {
        cwd: adminRoot,
        stdio: 'inherit',
        shell: true
    });

    devProcess.on('error', (error) => {
        console.error('❌ Failed to start dev server:', error);
        process.exit(1);
    });

    return devProcess;
}

// Watch packages for changes
function watchPackages() {
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('👀 Watching packages for changes...\n');

    let timeout;
    const watcher = watch(packagesRoot, { recursive: true }, (_eventType, filename) => {
        if (
            filename &&
            (filename.endsWith('.ts') ||
                filename.endsWith('.tsx') ||
                filename.endsWith('.js') ||
                filename.endsWith('.jsx'))
        ) {
            // biome-ignore lint/suspicious/noConsoleLog: <explanation>
            console.log(`📝 File changed: ${filename}`);

            // Debounce cache clearing
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                clearViteCache();
            }, 300);
        }
    });

    return watcher;
}

// Main execution
async function main() {
    // Clear cache on startup
    clearViteCache();

    // Start watching packages
    const watcher = watchPackages();

    // Start dev server
    const devProcess = startDevServer();

    // Handle cleanup
    const cleanup = () => {
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n🛑 Shutting down...');
        watcher.close();
        devProcess.kill();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
