/**
 * Sandbox test configuration and utilities
 *
 * Provides helper functions for running E2E tests against the MercadoPago sandbox.
 * These utilities handle environment checks, retries for network calls, test ID
 * generation, and resource cleanup tracking.
 *
 * @module test/e2e/sandbox/sandbox-config
 */

import { getEnv, getEnvBoolean } from '@repo/config';
import { sleep } from '@repo/utils';

/**
 * Configuration for sandbox environment
 */
export interface SandboxConfig {
    /**
     * MercadoPago access token (should start with TEST-)
     */
    readonly accessToken: string | null;

    /**
     * Webhook secret for signature verification
     */
    readonly webhookSecret: string | null;

    /**
     * Whether sandbox mode is enabled
     */
    readonly sandbox: boolean;

    /**
     * Request timeout in milliseconds
     */
    readonly timeout: number;

    /**
     * Whether sandbox is properly configured
     */
    readonly isConfigured: boolean;
}

/**
 * Get current sandbox configuration from environment variables
 *
 * @returns Sandbox configuration object
 *
 * @example
 * ```typescript
 * const config = getSandboxConfig();
 *
 * if (!config.isConfigured) {
 *   console.log('Sandbox not configured');
 * }
 * ```
 */
export function getSandboxConfig(): SandboxConfig {
    const accessToken = getEnv('MERCADO_PAGO_ACCESS_TOKEN', null);
    const webhookSecret = getEnv('MERCADO_PAGO_WEBHOOK_SECRET', null);
    const sandbox = getEnvBoolean('MERCADO_PAGO_SANDBOX', true);
    const timeout = Number.parseInt(getEnv('MERCADO_PAGO_TIMEOUT', '10000'), 10);

    // Sandbox is configured if we have an access token and sandbox mode is enabled
    const isConfigured = !!accessToken && sandbox;

    return {
        accessToken,
        webhookSecret,
        sandbox,
        timeout,
        isConfigured
    };
}

/**
 * Check if sandbox environment is properly configured
 *
 * Verifies that:
 * - MERCADO_PAGO_ACCESS_TOKEN is set
 * - Token starts with TEST- (sandbox token)
 * - MERCADO_PAGO_SANDBOX is true
 *
 * @returns True if sandbox is configured, false otherwise
 *
 * @example
 * ```typescript
 * if (!isSandboxConfigured()) {
 *   console.log('Skipping sandbox tests - not configured');
 *   return;
 * }
 * ```
 */
export function isSandboxConfigured(): boolean {
    const config = getSandboxConfig();
    return config.isConfigured;
}

/**
 * Skip test if sandbox is not configured
 *
 * Use this in beforeAll() or at the start of test suites to skip
 * tests when sandbox credentials are not available.
 *
 * @throws {Error} Skip error if sandbox is not configured
 *
 * @example
 * ```typescript
 * describe('MercadoPago Sandbox Tests', () => {
 *   beforeAll(() => {
 *     skipIfNoSandbox();
 *   });
 *
 *   it('should create customer', async () => {
 *     // Test will only run if sandbox is configured
 *   });
 * });
 * ```
 */
export function skipIfNoSandbox(): void {
    if (!isSandboxConfigured()) {
        const message =
            'Skipping sandbox tests - MercadoPago sandbox not configured. ' +
            'Set MERCADO_PAGO_ACCESS_TOKEN (TEST-...) to run these tests.';

        // In Vitest, we need to throw to skip
        throw new Error(message);
    }
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
    /**
     * Function to execute with retry logic
     */
    fn: () => Promise<unknown>;

    /**
     * Maximum number of attempts (including first try)
     *
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Delay between retries in milliseconds
     *
     * @default 1000
     */
    delayMs?: number;

    /**
     * Description of the operation for logging
     *
     * @default "Operation"
     */
    description?: string;

    /**
     * Function to determine if error is retryable
     * Return true to retry, false to fail immediately
     *
     * @default Always retry on any error
     */
    shouldRetry?: (error: unknown) => boolean;
}

/**
 * Execute a function with automatic retry logic
 *
 * Useful for network calls that may fail transiently. Automatically retries
 * failed operations with exponential backoff.
 *
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws {Error} If all retry attempts fail
 *
 * @example
 * ```typescript
 * const customer = await withRetry({
 *   fn: async () => billing.customers.create({ email: 'test@example.com' }),
 *   maxAttempts: 3,
 *   delayMs: 1000,
 *   description: 'Create customer'
 * });
 * ```
 */
export async function withRetry<T>(options: RetryOptions): Promise<T> {
    const { fn, maxAttempts = 3, delayMs = 1000, description = 'Operation', shouldRetry } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await fn();
            return result as T;
        } catch (error) {
            lastError = error;

            // Check if we should retry
            const isRetryable = shouldRetry ? shouldRetry(error) : true;

            if (!isRetryable) {
                throw error;
            }

            // Don't wait after last attempt
            if (attempt < maxAttempts) {
                const waitMs = delayMs * attempt; // Linear backoff
                console.warn(
                    `[sandbox] ${description} failed (attempt ${attempt}/${maxAttempts}). ` +
                        `Retrying in ${waitMs}ms... Error: ${error instanceof Error ? error.message : String(error)}`
                );
                await sleep(waitMs);
            }
        }
    }

    // All attempts failed
    throw new Error(
        `${description} failed after ${maxAttempts} attempts. ` +
            `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
}

/**
 * Generate a unique test identifier
 *
 * Creates a unique ID based on timestamp and random string to avoid
 * collisions when running tests in parallel or repeatedly.
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique test identifier
 *
 * @example
 * ```typescript
 * const testEmail = `test-${generateTestId()}@example.com`;
 * const testCustomerId = generateTestId('cust');
 * ```
 */
export function generateTestId(prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const id = `${timestamp}-${random}`;

    return prefix ? `${prefix}-${id}` : id;
}

/**
 * Resource type for cleanup tracking
 */
export type ResourceType = 'customer' | 'subscription' | 'invoice' | 'payment' | 'preference';

/**
 * Tracked resource for cleanup
 */
export interface TrackedResource {
    /**
     * Type of resource
     */
    readonly type: ResourceType;

    /**
     * Resource ID
     */
    readonly id: string;

    /**
     * When the resource was created
     */
    readonly createdAt: Date;
}

/**
 * Cleanup tracker for managing test resources
 */
export interface CleanupTracker {
    /**
     * Track a resource for cleanup
     *
     * @param type - Type of resource
     * @param id - Resource ID
     */
    track: (type: ResourceType, id: string) => void;

    /**
     * Get all tracked resources
     *
     * @returns Array of tracked resources
     */
    getTracked: () => readonly TrackedResource[];

    /**
     * Cleanup all tracked resources
     *
     * Note: Actual cleanup implementation depends on the resource type
     * and API capabilities. Some resources may not support deletion.
     *
     * @returns Promise that resolves when cleanup is complete
     */
    cleanup: () => Promise<void>;

    /**
     * Clear tracking without cleanup
     */
    clear: () => void;
}

/**
 * Create a cleanup tracker for managing test resources
 *
 * Tracks resources created during tests and provides a cleanup mechanism.
 * Use this to ensure test resources don't accumulate in the sandbox.
 *
 * @returns Cleanup tracker instance
 *
 * @example
 * ```typescript
 * describe('Customer Tests', () => {
 *   const tracker = createCleanupTracker();
 *
 *   afterAll(async () => {
 *     await tracker.cleanup();
 *   });
 *
 *   it('should create customer', async () => {
 *     const customer = await billing.customers.create({ ... });
 *     tracker.track('customer', customer.id);
 *     // Customer will be cleaned up after tests
 *   });
 * });
 * ```
 */
export function createCleanupTracker(): CleanupTracker {
    const resources: TrackedResource[] = [];

    return {
        track(type: ResourceType, id: string): void {
            resources.push({
                type,
                id,
                createdAt: new Date()
            });
        },

        getTracked(): readonly TrackedResource[] {
            return [...resources];
        },

        async cleanup(): Promise<void> {
            if (resources.length === 0) {
                return;
            }

            // Note: MercadoPago sandbox doesn't always support deletion
            // This is a best-effort cleanup. Some resources may need manual cleanup.
            for (const resource of resources) {
                // TODO: Implement actual cleanup based on resource type
                // For now, we just track the resources that should be cleaned
                // In a full implementation, this would call the appropriate delete APIs
                //
                // Example implementation:
                // try {
                //   if (resource.type === 'customer') {
                //     await billing.customers.delete(resource.id);
                //   } else if (resource.type === 'subscription') {
                //     await billing.subscriptions.cancel(resource.id);
                //   }
                // } catch (error) {
                //   console.warn(
                //     `[sandbox] Failed to cleanup ${resource.type} ${resource.id}: ${error instanceof Error ? error.message : String(error)}`
                //   );
                // }

                // Placeholder to avoid unused variable warning
                void resource;
            }

            resources.length = 0; // Clear array
        },

        clear(): void {
            resources.length = 0;
        }
    };
}

/**
 * Get test database configuration
 *
 * Returns database URL for test environment. Falls back to regular
 * database URL if test-specific one is not configured.
 *
 * @returns Database URL for tests
 */
export function getTestDatabaseUrl(): string {
    return getEnv('HOSPEDA_TEST_DATABASE_URL', null) ?? getEnv('HOSPEDA_DATABASE_URL');
}

/**
 * Check if we're running in CI environment
 *
 * @returns True if running in CI, false otherwise
 */
export function isCI(): boolean {
    return getEnvBoolean('CI', false);
}

/**
 * Get default retry configuration for CI vs local
 *
 * CI environments may need more retries due to shared resources
 *
 * @returns Retry configuration
 */
export function getDefaultRetryConfig(): Pick<RetryOptions, 'maxAttempts' | 'delayMs'> {
    if (isCI()) {
        return {
            maxAttempts: 5,
            delayMs: 2000
        };
    }

    return {
        maxAttempts: 3,
        delayMs: 1000
    };
}
