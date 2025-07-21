import { logger } from './logger.js';

type SummaryItem = {
    entity: string;
    success: number;
    errors: { file: string; message: string }[];
};

const summary: SummaryItem[] = [];

export const summaryTracker = {
    trackSuccess(entity: string) {
        let item = summary.find((s) => s.entity === entity);
        if (!item) {
            item = { entity, success: 0, errors: [] };
            summary.push(item);
        }
        item.success++;
    },

    trackError(entity: string, file: string, message: string) {
        let item = summary.find((s) => s.entity === entity);
        if (!item) {
            item = { entity, success: 0, errors: [] };
            summary.push(item);
        }
        item.errors.push({ file, message });
    },

    print() {
        logger.info('\n📊 Summary Final:');
        for (const item of summary) {
            logger.info(
                `- ${item.entity}: ${item.success} cargados, ${item.errors.length} errores`
            );
        }

        if (summary.some((s) => s.errors.length > 0)) {
            logger.warn('\n⚠️ Errores:');
            for (const item of summary) {
                for (const err of item.errors) {
                    logger.error(`- ${item.entity} → ${err.file} → ${err.message}`);
                }
            }
        }
    },

    showErrors() {
        if (summary.some((s) => s.errors.length > 0)) {
            // 🔍 LOG DISTINTIVO: summary tracker
            console.error('🔍 [SUMMARY_TRACKER] Mostrando resumen de errores');

            logger.error('\n❌ Errores encontrados:');
            for (const item of summary) {
                for (const err of item.errors) {
                    logger.error(`- ${item.entity} → ${err.file} → ${err.message}`);
                }
            }
        }
    }
};
