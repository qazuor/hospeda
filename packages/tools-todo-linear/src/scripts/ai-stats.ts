#!/usr/bin/env node

/**
 * Script para mostrar estadísticas de AI de los TODOs
 */

import { findProjectRoot } from '../config/config.js';
import { TrackingManager } from '../core/tracking.js';
import logger from '../utils/logger.js';

async function showAIStats() {
    try {
        const projectRoot = findProjectRoot();
        logger.info(`🔍 Using project root: ${projectRoot}`);

        const tracking = new TrackingManager(projectRoot);

        logger.info('📊 AI Analysis Statistics');
        logger.info('========================\n');

        const stats = tracking.getAIStats();

        logger.info(`📝 Total TODOs: ${stats.total}`);
        logger.info(`✅ Completed: ${stats.completed}`);
        logger.info(`⏳ Pending: ${stats.pending}`);
        logger.info(`⚠️  Failed: ${stats.failed}`);
        logger.info(`❌ Disabled: ${stats.disabled}`);
        logger.info(`⏭️  Skipped: ${stats.skipped}\n`);

        if (stats.failed > 0) {
            logger.info('🔄 Failed TODOs will be retried in next sync');
        }

        if (stats.disabled > 0) {
            logger.info("❌ Disabled TODOs have exceeded max retries and won't be processed");
        }

        // Mostrar algunos ejemplos de TODOs fallidos
        const failedComments = tracking
            .getAllTrackedComments()
            .filter((c) => c.aiState === 'FAILED')
            .slice(0, 5);

        if (failedComments.length > 0) {
            logger.info('\n⚠️  Recent failed AI analyses:');
            for (const comment of failedComments) {
                logger.info(`   • ${comment.filePath}:${comment.line} - ${comment.title}`);
                if (comment.aiLastError) {
                    logger.info(`     Error: ${comment.aiLastError.substring(0, 100)}...`);
                }
            }
        }
    } catch (error) {
        logger.error('Failed to show AI stats:', error);
        process.exit(1);
    }
}

showAIStats().catch(console.error);
