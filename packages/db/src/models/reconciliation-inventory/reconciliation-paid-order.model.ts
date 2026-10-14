import { and, asc, eq, gt, gte, min, notExists } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    addonInstances,
    addonProducts,
    type SelectAddonInstance
} from '../../schemas/vertical/addon-product.dbschema.ts';
import { idempotencyKeys } from '../../schemas/vertical/idempotency-key.dbschema.ts';
import { reconciliationMarks } from '../../schemas/vertical/reconciliation-mark.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Input for one keyset page of abandoned one-time instances with an order key in the window. */
export interface ListAbandonedOneTimeOrdersInWindowPageInput {
    /** Inclusive lower bound on the order key's `created_at` (now − deadline 18). */
    readonly since: Date;
    /** Exclusive addon instance id cursor. */
    readonly afterInstanceId?: string;
    /** Maximum rows to return. */
    readonly limit: number;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** An abandoned one-time instance and the creation of its (oldest) order key. */
export interface AbandonedOneTimeOrderRow {
    readonly instance: SelectAddonInstance;
    /** The key is persisted before the order call: the order cannot predate it (EX-57 window anchor). */
    readonly orderKeyCreatedAt: Date;
}

/** Read model for the paid-orders check of the reconciliation sweep (AC:B11:13). */
export class ReconciliationPaidOrderModel {
    /**
     * One keyset page, by instance id, of `ABANDONED` instances of a `UNA_VEZ`
     * product with an `ORDER_CREATE` idempotency key (the oldest one, when there
     * are several) created inside the window (HOS-1605 H11). An instance that
     * already had a reason-23 mark, OPEN OR LIFTED, is left out on purpose
     * (HOS-1605 H12): a person settled and lifted it, and the order stays paid
     * at the provider, so re-reading it would reopen the mark every day.
     */
    async listAbandonedOneTimeOrdersInWindowPage(
        input: ListAbandonedOneTimeOrdersInWindowPageInput
    ): Promise<AbandonedOneTimeOrderRow[]> {
        const db = input.tx ?? getDb();
        const keyCreatedAt = min(idempotencyKeys.createdAt);
        const rows = await db
            .select({ instance: addonInstances, orderKeyCreatedAt: keyCreatedAt })
            .from(addonInstances)
            .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .innerJoin(
                idempotencyKeys,
                and(
                    eq(idempotencyKeys.subjectId, addonInstances.id),
                    eq(idempotencyKeys.operation, 'ORDER_CREATE')
                )
            )
            .where(
                and(
                    eq(addonInstances.status, 'ABANDONED'),
                    eq(addonProducts.chargeKind, 'UNA_VEZ'),
                    notExists(
                        db
                            .select({ id: reconciliationMarks.id })
                            .from(reconciliationMarks)
                            .where(
                                and(
                                    eq(reconciliationMarks.addonInstanceId, addonInstances.id),
                                    eq(reconciliationMarks.reason, 'ORDEN_PAGADA_SIN_INSTANCIA')
                                )
                            )
                    ),
                    input.afterInstanceId === undefined
                        ? undefined
                        : gt(addonInstances.id, input.afterInstanceId)
                )
            )
            .groupBy(addonInstances.id)
            .having(gte(keyCreatedAt, input.since))
            .orderBy(asc(addonInstances.id))
            .limit(input.limit);
        return rows.flatMap(({ instance, orderKeyCreatedAt }) =>
            orderKeyCreatedAt === null ? [] : [{ instance, orderKeyCreatedAt }]
        );
    }
}

/** Shared paid-order read model of the reconciliation sweep. */
export const reconciliationPaidOrderModel = new ReconciliationPaidOrderModel();
