/**
 * QZPay Billing Schemas
 *
 * Re-exports all billing-related schemas and types from @qazuor/qzpay-drizzle.
 * These schemas define the database structure for all billing functionality.
 *
 * The schemas use the 'billing_' prefix for all tables to provide namespace
 * isolation from application tables.
 *
 * @module @repo/db/billing/schemas
 */

// Re-export all schemas, types, and relations from qzpay-drizzle
export * from '@qazuor/qzpay-drizzle';
