/**
 * Billing Module
 *
 * Provides integration with QZPay billing library through Drizzle ORM.
 * This module exports:
 * - Storage adapter factory for QZPay
 * - All billing schemas and types
 * - Database table definitions
 *
 * @module @repo/db/billing
 */

// Export adapter factory and types
export {
    createBillingAdapter,
    type QZPayAdapterConfig,
    type QZPayStorageAdapter,
    type QZPayDrizzleStorageAdapter
} from './drizzle-adapter.ts';
// Export schemas and types (excluding transaction utilities to avoid conflicts)
export {
    // Add-on exports
    billingAddonInsertSchema,
    billingAddonSelectSchema,
    billingAddons,
    billingSubscriptionAddonInsertSchema,
    billingSubscriptionAddonSelectSchema,
    billingSubscriptionAddons,
    type QZPayBillingAddon,
    type QZPayBillingAddonInsert,
    type QZPayBillingAddonInsertInput,
    type QZPayBillingSubscriptionAddon,
    type QZPayBillingSubscriptionAddonInsert,
    type QZPayBillingSubscriptionAddonInsertInput,
    // Audit logs exports
    billingAuditLogInsertSchema,
    billingAuditLogSelectSchema,
    billingAuditLogs,
    type QZPayBillingAuditLog,
    type QZPayBillingAuditLogInsert,
    // Customer exports
    billingCustomerInsertSchema,
    billingCustomerSelectSchema,
    billingCustomers,
    type QZPayBillingCustomer,
    type QZPayBillingCustomerInsert,
    type QZPayBillingCustomerInsertInput,
    // Entitlement exports
    billingCustomerEntitlementInsertSchema,
    billingCustomerEntitlementSelectSchema,
    billingCustomerEntitlements,
    billingEntitlementInsertSchema,
    billingEntitlementSelectSchema,
    billingEntitlements,
    type QZPayBillingCustomerEntitlement,
    type QZPayBillingCustomerEntitlementInsert,
    type QZPayBillingCustomerEntitlementInsertInput,
    type QZPayBillingEntitlement,
    type QZPayBillingEntitlementInsert,
    type QZPayBillingEntitlementInsertInput,
    // Idempotency keys exports
    billingIdempotencyKeyInsertSchema,
    billingIdempotencyKeySelectSchema,
    billingIdempotencyKeys,
    type QZPayBillingIdempotencyKey,
    type QZPayBillingIdempotencyKeyInsert,
    // Invoice exports
    billingInvoiceInsertSchema,
    billingInvoiceLines,
    billingInvoicePayments,
    billingInvoiceSelectSchema,
    billingInvoices,
    type QZPayBillingInvoice,
    type QZPayBillingInvoiceInsert,
    type QZPayBillingInvoiceInsertInput,
    type QZPayBillingInvoiceLine,
    type QZPayBillingInvoiceLineInsert,
    type QZPayBillingInvoicePayment,
    type QZPayBillingInvoicePaymentInsert,
    // Limit exports
    billingCustomerLimitInsertSchema,
    billingCustomerLimitSelectSchema,
    billingCustomerLimits,
    billingLimitInsertSchema,
    billingLimitSelectSchema,
    billingLimits,
    type QZPayBillingCustomerLimit,
    type QZPayBillingCustomerLimitInsert,
    type QZPayBillingCustomerLimitInsertInput,
    type QZPayBillingLimit,
    type QZPayBillingLimitInsert,
    type QZPayBillingLimitInsertInput,
    // Payment method exports
    billingPaymentMethodInsertSchema,
    billingPaymentMethodSelectSchema,
    billingPaymentMethods,
    type QZPayBillingPaymentMethod,
    type QZPayBillingPaymentMethodInsert,
    type QZPayBillingPaymentMethodInsertInput,
    // Payment exports
    billingPaymentInsertSchema,
    billingPaymentSelectSchema,
    billingPayments,
    billingRefunds,
    type QZPayBillingPayment,
    type QZPayBillingPaymentInsert,
    type QZPayBillingPaymentInsertInput,
    type QZPayBillingRefund,
    type QZPayBillingRefundInsert,
    // Plan exports
    billingPlanInsertSchema,
    billingPlanSelectSchema,
    billingPlans,
    type QZPayBillingPlan,
    type QZPayBillingPlanInsert,
    type QZPayBillingPlanInsertInput,
    // Price exports
    billingPriceInsertSchema,
    billingPriceSelectSchema,
    billingPrices,
    type QZPayBillingPrice,
    type QZPayBillingPriceInsert,
    type QZPayBillingPriceInsertInput,
    // Promo code exports
    billingPromoCodeInsertSchema,
    billingPromoCodeSelectSchema,
    billingPromoCodes,
    billingPromoCodeUsage,
    type QZPayBillingPromoCode,
    type QZPayBillingPromoCodeInsert,
    type QZPayBillingPromoCodeInsertInput,
    type QZPayBillingPromoCodeUsage,
    type QZPayBillingPromoCodeUsageInsert,
    // Relations exports
    billingAddonsRelations,
    billingCustomerEntitlementsRelations,
    billingCustomerLimitsRelations,
    billingCustomersRelations,
    billingEntitlementsRelations,
    billingInvoiceLinesRelations,
    billingInvoicePaymentsRelations,
    billingInvoicesRelations,
    billingLimitsRelations,
    billingPaymentMethodsRelations,
    billingPaymentsRelations,
    billingPlansRelations,
    billingPricesRelations,
    billingPromoCodesRelations,
    billingPromoCodeUsageRelations,
    billingRefundsRelations,
    billingSubscriptionAddonsRelations,
    billingSubscriptionsRelations,
    billingUsageRecordsRelations,
    billingVendorPayoutsRelations,
    billingVendorsRelations,
    // Subscription exports
    billingSubscriptionInsertSchema,
    billingSubscriptionSelectSchema,
    billingSubscriptions,
    type QZPayBillingSubscription,
    type QZPayBillingSubscriptionInsert,
    type QZPayBillingSubscriptionInsertInput,
    // Usage records exports
    billingUsageRecordInsertSchema,
    billingUsageRecordSelectSchema,
    billingUsageRecords,
    type QZPayBillingUsageRecord,
    type QZPayBillingUsageRecordInsert,
    // Vendor exports
    billingVendorInsertSchema,
    billingVendorPayouts,
    billingVendorSelectSchema,
    billingVendors,
    type QZPayBillingVendor,
    type QZPayBillingVendorInsert,
    type QZPayBillingVendorInsertInput,
    type QZPayBillingVendorPayout,
    type QZPayBillingVendorPayoutInsert,
    // Webhook events exports
    billingWebhookDeadLetter,
    billingWebhookEventInsertSchema,
    billingWebhookEventSelectSchema,
    billingWebhookEvents,
    type QZPayBillingWebhookDeadLetter,
    type QZPayBillingWebhookDeadLetterInsert,
    type QZPayBillingWebhookEvent,
    type QZPayBillingWebhookEventInsert,
    // Schema object
    qzpaySchema,
    QZPAY_DRIZZLE_SCHEMA_VERSION
} from './schemas.ts';
