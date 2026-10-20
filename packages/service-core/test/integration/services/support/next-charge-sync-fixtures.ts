import { emailOutbox, eq } from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { currentVersion, readOutboxRows } from './renewal-notice-fixtures.js';

/** Reads this row's next charge date after a sweep run. */
export async function readNextChargeAt(subscriptionId: string): Promise<Date | null> {
    const db = getServiceTestDb();
    const [row] = await db.query.subscriptions.findMany({
        where: (table, operators) => operators.eq(table.id, subscriptionId),
        columns: { nextChargeAt: true }
    });
    return row?.nextChargeAt ?? null;
}

/** Reads this row's update clock without observing unrelated subscription writes. */
export async function readSubscriptionUpdatedAt(subscriptionId: string): Promise<Date | null> {
    const db = getServiceTestDb();
    const [row] = await db.query.subscriptions.findMany({
        where: (table, operators) => operators.eq(table.id, subscriptionId),
        columns: { updatedAt: true }
    });
    return row?.updatedAt ?? null;
}

/** Exposes the established version-one deadline fixture to the notice bridge test. */
export const reconciliationCurrentDeadlines = () => currentVersion();

/** Removes only this test user's outbox rows. */
export async function clearRenewalOutbox(userId: string): Promise<void> {
    const db = getServiceTestDb();
    await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
}

/** Reads renewal notice rows for this subscription, not global population counts. */
export async function renewalRows(subscriptionId: string) {
    return readOutboxRows(getServiceTestDb(), subscriptionId);
}
