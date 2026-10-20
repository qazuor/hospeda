import { createLogger } from '@repo/logger';

const logger = createLogger('billing-reconciliation-daily-summary');

/**
 * DEC-OBS-001 📌1: list an undercharged period charge with its subject and difference. This
 * does not open a mark or change the reason count; B11.6 replaces the logging default with the
 * aggregated daily summary.
 */
export interface ReconciliationDailySummary {
    addUndercharge(input: {
        readonly subscriptionId: string;
        readonly paymentId: string;
        readonly chargeId: string;
        readonly expectedMinor: number;
        readonly chargedMinor: number;
        readonly differenceMinor: number;
        readonly currency: string;
    }): Promise<void>;
}

/** Default until B11.6 connects the aggregated daily summary. */
export const loggedReconciliationDailySummary: ReconciliationDailySummary = {
    async addUndercharge(input) {
        logger.warn(input, 'Credited period charge is below the expected amount');
    }
};
