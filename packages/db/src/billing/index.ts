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
    type QZPayDrizzleStorageAdapter,
    type QZPayStorageAdapter
} from './drizzle-adapter.ts';
// Export schemas and types (excluding transaction utilities to avoid conflicts)
export {
    // Add-on exports
    billingAddonInsertSchema,
    billingAddonSelectSchema,
    billingAddons,
    // Relations exports
    billingAddonsRelations,
    // Audit logs exports
    billingAuditLogInsertSchema,
    billingAuditLogSelectSchema,
    billingAuditLogs,
    // Checkout exports
    billingCheckoutInsertSchema,
    billingCheckoutSelectSchema,
    billingCheckouts,
    // Entitlement exports
    billingCustomerEntitlementInsertSchema,
    billingCustomerEntitlementSelectSchema,
    billingCustomerEntitlements,
    billingCustomerEntitlementsRelations,
    // Customer exports
    billingCustomerInsertSchema,
    // Limit exports
    billingCustomerLimitInsertSchema,
    billingCustomerLimitSelectSchema,
    billingCustomerLimits,
    billingCustomerLimitsRelations,
    billingCustomerSelectSchema,
    billingCustomers,
    billingCustomersRelations,
    billingEntitlementInsertSchema,
    billingEntitlementSelectSchema,
    billingEntitlements,
    billingEntitlementsRelations,
    // Idempotency keys exports
    billingIdempotencyKeyInsertSchema,
    billingIdempotencyKeySelectSchema,
    billingIdempotencyKeys,
    // Invoice exports
    billingInvoiceInsertSchema,
    billingInvoiceLines,
    billingInvoiceLinesRelations,
    billingInvoicePayments,
    billingInvoicePaymentsRelations,
    billingInvoiceSelectSchema,
    billingInvoices,
    billingInvoicesRelations,
    billingLimitInsertSchema,
    billingLimitSelectSchema,
    billingLimits,
    billingLimitsRelations,
    // Payment exports
    billingPaymentInsertSchema,
    // Payment method exports
    billingPaymentMethodInsertSchema,
    billingPaymentMethodSelectSchema,
    billingPaymentMethods,
    billingPaymentMethodsRelations,
    billingPaymentSelectSchema,
    billingPayments,
    billingPaymentsRelations,
    // Plan exports
    billingPlanInsertSchema,
    billingPlanSelectSchema,
    billingPlans,
    billingPlansRelations,
    // Price exports
    billingPriceInsertSchema,
    billingPriceSelectSchema,
    billingPrices,
    billingPricesRelations,
    // Promo code exports
    billingPromoCodeInsertSchema,
    billingPromoCodeSelectSchema,
    billingPromoCodes,
    billingPromoCodesRelations,
    billingPromoCodeUsage,
    billingPromoCodeUsageRelations,
    billingRefunds,
    billingRefundsRelations,
    billingSubscriptionAddonInsertSchema,
    billingSubscriptionAddonSelectSchema,
    billingSubscriptionAddons,
    billingSubscriptionAddonsRelations,
    // Subscription exports
    billingSubscriptionInsertSchema,
    billingSubscriptionSelectSchema,
    billingSubscriptions,
    billingSubscriptionsRelations,
    // Usage records exports
    billingUsageRecordInsertSchema,
    billingUsageRecordSelectSchema,
    billingUsageRecords,
    billingUsageRecordsRelations,
    // Vendor exports
    billingVendorInsertSchema,
    billingVendorPayouts,
    billingVendorPayoutsRelations,
    billingVendorSelectSchema,
    billingVendors,
    billingVendorsRelations,
    // Webhook events exports
    billingWebhookDeadLetter,
    billingWebhookEventInsertSchema,
    billingWebhookEventSelectSchema,
    billingWebhookEvents,
    QZPAY_DRIZZLE_SCHEMA_VERSION,
    type QZPayBillingAddon,
    type QZPayBillingAddonInsert,
    type QZPayBillingAddonInsertInput,
    type QZPayBillingAuditLog,
    type QZPayBillingAuditLogInsert,
    type QZPayBillingCheckout,
    type QZPayBillingCheckoutInsert,
    type QZPayBillingCustomer,
    type QZPayBillingCustomerEntitlement,
    type QZPayBillingCustomerEntitlementInsert,
    type QZPayBillingCustomerEntitlementInsertInput,
    type QZPayBillingCustomerInsert,
    type QZPayBillingCustomerInsertInput,
    type QZPayBillingCustomerLimit,
    type QZPayBillingCustomerLimitInsert,
    type QZPayBillingCustomerLimitInsertInput,
    type QZPayBillingEntitlement,
    type QZPayBillingEntitlementInsert,
    type QZPayBillingEntitlementInsertInput,
    type QZPayBillingIdempotencyKey,
    type QZPayBillingIdempotencyKeyInsert,
    type QZPayBillingInvoice,
    type QZPayBillingInvoiceInsert,
    type QZPayBillingInvoiceInsertInput,
    type QZPayBillingInvoiceLine,
    type QZPayBillingInvoiceLineInsert,
    type QZPayBillingInvoicePayment,
    type QZPayBillingInvoicePaymentInsert,
    type QZPayBillingLimit,
    type QZPayBillingLimitInsert,
    type QZPayBillingLimitInsertInput,
    type QZPayBillingPayment,
    type QZPayBillingPaymentInsert,
    type QZPayBillingPaymentInsertInput,
    type QZPayBillingPaymentMethod,
    type QZPayBillingPaymentMethodInsert,
    type QZPayBillingPaymentMethodInsertInput,
    type QZPayBillingPlan,
    type QZPayBillingPlanInsert,
    type QZPayBillingPlanInsertInput,
    type QZPayBillingPrice,
    type QZPayBillingPriceInsert,
    type QZPayBillingPriceInsertInput,
    type QZPayBillingPromoCode,
    type QZPayBillingPromoCodeInsert,
    type QZPayBillingPromoCodeInsertInput,
    type QZPayBillingPromoCodeUsage,
    type QZPayBillingPromoCodeUsageInsert,
    type QZPayBillingRefund,
    type QZPayBillingRefundInsert,
    type QZPayBillingSubscription,
    type QZPayBillingSubscriptionAddon,
    type QZPayBillingSubscriptionAddonInsert,
    type QZPayBillingSubscriptionAddonInsertInput,
    type QZPayBillingSubscriptionInsert,
    type QZPayBillingSubscriptionInsertInput,
    type QZPayBillingUsageRecord,
    type QZPayBillingUsageRecordInsert,
    type QZPayBillingVendor,
    type QZPayBillingVendorInsert,
    type QZPayBillingVendorInsertInput,
    type QZPayBillingVendorPayout,
    type QZPayBillingVendorPayoutInsert,
    type QZPayBillingWebhookDeadLetter,
    type QZPayBillingWebhookDeadLetterInsert,
    type QZPayBillingWebhookEvent,
    type QZPayBillingWebhookEventInsert,
    // Schema object
    qzpaySchema
} from './schemas.ts';
