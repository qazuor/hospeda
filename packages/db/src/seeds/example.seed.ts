import { logger } from '@repo/logger';
import { seedExampleData } from './example';

/**
 * Main entry point for seeding example data
 */
async function main() {
    logger.info('Starting example seed process', 'main');

    try {
        await seedExampleData();
        logger.info('Example seed process completed successfully', 'main');
    } catch (error) {
        logger.error('Example seed process failed', 'main', error);
        process.exit(1);
    }
}

// Run the seed process
main().catch((error) => {
    logger.error('Unhandled error in example seed process', 'main', error);
    process.exit(1);
});
