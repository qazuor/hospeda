/**
 * Well-known UUID sentinel used as sourceId for aggregated addon limit recalculations.
 * When a plan change triggers Flow B, or when an individual addon cancellation triggers
 * re-recalculation (AC-3.9), the resulting aggregated limit is stored with this sourceId
 * instead of a specific purchaseId. This allows `removeBySource('addon', ADDON_RECALC_SOURCE_ID)`
 * to target only the aggregated limit without affecting individual addon entitlements.
 *
 * Why a UUID? QZPay's `billing_customer_limits.source_id` column is PostgreSQL `uuid` type.
 * Non-UUID strings (like 'recalc') are rejected at runtime with
 * `invalid input syntax for type uuid`.
 *
 * Hand-crafted well-known UUID reserved for addon recalculation operations.
 */
export const ADDON_RECALC_SOURCE_ID = 'a0d0e1c2-0000-5000-8000-000000000001';
