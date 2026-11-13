import {
    and,
    billingOptions,
    count,
    desc,
    eq,
    getDb,
    ne,
    or,
    plans,
    planVersions,
    safeIlike,
    subscriptions,
    users
} from '@repo/db';
import type { AdminSubscriptionListItem, AdminSubscriptionListQuery } from '@repo/schemas';
import {
    AdminSubscriptionListItemSchema,
    AdminSubscriptionListQuerySchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { resolvePlanDisplayName } from '../plan-display-name.js';
import { assertAdminSubscriptionReadPermitted } from './admin-subscription-read-authorization.js';

const listInputSchema = AdminSubscriptionListQuerySchema.extend({
    actor: z
        .object({
            id: z.string().min(1),
            roles: z.array(z.string()),
            permissions: z.array(z.nativeEnum(PermissionEnum))
        })
        .passthrough()
});

/** List subscriptions for authorized support staff with stable pagination and owner search. */
export async function listAdminSubscriptions(
    input: { readonly actor?: Actor } & Partial<AdminSubscriptionListQuery>
): Promise<{ readonly items: readonly AdminSubscriptionListItem[]; readonly total: number }> {
    assertAdminSubscriptionReadPermitted({ actor: input.actor });
    const parsed = listInputSchema.safeParse(input);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid administrative subscription list query'
        );
    }
    const { page, pageSize, q, vertical, status } = parsed.data;
    const search = q
        ? z.uuid().safeParse(q).success
            ? or(eq(subscriptions.id, q), eq(subscriptions.userId, q))
            : or(safeIlike(users.email, q), safeIlike(users.displayName, q))
        : undefined;
    const where = and(
        ne(subscriptions.class, 'LAPIDA'),
        search,
        vertical ? eq(subscriptions.vertical, vertical) : undefined,
        status ? eq(subscriptions.status, status) : undefined
    );
    const { total, rows } = await getDb().transaction(async (tx) => {
        const [{ total = 0 } = {}] = await tx
            .select({ total: count() })
            .from(subscriptions)
            .leftJoin(users, eq(subscriptions.userId, users.id))
            .where(where);
        const rows = await tx
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
                cycle: billingOptions.cycle,
                paymentMethod: subscriptions.paymentMethod,
                nextChargeAt: subscriptions.nextChargeAt,
                createdAt: subscriptions.createdAt
            })
            .from(subscriptions)
            .leftJoin(users, eq(subscriptions.userId, users.id))
            .leftJoin(planVersions, eq(subscriptions.planVersionId, planVersions.id))
            .leftJoin(plans, eq(planVersions.planId, plans.id))
            .leftJoin(billingOptions, eq(subscriptions.billingOptionId, billingOptions.id))
            .where(where)
            .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        return { total, rows };
    });
    const items = await Promise.all(
        rows.map(async (row) =>
            AdminSubscriptionListItemSchema.parse({
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
                createdAt: row.createdAt
            })
        )
    );
    return { items, total };
}
