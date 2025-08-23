#!/usr/bin/env node
import chokidar from 'chokidar';
import { findProjectRoot, isConfigured, loadConfig } from '../config/config.js';
import { TodoSynchronizer } from '../core/synchronizer.js';
import logger from '../utils/logger.js';

async function main() {
    logger.info('👀 TODO-Linear Watch v2');
    logger.info('Monitoring files for TODO changes...\n');

    try {
        // Find project root
        const projectRoot = findProjectRoot();
        logger.info(`📁 Project root: ${projectRoot}`);

        // Check if configured
        if (!isConfigured(projectRoot)) {
            logger.warn('⚠️  Configuration not found or incomplete.');
            logger.warn('📝 Please run `pnpm todo:setup` to configure the environment variables.');
            process.exit(1);
        }

        // Load configuration
        logger.info('⚙️  Loading configuration...');
        const config = loadConfig(projectRoot);

        // Create synchronizer
        const synchronizer = new TodoSynchronizer(config);

        // Define watch patterns
        const watchPatterns = [
            '**/*.{ts,tsx,js,jsx,vue,svelte,py,rb,php,java,c,cpp,h,hpp,cs,go,rs,swift,kt}'
        ];

        const ignorePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/coverage/**',
            '**/*.min.js',
            '**/*.bundle.js'
        ];

        logger.success('🚀 Starting file watcher...');
        logger.info('Press Ctrl+C to stop watching\n');

        // Set up file watcher
        const watcher = chokidar.watch(watchPatterns, {
            cwd: projectRoot,
            ignored: ignorePatterns,
            ignoreInitial: true,
            persistent: true
        });

        let syncTimeout: NodeJS.Timeout | null = null;

        const triggerSync = () => {
            // Debounce sync operations
            if (syncTimeout) {
                clearTimeout(syncTimeout);
            }

            syncTimeout = setTimeout(async () => {
                try {
                    logger.progress('\n🔄 File changes detected, syncing...');
                    const result = await synchronizer.sync(false);

                    if (result.successful > 0 || result.failed > 0) {
                        logger.success(
                            `✅ Sync completed: ${result.successful} successful, ${result.failed} failed`
                        );
                    } else {
                        logger.info('✅ Sync completed: no changes');
                    }
                } catch (error) {
                    logger.error('❌ Sync failed:', error);
                }
            }, 2000); // Wait 2 seconds after last change
        };

        // Set up event handlers
        watcher
            .on('add', (path) => {
                logger.verbose(`📝 File added: ${path}`);
                triggerSync();
            })
            .on('change', (path) => {
                logger.verbose(`📝 File changed: ${path}`);
                triggerSync();
            })
            .on('unlink', (path) => {
                logger.verbose(`📝 File deleted: ${path}`);
                triggerSync();
            })
            .on('error', (error) => {
                logger.error('👀 Watcher error:', error);
            });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            logger.info('\n🛑 Stopping file watcher...');
            watcher.close();
            process.exit(0);
        });

        // Keep the process alive
        process.stdin.resume();
    } catch (error) {
        logger.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
