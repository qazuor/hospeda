import { billingOptions, eq, getDb, plans, planVersions, subscriptions, users } from '@repo/db';

/** Read a subscription and its account subject from the persisted row. */
export async function readSubscription(subscriptionId: string) {
    const [found] = await getDb()
        .select({
            id: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            billingOptionId: subscriptions.billingOptionId,
            declaredPayerEmail: subscriptions.declaredPayerEmail,
            status: subscriptions.status,
            class: subscriptions.class,
            paymentMethod: subscriptions.paymentMethod,
            nextChargeAt: subscriptions.nextChargeAt,
            serviceEndsAt: subscriptions.serviceEndsAt,
            createdAt: subscriptions.createdAt,
            subjectName: users.displayName,
            subjectEmail: users.email,
            planName: plans.name,
            planSlug: plans.slug,
            planId: plans.id,
            planVersionId: planVersions.id,
            cycle: billingOptions.cycle,
            amountMinor: billingOptions.amount,
            currency: billingOptions.currency
        })
        .from(subscriptions)
        .leftJoin(users, eq(subscriptions.userId, users.id))
        .leftJoin(planVersions, eq(subscriptions.planVersionId, planVersions.id))
        .leftJoin(plans, eq(planVersions.planId, plans.id))
        .leftJoin(billingOptions, eq(subscriptions.billingOptionId, billingOptions.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);
    if (!found) return null;
    const {
        subjectName,
        subjectEmail,
        planName,
        planSlug,
        planId,
        planVersionId,
        cycle,
        amountMinor,
        currency,
        ...row
    } = found;
    return {
        row: { ...row, planVersionId },
        subjectId: row.userId,
        subject: row.userId
            ? {
                  id: row.userId,
                  ...(subjectName ? { displayName: subjectName } : {}),
                  ...(subjectEmail ? { email: subjectEmail } : {})
              }
            : undefined,
        currentPlan: planName && planSlug && cycle ? { planName, planSlug, cycle } : undefined,
        currentBillingOption:
            row.billingOptionId &&
            planName &&
            planSlug &&
            planId &&
            planVersionId &&
            cycle &&
            amountMinor !== null &&
            currency === 'ARS'
                ? {
                      billingOptionId: row.billingOptionId,
                      planId,
                      planName,
                      planSlug,
                      planVersionId,
                      cycle,
                      amountMinor,
                      currency,
                      current: true
                  }
                : undefined
    };
}
