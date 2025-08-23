#!/usr/bin/env node

/**
 * Main sync script - performs one-time synchronization
 */

import chalk from 'chalk';
import { findProjectRoot, isConfigured, loadConfig } from '../config/config.js';
import { TodoSynchronizer } from '../core/synchronizer.js';
import logger from '../utils/logger.js';

async function main() {
    // Check for verbose flag
    const args = process.argv.slice(2);
    const isVerbose = args.includes('verbose') || args.includes('--verbose') || args.includes('-v');

    logger.info(chalk.blue('🚀 TODO-Linear Sync v2'));
    if (isVerbose) {
        logger.info(chalk.yellow('🔍 Verbose mode enabled'));
    }
    logger.info(chalk.gray('Synchronizing TODO comments with Linear issues...\n'));

    try {
        // Find project root
        const projectRoot = findProjectRoot();
        logger.info(chalk.gray(`📁 Project root: ${projectRoot}`));

        // Check if configured
        if (!isConfigured(projectRoot)) {
            logger.warn('⚠️  Configuration not found or incomplete.');
            logger.warn('📝 Please run `pnpm todo:setup` to configure the environment variables.');
            process.exit(1);
        }

        // Load configuration
        logger.info(chalk.gray('⚙️  Loading configuration...'));
        const config = loadConfig(projectRoot);

        // Create synchronizer
        const synchronizer = new TodoSynchronizer(config);

        // Perform sync
        const result = await synchronizer.sync(isVerbose);

        // Display results
        logger.success('\n✅ Synchronization completed!');
        logger.info(`📊 Total comments: ${result.totalComments}`);

        const actuallyProcessed = result.successful - result.skipped;

        logger.success(`✅ Successful operations: ${result.successful}`);

        if (result.skipped > 0) {
            logger.info(`⏭️  Skipped (no changes): ${result.skipped}`);
        }

        if (actuallyProcessed > 0) {
            logger.info(`🔄 Actually processed: ${actuallyProcessed}`);
        }

        if (result.failed > 0) {
            logger.error(`❌ Failed operations: ${result.failed}`);
        }

        if (result.orphans.length > 0) {
            logger.warn(`🔍 Orphaned IDs found: ${result.orphans.length}`);
        }

        logger.info(`⏱️  Duration: ${result.duration}ms`);

        // Show operation details
        if (result.operations.length > 0) {
            logger.info('\n📋 Operations performed:');

            for (const operation of result.operations) {
                const location = `${operation.comment.filePath}:${operation.comment.line}`;

                if (operation.skipped) {
                    const status = chalk.blue('⏭️');
                    const type = operation.type.toUpperCase();
                    logger.info(
                        `${status} ${type} ${operation.issueId} - ${location} (no changes)`
                    );
                } else if (operation.success) {
                    const status = chalk.green('✅');
                    const type = operation.type.toUpperCase();
                    logger.info(`${status} ${type} ${operation.issueId} - ${location}`);
                } else {
                    const status = chalk.red('❌');
                    const type = operation.type.toUpperCase();
                    logger.error(`${status} ${type} FAILED - ${location}: ${operation.error}`);
                }
            }
        }

        // Show stats
        const stats = await synchronizer.getStats();
        logger.info('\n📈 Statistics:');
        logger.info(`   📝 Tracked comments: ${stats.trackedComments}`);
        logger.info(`   🔍 Orphaned comments: ${stats.orphanedComments}`);
        logger.info(`   📅 Last sync: ${new Date(stats.lastSync).toLocaleString()}`);

        // Show errors if any
        if (result.errors.length > 0) {
            logger.error('\n❌ Errors encountered:');
            for (const error of result.errors) {
                logger.error(`   • ${error}`);
            }
        }

        // Exit with appropriate code
        process.exit(result.failed > 0 ? 1 : 0);
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
