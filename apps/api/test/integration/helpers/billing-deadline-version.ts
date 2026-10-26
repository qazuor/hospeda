import { billingDeadlineVersions, getDb } from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';

const billingDeadlineVersion1Values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

/** Ensure the migration baseline exists after integration tests truncate it. */
export async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
}
