/**
 * Billing Customer Sync Service
 *
 * Ensures authenticated users have corresponding billing customers.
 * Handles automatic customer creation, updates, and deletions with caching.
 *
 * This service bridges authentication and QZPay billing, ensuring every
 * authenticated user has a billing customer record for subscriptions,
 * payments, and entitlements. Called from Better Auth database hooks.
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { apiLogger } from '../utils/logger';

/**
 * Cache entry for customer lookups
 */
interface CustomerCacheEntry {
    customerId: string;
    timestamp: number;
}

/**
 * Configuration for the sync service
 */
export interface BillingCustomerSyncConfig {
    /**
     * Cache TTL in milliseconds
     * @default 300000 (5 minutes)
     */
    cacheTtlMs?: number;

    /**
     * Whether to throw errors or log them silently
     * @default false (log silently in development, can be overridden)
     */
    throwOnError?: boolean;
}

/**
 * Service for syncing authenticated users with billing customers
 */
export class BillingCustomerSyncService {
    private readonly billing: QZPayBilling | null;
    private readonly cache: Map<string, CustomerCacheEntry>;
    private readonly cacheTtlMs: number;
    private readonly throwOnError: boolean;

    constructor(billing: QZPayBilling | null, config: BillingCustomerSyncConfig = {}) {
        this.billing = billing;
        this.cache = new Map();
        this.cacheTtlMs = config.cacheTtlMs ?? 300000; // 5 minutes
        this.throwOnError = config.throwOnError ?? false;
    }

    /**
     * Ensure a billing customer exists for the given user
     * Creates customer if not exists, returns existing customer ID if found
     *
     * @param input - User identification data
     * @returns Customer ID or null if billing is not enabled
     */
    async ensureCustomerExists(input: {
        userId: string;
        email: string;
        name?: string;
    }): Promise<string | null> {
        // Billing not enabled - return null
        if (!this.billing) {
            apiLogger.debug(
                { userId: input.userId },
                'Billing not enabled, skipping customer sync'
            );
            return null;
        }

        const { userId, email, name } = input;

        try {
            // Check cache first
            const cached = this.getCachedCustomer(userId);
            if (cached) {
                apiLogger.debug({ userId, customerId: cached }, 'Billing customer found in cache');
                return cached;
            }

            // Try to find existing customer by external ID (userId)
            const existingCustomer = await this.billing.customers.getByExternalId(userId);

            if (existingCustomer) {
                apiLogger.debug(
                    {
                        userId,
                        customerId: existingCustomer.id
                    },
                    'Billing customer found in database'
                );
                this.cacheCustomer(userId, existingCustomer.id);
                return existingCustomer.id;
            }

            // Customer doesn't exist - create new one
            apiLogger.info({ userId, email }, 'Creating new billing customer');

            try {
                const newCustomer = await this.billing.customers.create({
                    externalId: userId,
                    email,
                    name: name || null,
                    metadata: {
                        source: 'better-auth',
                        createdBy: 'billing-customer-sync-service'
                    }
                });

                this.cacheCustomer(userId, newCustomer.id);

                apiLogger.info(
                    {
                        userId,
                        customerId: newCustomer.id
                    },
                    'Billing customer created successfully'
                );

                return newCustomer.id;
            } catch (createError) {
                // Handle race condition: another concurrent request may have
                // created the customer between our check and our insert.
                // Re-fetch to get the customer that won the race.
                if (isDuplicateKeyError(createError)) {
                    apiLogger.info(
                        { userId },
                        'Duplicate key on customer create, re-fetching (race condition)'
                    );

                    const raceWinner = await this.billing.customers.getByExternalId(userId);
                    if (raceWinner) {
                        this.cacheCustomer(userId, raceWinner.id);
                        return raceWinner.id;
                    }
                }

                throw createError;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    userId,
                    email,
                    error: errorMessage
                },
                'Failed to ensure billing customer exists'
            );

            if (this.throwOnError) {
                throw error;
            }

            return null;
        }
    }

    /**
     * Sync customer data (update existing customer)
     * Updates email and name if they have changed
     *
     * @param input - User identification and updated data
     * @returns Updated customer ID or null if billing is not enabled
     */
    async syncCustomerData(input: {
        userId: string;
        email: string;
        name?: string;
    }): Promise<string | null> {
        // Billing not enabled - return null
        if (!this.billing) {
            return null;
        }

        const { userId, email, name } = input;

        try {
            // Find existing customer
            const existingCustomer = await this.billing.customers.getByExternalId(userId);

            if (!existingCustomer) {
                apiLogger.warn({ userId }, 'Cannot sync customer data - customer not found');
                // Try to create instead
                return this.ensureCustomerExists(input);
            }

            // Check if data needs updating
            const needsUpdate =
                existingCustomer.email !== email || existingCustomer.name !== (name || null);

            if (!needsUpdate) {
                apiLogger.debug(
                    {
                        userId,
                        customerId: existingCustomer.id
                    },
                    'Billing customer data already up to date'
                );
                return existingCustomer.id;
            }

            // Update customer
            apiLogger.info(
                {
                    userId,
                    customerId: existingCustomer.id
                },
                'Updating billing customer data'
            );

            const updatedCustomer = await this.billing.customers.update(existingCustomer.id, {
                email,
                name: name || null,
                metadata: {
                    ...existingCustomer.metadata,
                    lastSyncedAt: new Date().toISOString()
                }
            });

            if (updatedCustomer) {
                this.cacheCustomer(userId, updatedCustomer.id);
                apiLogger.info(
                    {
                        userId,
                        customerId: updatedCustomer.id
                    },
                    'Billing customer updated successfully'
                );
                return updatedCustomer.id;
            }

            return existingCustomer.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    userId,
                    email,
                    error: errorMessage
                },
                'Failed to sync billing customer data'
            );

            if (this.throwOnError) {
                throw error;
            }

            return null;
        }
    }

    /**
     * Handle user deletion
     * Soft-deletes the billing customer
     *
     * @param userId - User ID to delete
     */
    async handleUserDeletion(input: {
        userId: string;
    }): Promise<void> {
        // Billing not enabled - nothing to do
        if (!this.billing) {
            return;
        }

        const { userId } = input;

        try {
            // Find existing customer
            const existingCustomer = await this.billing.customers.getByExternalId(userId);

            if (!existingCustomer) {
                apiLogger.warn({ userId }, 'Cannot delete billing customer - customer not found');
                return;
            }

            // Soft delete (QZPay handles soft deletion internally)
            await this.billing.customers.delete(existingCustomer.id);

            // Remove from cache
            this.cache.delete(userId);

            apiLogger.info(
                {
                    userId,
                    customerId: existingCustomer.id
                },
                'Billing customer deleted successfully'
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    userId,
                    error: errorMessage
                },
                'Failed to delete billing customer'
            );

            if (this.throwOnError) {
                throw error;
            }
        }
    }

    /**
     * Get cached customer ID if not expired
     */
    private getCachedCustomer(userId: string): string | null {
        const cached = this.cache.get(userId);

        if (!cached) {
            return null;
        }

        // Check if expired
        const now = Date.now();
        if (now - cached.timestamp > this.cacheTtlMs) {
            this.cache.delete(userId);
            return null;
        }

        return cached.customerId;
    }

    /**
     * Cache customer ID with timestamp
     */
    private cacheCustomer(userId: string, customerId: string): void {
        this.cache.set(userId, {
            customerId,
            timestamp: Date.now()
        });
    }

    /**
     * Clear the entire cache
     * Useful for testing or when you want to force fresh lookups
     */
    clearCache(): void {
        this.cache.clear();
        apiLogger.debug({}, 'Billing customer cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        entries: Array<{ userId: string; customerId: string; age: number }>;
    } {
        const now = Date.now();
        const entries = Array.from(this.cache.entries()).map(([userId, entry]) => ({
            userId,
            customerId: entry.customerId,
            age: now - entry.timestamp
        }));

        return {
            size: this.cache.size,
            entries
        };
    }
}

/**
 * Check if an error is a PostgreSQL unique constraint violation.
 *
 * PostgreSQL error code 23505 indicates a unique_violation. This is used
 * to detect race conditions where two concurrent requests both try to
 * create a customer for the same user.
 *
 * @param error - The error to check
 * @returns true if the error is a duplicate key / unique constraint violation
 */
function isDuplicateKeyError(error: unknown): boolean {
    if (error instanceof Error) {
        const pgError = error as Error & { code?: string };
        // PostgreSQL unique_violation error code
        if (pgError.code === '23505') {
            return true;
        }
        // Fallback: check error message for common duplicate key patterns
        const message = error.message.toLowerCase();
        return message.includes('duplicate key') || message.includes('unique constraint');
    }
    return false;
}
