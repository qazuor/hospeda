import { and, type DrizzleClient, eq, gt, subscriptionPauses, subscriptions } from '@repo/db';
import { z } from 'zod';

/** The customer-request pause usage for every principal of one user and vertical. */
export async function readPauseQuota(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
    readonly vertical: string;
    readonly now: Date;
}): Promise<{ readonly pausesInWindow: number; readonly monthsInWindow: number }> {
    const value = z
        .strictObject({
            tx: z.custom<DrizzleClient>((candidate) => candidate != null),
            userId: z.uuid(),
            vertical: z.string().min(1),
            now: z.date()
        })
        .parse(input);
    const windowStart = new Date(value.now);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - 12);
    const rows = await value.tx
        .select({
            startsAt: subscriptionPauses.startsAt,
            actualEndAt: subscriptionPauses.actualEndAt,
            requestedMonths: subscriptionPauses.requestedMonths
        })
        .from(subscriptionPauses)
        .innerJoin(subscriptions, eq(subscriptionPauses.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.userId, value.userId),
                eq(subscriptions.vertical, value.vertical),
                eq(subscriptionPauses.reason, 'CUSTOMER_REQUEST'),
                gt(subscriptionPauses.startsAt, windowStart)
            )
        );
    const monthsInWindow = rows.reduce((total, row) => {
        if (!row.actualEndAt) return total + (row.requestedMonths ?? 0);
        const start = row.startsAt;
        const end = row.actualEndAt;
        const wholeMonths =
            (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
            end.getUTCMonth() -
            start.getUTCMonth();
        const anniversary = new Date(start);
        anniversary.setUTCMonth(anniversary.getUTCMonth() + wholeMonths);
        return total + Math.max(1, wholeMonths + (anniversary < end ? 1 : 0));
    }, 0);
    return { pausesInWindow: rows.length, monthsInWindow };
}
