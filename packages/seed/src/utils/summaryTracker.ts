import { logger } from './logger.js';

interface SummaryStats {
    success: number;
    errors: number;
    errorDetails: Array<{
        file: string;
        message: string;
    }>;
}

class SummaryTracker {
    private stats = new Map<string, SummaryStats>();

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

    print(): void {
        const separator = '#'.repeat(90);
        const subSeparator = '─'.repeat(90);

        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n');
        logger.info('📊  SUMMARY FINAL');
        logger.info(`${subSeparator}`);

        if (this.stats.size === 0) {
            logger.info('   No hay estadísticas disponibles');
            logger.info(`${separator}`);
            return;
        }

        let totalSuccess = 0;
        let totalErrors = 0;

        // Print entity summaries
        for (const [entityName, stats] of this.stats.entries()) {
            const icon = this.getEntityIcon(entityName);
            const status = stats.errors === 0 ? '✅' : '⚠️';

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
            logger.info('\n   ❌ Detalles de errores:');
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

    private getEntityIcon(entityName: string): string {
        const iconMap: Record<string, string> = {
            Users: '👤',
            Destinations: '🗺️ ',
            Amenities: '🏠',
            Features: '⭐',
            Accommodations: '🏨',
            Tags: '🏷️',
            Posts: '📝',
            Events: '🎉',
            Attractions: '🎯',
            Reviews: '⭐',
            Bookmarks: '🔖',
            Sponsors: '💼',
            Organizers: '👥',
            Locations: '📍'
        };
        return iconMap[entityName] || '📦';
    }
}

export const summaryTracker = new SummaryTracker();
