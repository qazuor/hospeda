import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    courtesyGrants,
    eq,
    getDb,
    gt,
    isNull,
    plans,
    planVersions,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import type { AdminSubscriptionDetail } from '@repo/schemas';
import {
    AdminSubscriptionDetailParamsSchema,
    AdminSubscriptionDetailSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { resolvePlanDisplayName } from '../plan-display-name.js';
import { assertAdminSubscriptionReadPermitted } from './admin-subscription-read-authorization.js';
import { computeCourtesyBalanceMonths } from './courtesy-balance.js';

/** Read one subscription and its currently open pause and courtesy for authorized staff. */
export async function getAdminSubscriptionDetail(
    input: { readonly actor?: Actor; readonly subscriptionId: string },
    ports: { readonly clock: Clock }
): Promise<AdminSubscriptionDetail> {
    assertAdminSubscriptionReadPermitted({ actor: input.actor });
    const parsed = AdminSubscriptionDetailParamsSchema.safeParse({
        subscriptionId: input.subscriptionId
    });
    if (!parsed.success) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid subscription id');
    }
    const { subscriptionId } = parsed.data;
    const now = ports.clock.now();
    const { row, pause, grant } = await getDb().transaction(async (tx) => {
        const [row] = await tx
            .select({
                id: subscriptions.id,
                status: subscriptions.status,
                class: subscriptions.class,
                vertical: subscriptions.vertical,
                userId: users.id,
                ownerEmail: users.email,
                displayName: users.displayName,
                deletedAt: users.deletedAt,
                planId: plans.id,
                planSlug: plans.slug,
                storedPlanName: plans.name,
                planVertical: plans.vertical,
                planVersionId: planVersions.id,
                planVersionCurrent: planVersions.current,
                planVersionSellable: planVersions.sellable,
                planVersionCreatedAt: planVersions.createdAt,
                cycle: billingOptions.cycle,
                amountMinor: billingOptions.amount,
                currency: billingOptions.currency,
                paymentMethod: subscriptions.paymentMethod,
                nextChargeAt: subscriptions.nextChargeAt,
                serviceEndsAt: subscriptions.serviceEndsAt,
                succeedsId: subscriptions.succeedsId,
                succeededById: subscriptions.succeededById,
                createdAt: subscriptions.createdAt
            })
            .from(subscriptions)
            .leftJoin(users, eq(subscriptions.userId, users.id))
            .leftJoin(planVersions, eq(subscriptions.planVersionId, planVersions.id))
            .leftJoin(plans, eq(planVersions.planId, plans.id))
            .leftJoin(billingOptions, eq(subscriptions.billingOptionId, billingOptions.id))
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1);
        if (!row) return { row: null, pause: null, grant: null };
        // Match readBase in temporary-courtesy-preview.ts: only the open pause.
        const [pause] = await tx
            .select({
                reason: subscriptionPauses.reason,
                startsAt: subscriptionPauses.startsAt,
                expectedEndAt: subscriptionPauses.expectedEndAt,
                requestedMonths: subscriptionPauses.requestedMonths
            })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        // Match readBase in temporary-courtesy-preview.ts: open balance and future end.
        const [grant] = await tx
            .select({
                id: courtesyGrants.id,
                months: courtesyGrants.months,
                startsAt: courtesyGrants.startsAt,
                endsAt: courtesyGrants.endsAt
            })
            .from(courtesyGrants)
            .where(
                and(
                    eq(courtesyGrants.subscriptionId, subscriptionId),
                    isNull(courtesyGrants.balanceMonths),
                    gt(courtesyGrants.endsAt, now)
                )
            )
            .limit(1);
        return { row, pause: pause ?? null, grant: grant ?? null };
    });
    if (!row) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Subscription not found');
    return AdminSubscriptionDetailSchema.parse({
        ...row,
        id: row.id,
        status: row.status,
        class: row.class,
        vertical: row.vertical,
        owner:
            row.userId && row.ownerEmail
                ? {
                      id: row.userId,
                      email: row.ownerEmail,
                      displayName: row.displayName,
                      deleted: row.deletedAt !== null
                  }
                : null,
        plan:
            row.planId && row.planSlug && row.storedPlanName && row.planVersionId
                ? {
                      planId: row.planId,
                      planName: await resolvePlanDisplayName({
                          vertical: row.planVertical,
                          plan: { slug: row.planSlug, name: row.storedPlanName }
                      }),
                      planVersionId: row.planVersionId
                  }
                : null,
        cycle: row.cycle,
        paymentMethod: row.paymentMethod,
        nextChargeAt: row.nextChargeAt,
        createdAt: row.createdAt,
        serviceEndsAt: row.serviceEndsAt,
        planVersion:
            row.planVersionId &&
            row.planVersionCurrent !== null &&
            row.planVersionSellable !== null &&
            row.planVersionCreatedAt
                ? {
                      id: row.planVersionId,
                      current: row.planVersionCurrent,
                      sellable: row.planVersionSellable,
                      createdAt: row.planVersionCreatedAt
                  }
                : null,
        price:
            row.amountMinor !== null && row.currency && row.cycle
                ? {
                      amountMinor: row.amountMinor,
                      currency: row.currency,
                      cycle: row.cycle
                  }
                : null,
        pause: pause
            ? {
                  reason: pause.reason,
                  startsAt: pause.startsAt,
                  expectedEndAt: pause.expectedEndAt,
                  requestedMonths: pause.requestedMonths
              }
            : null,
        courtesy: grant
            ? {
                  courtesyGrantId: grant.id,
                  months: grant.months,
                  startsAt: grant.startsAt,
                  endsAt: grant.endsAt,
                  remainingMonths: computeCourtesyBalanceMonths({
                      startsAt: grant.startsAt,
                      endsAt: grant.endsAt,
                      now
                  }).months
              }
            : null
    });
}
