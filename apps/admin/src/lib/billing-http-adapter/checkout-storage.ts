/**
 * HTTP-based checkout storage implementation (stub).
 *
 * The admin app does not currently consume `billing.checkout.*` operations —
 * checkouts are created by the API/web flows. This stub satisfies the
 * `QZPayCheckoutStorage` contract added in `@qazuor/qzpay-core` 1.5.0 so the
 * HTTP adapter compiles, and throws a clear error if any admin code paths
 * unexpectedly reach into checkout storage. When admin needs to surface
 * checkouts (e.g. in a billing dashboard), implement these methods against
 * `/api/v1/admin/billing/checkouts/*` following the customer-storage pattern.
 */
import type {
    QZPayCheckoutSession,
    QZPayCheckoutStorage,
    QZPayListOptions,
    QZPayPaginatedResult
} from '@qazuor/qzpay-core';

const NOT_IMPLEMENTED =
    'createCheckoutStorage (admin HTTP adapter) is a stub. Implement against /api/v1/admin/billing/checkouts/* when admin needs checkout surfaces.';

export function createCheckoutStorage(): QZPayCheckoutStorage {
    return {
        create: async (_session: QZPayCheckoutSession): Promise<QZPayCheckoutSession> => {
            throw new Error(NOT_IMPLEMENTED);
        },
        update: async (
            _id: string,
            _input: Partial<QZPayCheckoutSession>
        ): Promise<QZPayCheckoutSession> => {
            throw new Error(NOT_IMPLEMENTED);
        },
        findById: async (_id: string): Promise<QZPayCheckoutSession | null> => {
            throw new Error(NOT_IMPLEMENTED);
        },
        findByCustomerId: async (_customerId: string): Promise<QZPayCheckoutSession[]> => {
            throw new Error(NOT_IMPLEMENTED);
        },
        list: async (
            _options?: QZPayListOptions
        ): Promise<QZPayPaginatedResult<QZPayCheckoutSession>> => {
            throw new Error(NOT_IMPLEMENTED);
        }
    };
}
