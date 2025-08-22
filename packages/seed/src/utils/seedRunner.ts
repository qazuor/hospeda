import { errorHistory } from './errorHistory.js';
import { STATUS_ICONS, getEntityIcon } from './icons.js';
import { logger } from './logger.js';
import type { SeedContext } from './seedContext.js';

/**
 * Configuration options for the seed runner
 */
export interface SeedRunnerOptions<T> {
    /** Name of the entity being processed */
    entityName: string;
    /** Array of items to process */
    items: T[];
    /** Function to process each item */
    process: (item: T, index: number) => Promise<void>;
    /** Optional error handler for individual items */
    onError?: (item: T, index: number, error: Error) => void;
    /** Seed context with configuration and utilities */
    context: SeedContext;
    /** Optional function to get display information for an item */
    getEntityInfo?: (item: T, context: SeedContext) => string;
}

// Consistent visual separators
const SECTION_SEPARATOR = '#'.repeat(90);
const SUBSECTION_SEPARATOR = '─'.repeat(90);

/**
 * Executes the seed process for a collection of items.
 *
 * This function provides:
 * - Progress tracking with counters
 * - Error handling and recovery
 * - Visual separators and logging
 * - Success/error statistics
 * - Entity-specific information display
 * - Integration with error history system
 *
 * @param options - Configuration for the seed runner
 * @returns Promise that resolves when all items are processed
 *
 * @example
 * ```typescript
 * await seedRunner({
 *   entityName: 'Users',
 *   items: userData,
 *   process: async (user, index) => {
 *     await createUser(user);
 *   },
 *   context: seedContext,
 *   getEntityInfo: (user, context) => `${user.name} (${user.email})`
 * });
 * ```
 */
export async function seedRunner<T>({
    entityName,
    items,
    process,
    onError,
    context,
    getEntityInfo
}: SeedRunnerOptions<T>): Promise<void> {
    const icon = getEntityIcon(entityName);
    const totalItems = items.length;
    let successCount = 0;
    let errorCount = 0;

    // Main section separator
    logger.info(`${SECTION_SEPARATOR}`);
    logger.info(`${icon}  INITIALIZING ${entityName.toUpperCase()} LOAD`);
    logger.info(`${icon}  Total items: ${totalItems}`);
    logger.info(`${SUBSECTION_SEPARATOR}`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const currentIndex = i + 1;

        try {
            if (item !== undefined) {
                await process(item, i);

                // Entity information for loaded item
                const entityInfo = getEntityInfo ? getEntityInfo(item, context) : '';
                const successMessage = entityInfo
                    ? `[${currentIndex} of ${totalItems}] - ${icon} ${entityInfo}`
                    : `[${currentIndex} of ${totalItems}] - ${icon} ${entityName} #${currentIndex}`;

                logger.success({ msg: successMessage });
                successCount++;
            }
        } catch (err) {
            const error = err as Error;
            errorCount++;

            // Record error in error history
            const entityInfo =
                getEntityInfo && item
                    ? getEntityInfo(item, context)
                    : `${entityName} #${currentIndex}`;
            const fileName = context.currentFile || `item-${currentIndex}`;

            errorHistory.recordError(
                entityName,
                fileName,
                `Failed to process ${entityInfo}: ${error.message}`,
                error
            );

            // Error information
            logger.error(`   ${STATUS_ICONS.Error} Error in ${entityInfo}: ${error.message}`);

            // Call error handler first if available
            if (item !== undefined && onError) {
                onError(item, i, error);
            }

            // If we shouldn't continue on error, throw the exception to stop the process
            if (!context.continueOnError) {
                throw err;
            }
        }
    }

    // Completion separator
    logger.info(`${SUBSECTION_SEPARATOR}`);

    if (errorCount === 0) {
        logger.success({
            msg: `${STATUS_ICONS.Success} ${entityName}: ${successCount} items processed successfully`
        });
    } else {
        logger.warn(
            `${STATUS_ICONS.Warning}  ${entityName}: ${successCount} successful, ${errorCount} errors`
        );
    }

    logger.info(`${SECTION_SEPARATOR}`);
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('\n');
}
