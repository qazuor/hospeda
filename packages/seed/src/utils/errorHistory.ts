import { STATUS_ICONS } from './icons.js';
import { logger } from './logger.js';

/**
 * Represents an error that occurred during the seeding process
 */
export interface SeedError {
    /** Timestamp when the error occurred */
    timestamp: Date;
    /** Entity type where the error occurred */
    entityType: string;
    /** File or context where the error occurred */
    context: string;
    /** Error message */
    message: string;
    /** Error stack trace (if available) */
    stack?: string;
    /** Additional error details */
    details?: string;
    /** Error severity level */
    severity: 'error' | 'warning' | 'info';
}

/**
 * Error history manager for the seeding process.
 *
 * This class provides:
 * - Comprehensive error tracking with timestamps
 * - Error categorization by entity type and severity
 * - Detailed error information including stack traces
 * - Formatted error summaries for final reporting
 *
 * @example
 * ```typescript
 * errorHistory.recordError('Users', 'user-001.json', 'Validation failed', error);
 * errorHistory.recordWarning('Posts', 'post-002.json', 'Skipped due to missing dependency');
 * errorHistory.printSummary(); // Prints comprehensive error summary
 * ```
 */
class ErrorHistory {
    /** All recorded errors */
    private errors: SeedError[] = [];
    /** Start time of the seeding process */
    private startTime: Date | null = null;
    /** End time of the seeding process */
    private endTime: Date | null = null;

    /**
     * Starts the error tracking session
     */
    startTracking(): void {
        this.startTime = new Date();
        this.errors = [];
    }

    /**
     * Stops the error tracking session
     */
    stopTracking(): void {
        this.endTime = new Date();
    }

    /**
     * Records an error with full details
     *
     * @param entityType - Type of entity where error occurred
     * @param context - File or context where error occurred
     * @param message - Error message
     * @param error - Original error object
     * @param severity - Error severity level
     */
    recordError(
        entityType: string,
        context: string,
        message: string,
        error?: unknown,
        severity: 'error' | 'warning' | 'info' = 'error'
    ): void {
        const seedError: SeedError = {
            timestamp: new Date(),
            entityType,
            context,
            message,
            severity,
            stack: error instanceof Error ? error.stack : undefined,
            details: error instanceof Error ? error.message : String(error)
        };

        this.errors.push(seedError);

        // Log the error immediately for real-time visibility
        const icon =
            severity === 'error'
                ? STATUS_ICONS.Error
                : severity === 'warning'
                  ? STATUS_ICONS.Warning
                  : STATUS_ICONS.Info;

        logger.error(`${icon} ${entityType} (${context}): ${message}`);
    }

    /**
     * Records a warning
     */
    recordWarning(entityType: string, context: string, message: string, error?: unknown): void {
        this.recordError(entityType, context, message, error, 'warning');
    }

    /**
     * Records an info message
     */
    recordInfo(entityType: string, context: string, message: string, error?: unknown): void {
        this.recordError(entityType, context, message, error, 'info');
    }

    /**
     * Gets all errors grouped by entity type
     */
    getErrorsByEntity(): Map<string, SeedError[]> {
        const grouped = new Map<string, SeedError[]>();

        for (const error of this.errors) {
            if (!grouped.has(error.entityType)) {
                grouped.set(error.entityType, []);
            }
            const entityErrors = grouped.get(error.entityType);
            if (entityErrors) {
                entityErrors.push(error);
            }
        }

        return grouped;
    }

    /**
     * Gets all errors grouped by severity
     */
    getErrorsBySeverity(): Map<string, SeedError[]> {
        const grouped = new Map<string, SeedError[]>();

        for (const error of this.errors) {
            if (!grouped.has(error.severity)) {
                grouped.set(error.severity, []);
            }
            const severityErrors = grouped.get(error.severity);
            if (severityErrors) {
                severityErrors.push(error);
            }
        }

        return grouped;
    }

    /**
     * Gets total error count
     */
    getTotalErrors(): number {
        return this.errors.length;
    }

    /**
     * Gets error count by severity
     */
    getErrorCountBySeverity(): { error: number; warning: number; info: number } {
        const counts = { error: 0, warning: 0, info: 0 };

        for (const error of this.errors) {
            counts[error.severity]++;
        }

        return counts;
    }

    /**
     * Gets the duration of the error tracking session
     */
    getDuration(): string {
        if (!this.startTime || !this.endTime) {
            return 'N/A';
        }

        const durationMs = this.endTime.getTime() - this.startTime.getTime();
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const milliseconds = durationMs % 1000;

        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s ${milliseconds}ms`;
        }
        if (seconds > 0) {
            return `${seconds}s ${milliseconds}ms`;
        }
        return `${milliseconds}ms`;
    }

    /**
     * Prints a comprehensive error summary
     */
    printSummary(): void {
        if (this.errors.length === 0) {
            logger.info(`${STATUS_ICONS.Success} No errors recorded during seeding process`);
            return;
        }

        const separator = '='.repeat(100);
        const subSeparator = '-'.repeat(100);

        logger.error(`\n${STATUS_ICONS.Error} ERROR SUMMARY`);
        logger.info(separator);

        // Print session duration
        logger.info(`⏱️  Session duration: ${this.getDuration()}`);
        logger.info(`📊 Total issues recorded: ${this.getTotalErrors()}`);

        // Print error counts by severity
        const severityCounts = this.getErrorCountBySeverity();
        logger.error(`   • Errors: ${severityCounts.error}`);
        logger.warn(`   • Warnings: ${severityCounts.warning}`);
        logger.info(`   • Info: ${severityCounts.info}`);

        logger.info(subSeparator);

        // Print errors grouped by entity type
        const errorsByEntity = this.getErrorsByEntity();
        for (const [entityType, entityErrors] of errorsByEntity.entries()) {
            logger.info(`\n${STATUS_ICONS.Info} ${entityType} (${entityErrors.length} issues):`);

            for (const error of entityErrors) {
                const icon =
                    error.severity === 'error'
                        ? STATUS_ICONS.Error
                        : error.severity === 'warning'
                          ? STATUS_ICONS.Warning
                          : STATUS_ICONS.Info;

                const timeStr = error.timestamp.toLocaleTimeString();
                logger[
                    error.severity === 'error'
                        ? 'error'
                        : error.severity === 'warning'
                          ? 'warn'
                          : 'info'
                ](`   ${icon} [${timeStr}] ${error.context}: ${error.message}`);

                // Show additional details if available
                if (error.details && error.details !== error.message) {
                    logger.error(`      Details: ${error.details}`);
                }
            }
        }

        // Print errors grouped by severity
        logger.info(`\n${STATUS_ICONS.Info} Issues by severity:`);
        const errorsBySeverity = this.getErrorsBySeverity();

        for (const [severity, severityErrors] of errorsBySeverity.entries()) {
            const icon =
                severity === 'error'
                    ? STATUS_ICONS.Error
                    : severity === 'warning'
                      ? STATUS_ICONS.Warning
                      : STATUS_ICONS.Info;

            logger[severity === 'error' ? 'error' : severity === 'warning' ? 'warn' : 'info'](
                `\n   ${icon} ${severity.toUpperCase()} (${severityErrors.length}):`
            );

            for (const error of severityErrors) {
                const timeStr = error.timestamp.toLocaleTimeString();
                logger.error(
                    `      [${timeStr}] ${error.entityType} (${error.context}): ${error.message}`
                );
            }
        }

        // Print detailed stack traces for errors (if any)
        const errorsWithStack = this.errors.filter((e) => e.stack && e.severity === 'error');
        if (errorsWithStack.length > 0) {
            logger.info(`\n${STATUS_ICONS.Error} Detailed error information:`);

            for (const error of errorsWithStack) {
                logger.info(
                    `\n   ${error.entityType} (${error.context}) at ${error.timestamp.toLocaleTimeString()}:`
                );
                logger.info(`   Message: ${error.message}`);
                if (error.stack) {
                    logger.info('   Stack trace:');
                    // Split stack trace and indent each line
                    const stackLines = error.stack.split('\n');
                    for (const line of stackLines) {
                        logger.info(`      ${line}`);
                    }
                }
            }
        }

        logger.info(separator);
    }

    /**
     * Clears all recorded errors
     */
    clear(): void {
        this.errors = [];
        this.startTime = null;
        this.endTime = null;
    }
}

export const errorHistory = new ErrorHistory();
