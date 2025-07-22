import { STATUS_ICONS, getEntityIcon, getStatusIcon } from './icons.js';
import { logger } from './logger.js';

interface SummaryStats {
    success: number;
    errors: number;
    errorDetails: Array<{
        file: string;
        message: string;
    }>;
}

interface ProcessStep {
    name: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    details?: string;
}

class SummaryTracker {
    private stats = new Map<string, SummaryStats>();
    private processSteps: ProcessStep[] = [];

    trackSuccess(entityName: string): void {
        const current = this.stats.get(entityName) || { success: 0, errors: 0, errorDetails: [] };
        current.success++;
        this.stats.set(entityName, current);
    }

    trackError(entityName: string, file: string, message: string): void {
        const current = this.stats.get(entityName) || { success: 0, errors: 0, errorDetails: [] };
        current.errors++;
        current.errorDetails.push({ file, message });
        this.stats.set(entityName, current);
    }

    trackProcessStep(
        name: string,
        status: 'success' | 'error' | 'warning',
        message: string,
        details?: string
    ): void {
        this.processSteps.push({ name, status, message, details });
    }

    print(): void {
        const separator = '#'.repeat(90);
        const subSeparator = '─'.repeat(90);

        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n');
        logger.info(`${STATUS_ICONS.Info}  SUMMARY FINAL`);
        logger.info(`${subSeparator}`);

        // Print process steps first
        if (this.processSteps.length > 0) {
            logger.info(`${STATUS_ICONS.Process} Pasos del proceso:`);
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
            logger.info('   No hay estadísticas de entidades disponibles');
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
                `${status} ${icon} ${entityName}: ${stats.success} cargados, ${stats.errors} errores`
            );
            totalSuccess += stats.success;
            totalErrors += stats.errors;
        }

        // Print totals
        logger.info(`${subSeparator}`);
        logger.info(`📈 Total: ${totalSuccess} exitosos, ${totalErrors} errores`);

        // Print error details if any
        if (totalErrors > 0) {
            logger.info(`\n   ${STATUS_ICONS.Error} Detalles de errores:`);
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
