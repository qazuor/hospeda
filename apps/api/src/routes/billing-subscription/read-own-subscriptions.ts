import {
    and,
    asc,
    courtesyGrants,
    emailOutbox,
    eq,
    getDb,
    inArray,
    isNotNull,
    isNull,
    SUBSCRIPTION_STATUSES,
    sql,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { PAID_AFTER_CANCELLATION_TEMPLATE } from '@repo/service-core';
import { z } from 'zod';

const logger = createLogger('read-own-subscriptions');
const paidAfterCancellationPayloadSchema = z
    .object({
        subscriptionId: z.string().uuid(),
        recurringAddonsCut: z.boolean()
    })
    .passthrough();

/** Read the owner's principal subscriptions that have a self-service cancellation surface. */
export async function readOwnSubscriptions(userId: string) {
    const statuses = SUBSCRIPTION_STATUSES.filter((status) =>
        ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED'].includes(status)
    );
    const rows = await getDb()
        .select({
            id: subscriptions.id,
            vertical: subscriptions.vertical,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            serviceEndsAt: subscriptions.serviceEndsAt,
            graceEndsAt: subscriptions.graceEndsAt,
            createdAt: subscriptions.createdAt
        })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, statuses)
            )
        )
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));
    const ids = rows.map(({ id }) => id);
    const marks =
        ids.length === 0
            ? []
            : await getDb()
                  .select({
                      subscriptionId: sql<string>`${emailOutbox.payload}->>'subscriptionId'`,
                      payload: emailOutbox.payload
                  })
                  .from(emailOutbox)
                  .where(
                      and(
                          eq(emailOutbox.recipientUserId, userId),
                          eq(emailOutbox.template, PAID_AFTER_CANCELLATION_TEMPLATE),
                          inArray(sql<string>`${emailOutbox.payload}->>'subscriptionId'`, ids)
                      )
                  );
    const marksById = new Map<string, { recurringAddonsCut: boolean }>();
    for (const mark of marks) {
        const parsed = paidAfterCancellationPayloadSchema.safeParse(mark.payload);
        if (!parsed.success) {
            logger.error(
                { subscriptionId: mark.subscriptionId },
                'Invalid paid-after-cancellation outbox payload'
            );
            marksById.set(mark.subscriptionId, { recurringAddonsCut: false });
            continue;
        }
        marksById.set(parsed.data.subscriptionId, {
            recurringAddonsCut: parsed.data.recurringAddonsCut
        });
    }
    return rows.map((row) => ({
        ...row,
        paidAfterCancellation:
            row.status === 'CANCEL_SCHEDULED' ? (marksById.get(row.id) ?? null) : null
    }));
}

/** Read deferred courtesy terms belonging to the owner, for display only. */
export async function readOwnDeferredCourtesies(userId: string) {
    return getDb()
        .select({
            courtesyGrantId: courtesyGrants.id,
            vertical: subscriptions.vertical,
            balanceMonths: courtesyGrants.balanceMonths
        })
        .from(courtesyGrants)
        .innerJoin(subscriptions, eq(courtesyGrants.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(courtesyGrants.beneficiaryUserId, userId),
                isNotNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt)
            )
        )
        .orderBy(asc(courtesyGrants.createdAt), asc(courtesyGrants.id));
}
