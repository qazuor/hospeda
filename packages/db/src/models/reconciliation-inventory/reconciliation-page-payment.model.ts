import { and, asc, eq, gt, gte, ne } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    addonInstances,
    addonProducts,
    type SelectAddonInstance
} from '../../schemas/vertical/addon-product.dbschema.ts';
import { idempotencyKeys } from '../../schemas/vertical/idempotency-key.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Input for one keyset page of settled one-time page purchases bought inside the window. */
export interface ListSettledOneTimePagePurchasesInWindowPageInput {
    /** Inclusive lower bound on the purchase's `created_at` (now − deadline 18). */
    readonly since: Date;
    /** Exclusive addon instance id cursor. */
    readonly afterInstanceId?: string;
    /** Maximum rows to return. */
    readonly limit: number;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** A settled one-time page purchase. */
export interface SettledOneTimePagePurchaseRow {
    /**
     * The purchase. Its `created_at` comes from the injected clock in the same transaction as
     * its page key, before the page call: no payment on the page can predate it.
     */
    readonly instance: SelectAddonInstance;
}

/** Read model for the page-payments check of the reconciliation sweep (HOS-2179 §5.10). */
export class ReconciliationPagePaymentModel {
    /**
     * One keyset page, by instance id, of instances of a `UNA_VEZ` product with a
     * `PAYMENT_PAGE_CREATE` idempotency key, bought inside the window, that no longer wait for
     * their payment (any status but
     * `PENDING_AUTHORIZATION`: a waiting purchase belongs to A3). Unlike the paid-orders read,
     * an instance that already carries a mark is NOT left out: a page takes more than one
     * payment (RP18), so a later payment is new money. The check skips, per charge, a payment
     * a mark already names.
     */
    async listSettledOneTimePagePurchasesInWindowPage(
        input: ListSettledOneTimePagePurchasesInWindowPageInput
    ): Promise<SettledOneTimePagePurchaseRow[]> {
        const db = input.tx ?? getDb();
        const rows = await db
            .selectDistinctOn([addonInstances.id], { instance: addonInstances })
            .from(addonInstances)
            .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .innerJoin(
                idempotencyKeys,
                and(
                    eq(idempotencyKeys.subjectId, addonInstances.id),
                    eq(idempotencyKeys.operation, 'PAYMENT_PAGE_CREATE')
                )
            )
            .where(
                and(
                    ne(addonInstances.status, 'PENDING_AUTHORIZATION'),
                    gte(addonInstances.createdAt, input.since),
                    eq(addonProducts.chargeKind, 'UNA_VEZ'),
                    input.afterInstanceId === undefined
                        ? undefined
                        : gt(addonInstances.id, input.afterInstanceId)
                )
            )
            .orderBy(asc(addonInstances.id))
            .limit(input.limit);
        return rows;
    }
}

/** Shared page-payment read model of the reconciliation sweep. */
export const reconciliationPagePaymentModel = new ReconciliationPagePaymentModel();
