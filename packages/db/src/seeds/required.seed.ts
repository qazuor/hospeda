import { logger } from '@repo/logger';
import { seedRequiredData } from './required';

/**
 * Main entry point for seeding required data
 */
async function main() {
    logger.info('Starting required seed process', 'main');

    try {
        await seedRequiredData();
        logger.info('Required seed process completed successfully', 'main');
    } catch (error) {
        logger.error('Required seed process failed', 'main', error);
        process.exit(1);
    }
}

// Run the seed process
main().catch((error) => {
    logger.error('Unhandled error in required seed process', 'main', error);
    process.exit(1);
});
