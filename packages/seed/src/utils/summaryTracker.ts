import { STATUS_ICONS, getEntityIcon, getStatusIcon } from './icons.js';
import { logger } from './logger.js';

/**
 * Statistics for a specific entity type
 */
interface SummaryStats {
    /** Number of successful operations */
    success: number;
    /** Number of errors encountered */
    errors: number;
    /** Detailed error information */
    errorDetails: Array<{
        /** File where the error occurred */
        file: string;
        /** Error message */
        message: string;
    }>;
}

/**
 * Information about a process step
 */
interface ProcessStep {
    /** Name of the process step */
    name: string;
    /** Status of the process step */
    status: 'success' | 'error' | 'warning';
    /** Message describing the step result */
    message: string;
    /** Optional additional details */
    details?: string;
}

/**
 * Tracks and reports statistics for the seed process.
 *
 * This class provides:
 * - Success/error counting for each entity type
 * - Process step tracking
 * - Execution time measurement
 * - Detailed error reporting
 * - Formatted summary output
 *
 * @example
 * ```typescript
 * summaryTracker.trackSuccess('Users');
 * summaryTracker.trackError('Posts', 'post-001.json', 'Validation failed');
 * summaryTracker.trackProcessStep('Database Reset', 'success', 'Reset completed');
 * summaryTracker.print(); // Prints final summary
 * ```
 */
class SummaryTracker {
    /** Statistics for each entity type */
    private stats = new Map<string, SummaryStats>();
    /** Process steps and their status */
    private processSteps: ProcessStep[] = [];
    /** Start time of the seed process */
    private startTime: number | null = null;
    /** End time of the seed process */
    private endTime: number | null = null;

    /**
     * Starts the execution timer
     */
    startTimer(): void {
        this.startTime = Date.now();
    }

    /**
     * Stops the execution timer
     */
    stopTimer(): void {
        this.endTime = Date.now();
    }

    /**
     * Gets the total execution time in a human-readable format
     *
     * @returns Formatted time string (e.g., "2m 15s 300ms", "45s 200ms", "500ms")
     */
    private getExecutionTime(): string {
        if (!this.startTime || !this.endTime) {
            return 'N/A';
        }

        const totalMs = this.endTime - this.startTime;
        const seconds = Math.floor(totalMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const milliseconds = totalMs % 1000;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s ${milliseconds}ms`;
        }
        if (seconds > 0) {
            return `${seconds}s ${milliseconds}ms`;
        }
        return `${milliseconds}ms`;
    }

    /**
     * Tracks a successful operation for an entity type
     *
     * @param entityName - Name of the entity type (e.g., 'Users', 'Posts')
     */
    trackSuccess(entityName: string): void {
        const current = this.stats.get(entityName) || { success: 0, errors: 0, errorDetails: [] };
        current.success++;
        this.stats.set(entityName, current);
    }

    /**
     * Tracks an error for an entity type
     *
     * @param entityName - Name of the entity type
     * @param file - File where the error occurred
     * @param message - Error message
     */
    trackError(entityName: string, file: string, message: string): void {
        const current = this.stats.get(entityName) || { success: 0, errors: 0, errorDetails: [] };
        current.errors++;
        current.errorDetails.push({ file, message });
        this.stats.set(entityName, current);
    }

    /**
     * Tracks a process step with its status and details
     *
     * @param name - Name of the process step
     * @param status - Status of the step ('success', 'error', 'warning')
     * @param message - Description of the step result
     * @param details - Optional additional details
     */
    trackProcessStep(
        name: string,
        status: 'success' | 'error' | 'warning',
        message: string,
        details?: string
    ): void {
        this.processSteps.push({ name, status, message, details });
    }

    /**
     * Prints a comprehensive summary of the seed process.
     *
     * This includes:
     * - Total execution time
     * - Process steps and their status
     * - Entity statistics (success/error counts)
     * - Detailed error information
     * - Overall totals
     */
    print(): void {
        const separator = '#'.repeat(90);
        const subSeparator = '─'.repeat(90);

        // Stop the timer before printing
        this.stopTimer();

        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n');
        logger.info(`${STATUS_ICONS.Info}  FINAL SUMMARY`);
        logger.info(`${subSeparator}`);

        // Print execution time
        const executionTime = this.getExecutionTime();
        logger.info(`⏱️  Total execution time: ${executionTime}`);

        // Print process steps first
        if (this.processSteps.length > 0) {
            logger.info(`${STATUS_ICONS.Process} Process steps:`);
            for (const step of this.processSteps) {
                const statusIcon = getStatusIcon(step.status);
                if (step.status === 'error') {
                    logger.error(`${statusIcon} ${step.name}: ${step.message}`);
                    if (step.details) {
                        logger.error(`  ${step.details}`);
                    }
                } else {
                    logger.info(`${statusIcon} ${step.name}: ${step.message}`);
                    if (step.details) {
                        logger.info(`  ${step.details}`);
                    }
                }
            }
            logger.info(`${subSeparator}`);
        }

        if (this.stats.size === 0) {
            logger.info('   No entity statistics available');
            logger.info(`${separator}`);
            return;
        }

        let totalSuccess = 0;
        let totalErrors = 0;

        // Print entity summaries
        for (const [entityName, stats] of this.stats.entries()) {
            const icon = getEntityIcon(entityName);
            const status = stats.errors === 0 ? STATUS_ICONS.Success : STATUS_ICONS.Warning;

            logger.info(
                `${status} ${icon} ${entityName}: ${stats.success} loaded, ${stats.errors} errors`
            );
            totalSuccess += stats.success;
            totalErrors += stats.errors;
        }

        // Print totals
        logger.info(`${subSeparator}`);
        logger.info(`📈 Total: ${totalSuccess} successful, ${totalErrors} errors`);

        // Print error details if any
        if (totalErrors > 0) {
            logger.info(`\n   ${STATUS_ICONS.Error} Error details:`);
            for (const [entityName, stats] of this.stats.entries()) {
                if (stats.errors > 0) {
                    logger.info(`   ${entityName}:`);
                    for (const error of stats.errorDetails) {
                        logger.info(`      • ${error.file}: ${error.message}`);
                    }
                }
            }
        }

        logger.info(`${separator}`);
    }
}

export const summaryTracker = new SummaryTracker();
