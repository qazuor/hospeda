/**
 * Unit tests for the payer-email resolution and persistence helpers
 * (HOS-937 step 2).
 *
 * Covers:
 * - `resolvePayerEmail` precedence: a user-typed email wins over
 *   `mp_payer_email`, which wins over `billing_customers.email` (spec §6.3).
 * - The `+` guard (spec §11 OQ-1): a resolved email containing `+` throws
 *   `PAYER_EMAIL_UNSUPPORTED_CHARACTER` rather than being silently rewritten.
 * - `persistMpPayerEmailBestEffort` writes ONLY `mp_payer_email` — never
 *   `billing_customers.email` (AC-9, HOS-581) — and swallows failures
 *   instead of throwing (best-effort, matches the sibling
 *   `applyPendingDiscountBestEffort` contract).
 * - `getMpPayerEmail` reads the raw-SQL column and normalizes a missing row
 *   / unset column to `null`.
 *
 * @module test/services/billing/payer-email
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecute = vi.fn();

// Mock @repo/db — MUST be before imports (hoisted by vitest).
vi.mock('@repo/db', () => {
    const mockSql = Object.assign(
        vi.fn((...args: unknown[]) => ({
            // Captures the tagged-template strings + interpolated values so
            // tests can assert on the raw SQL text without a real DB.
            queryChunks: args
        })),
        { raw: vi.fn((str: string) => str) }
    );

    return {
        getDb: vi.fn(() => ({ execute: mockExecute })),
        sql: mockSql
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Import after mocks.
import {
    getMpPayerEmail,
    persistMpPayerEmailBestEffort,
    resolvePayerEmail
} from '../../../src/services/billing/payer-email';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error';
import { apiLogger } from '../../../src/utils/logger.js';

describe('resolvePayerEmail', () => {
    it('a user-typed requestedPayerEmail wins over both other sources', () => {
        const result = resolvePayerEmail({
            requestedPayerEmail: 'typed@example.com',
            mpPayerEmail: 'worked-before@example.com',
            customerEmail: 'signup@example.com'
        });
        expect(result.payerEmail).toBe('typed@example.com');
    });

    it('falls back to mpPayerEmail when no requestedPayerEmail is supplied', () => {
        const result = resolvePayerEmail({
            mpPayerEmail: 'worked-before@example.com',
            customerEmail: 'signup@example.com'
        });
        expect(result.payerEmail).toBe('worked-before@example.com');
    });

    it('falls back to customerEmail when neither requestedPayerEmail nor mpPayerEmail is set', () => {
        const result = resolvePayerEmail({
            mpPayerEmail: null,
            customerEmail: 'signup@example.com'
        });
        expect(result.payerEmail).toBe('signup@example.com');
    });

    it('HOS-937 §11 OQ-1: throws PAYER_EMAIL_UNSUPPORTED_CHARACTER for a resolved email containing +', () => {
        expect.assertions(2);
        try {
            resolvePayerEmail({
                requestedPayerEmail: 'user+tag@example.com',
                mpPayerEmail: null,
                customerEmail: 'signup@example.com'
            });
        } catch (error) {
            expect(error).toBeInstanceOf(SubscriptionCheckoutError);
            expect((error as SubscriptionCheckoutError).code).toBe(
                'PAYER_EMAIL_UNSUPPORTED_CHARACTER'
            );
        }
    });

    it('also rejects a + surfaced only via the customerEmail fallback (not just requestedPayerEmail)', () => {
        expect.assertions(2);
        try {
            resolvePayerEmail({
                mpPayerEmail: null,
                customerEmail: 'signup+tag@example.com'
            });
        } catch (error) {
            expect(error).toBeInstanceOf(SubscriptionCheckoutError);
            expect((error as SubscriptionCheckoutError).code).toBe(
                'PAYER_EMAIL_UNSUPPORTED_CHARACTER'
            );
        }
    });
});

describe('getMpPayerEmail', () => {
    beforeEach(() => {
        mockExecute.mockReset();
    });

    it('returns the stored mp_payer_email when present', async () => {
        mockExecute.mockResolvedValueOnce({ rows: [{ mp_payer_email: 'stored@example.com' }] });
        const result = await getMpPayerEmail('cust_1', { execute: mockExecute } as never);
        expect(result).toBe('stored@example.com');
    });

    it('returns null when the column is unset', async () => {
        mockExecute.mockResolvedValueOnce({ rows: [{ mp_payer_email: null }] });
        const result = await getMpPayerEmail('cust_1', { execute: mockExecute } as never);
        expect(result).toBeNull();
    });

    it('returns null when no row is found', async () => {
        mockExecute.mockResolvedValueOnce({ rows: [] });
        const result = await getMpPayerEmail('cust_missing', { execute: mockExecute } as never);
        expect(result).toBeNull();
    });
});

describe('persistMpPayerEmailBestEffort', () => {
    beforeEach(() => {
        mockExecute.mockReset();
    });

    it('AC-9: the UPDATE statement writes ONLY mp_payer_email — the raw SQL text never mentions the email column', async () => {
        mockExecute.mockResolvedValueOnce({ rows: [] });

        await persistMpPayerEmailBestEffort({
            customerId: 'cust_1',
            payerEmail: 'authorized@example.com',
            db: { execute: mockExecute } as never
        });

        expect(mockExecute).toHaveBeenCalledTimes(1);
        const sqlCall = mockExecute.mock.calls[0]?.[0] as { queryChunks: unknown[] };
        const [stringsArray] = sqlCall.queryChunks as [readonly string[], ...unknown[]];
        const rawSql = stringsArray.join('<value>');

        expect(rawSql).toContain('mp_payer_email');
        expect(rawSql).toContain('UPDATE billing_customers');
        // AC-9 / HOS-581: never write the `email` column from this path.
        // A naive `includes('email')` would also match `mp_payer_email`, so
        // check specifically for an assignment to the bare `email` column.
        expect(rawSql).not.toMatch(/\bSET\s+email\b/i);
        expect(rawSql).not.toMatch(/,\s*email\s*=/i);
    });

    it('is best-effort: swallows a failed UPDATE instead of throwing', async () => {
        mockExecute.mockRejectedValueOnce(new Error('connection reset'));

        await expect(
            persistMpPayerEmailBestEffort({
                customerId: 'cust_1',
                payerEmail: 'authorized@example.com',
                db: { execute: mockExecute } as never
            })
        ).resolves.toBeUndefined();

        expect(apiLogger.error).toHaveBeenCalledTimes(1);
    });
});
