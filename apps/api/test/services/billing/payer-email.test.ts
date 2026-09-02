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
 * - `getMpPayerEmail` degrades a FAILED read to `null` rather than throwing
 *   (HOS-1028), so that a dead read costs the payer-email optimization and
 *   not the whole checkout.
 * - `clearMpPayerEmailBestEffort` (HOS-971) nulls ONLY `mp_payer_email`,
 *   skips the write when it is already NULL, issues no provider call at all,
 *   and swallows failures — it runs inside a Better Auth `user.update.after`
 *   hook where a throw would fail the user's profile save.
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
    clearMpPayerEmailBestEffort,
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
        // The logger mock is module-scoped: without this, a test that
        // asserts a CALL COUNT on apiLogger.error inherits the calls made
        // by every test that ran before it.
        vi.mocked(apiLogger.error).mockClear();
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

    it('HOS-1028: degrades to null instead of throwing when the query itself fails', async () => {
        // The exact production failure: the extras-carril column was absent
        // from staging and prod while the reading code sat merged. A throw
        // here answered 500 on all five checkout call sites, with the
        // HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED flag OFF, because every
        // one of them calls this BEFORE checking that flag.
        mockExecute.mockRejectedValueOnce(new Error('column "mp_payer_email" does not exist'));

        const result = await getMpPayerEmail('cust_1', { execute: mockExecute } as never);

        expect(result).toBeNull();
    });

    it('HOS-1028: reports the failed read to Sentry rather than swallowing it silently', async () => {
        mockExecute.mockRejectedValueOnce(new Error('connection pool exhausted'));

        await getMpPayerEmail('cust_1', { execute: mockExecute } as never);

        expect(apiLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cust_1',
                error: 'connection pool exhausted'
            }),
            expect.stringContaining('mp_payer_email'),
            { capture: true }
        );
    });

    it('HOS-1028: a failed read costs the optimization, not the checkout — resolution falls through to the remaining precedence', async () => {
        // This is the assertion that matters: the caller shape is
        // `mpPayerEmail: await getMpPayerEmail(...)` inlined into the
        // resolvePayerEmail input (subscription-checkout.service.ts:448,
        // 609, 970, 1534, 1652). A dead read must still produce a usable
        // payer email from step 2 or 3 of the precedence.
        mockExecute.mockRejectedValueOnce(new Error('column "mp_payer_email" does not exist'));

        const { payerEmail } = resolvePayerEmail({
            mpPayerEmail: await getMpPayerEmail('cust_1', { execute: mockExecute } as never),
            customerEmail: 'signup@example.com'
        });

        expect(payerEmail).toBe('signup@example.com');
    });
});

describe('persistMpPayerEmailBestEffort', () => {
    beforeEach(() => {
        mockExecute.mockReset();
        // The logger mock is module-scoped: without this, a test that
        // asserts a CALL COUNT on apiLogger.error inherits the calls made
        // by every test that ran before it.
        vi.mocked(apiLogger.error).mockClear();
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

describe('clearMpPayerEmailBestEffort (HOS-971)', () => {
    beforeEach(() => {
        mockExecute.mockReset();
        vi.mocked(apiLogger.error).mockClear();
    });

    /**
     * Reads back the raw SQL text of the Nth `db.execute` call, with every
     * interpolated value collapsed to `<value>` — same technique the AC-9
     * assertion above uses.
     */
    const rawSqlOfCall = (index: number): string => {
        const sqlCall = mockExecute.mock.calls[index]?.[0] as { queryChunks: unknown[] };
        const [stringsArray] = sqlCall.queryChunks as [readonly string[], ...unknown[]];
        return stringsArray.join('<value>');
    };

    it('nulls mp_payer_email for the given customer', async () => {
        mockExecute.mockResolvedValueOnce({ rows: [] });

        await clearMpPayerEmailBestEffort({
            customerId: 'cust_1',
            db: { execute: mockExecute } as never
        });

        expect(mockExecute).toHaveBeenCalledTimes(1);
        const rawSql = rawSqlOfCall(0);
        expect(rawSql).toContain('UPDATE billing_customers');
        expect(rawSql).toMatch(/SET\s+mp_payer_email\s*=\s*NULL/i);
        expect(rawSql).toContain('WHERE id = <value>');
    });

    it('skips the write when the column is already NULL', async () => {
        // The overwhelming majority of customers never completed a checkout
        // under the own-preapproval flow, so this keeps an email change from
        // issuing a pointless row write for every one of them.
        mockExecute.mockResolvedValueOnce({ rows: [] });

        await clearMpPayerEmailBestEffort({
            customerId: 'cust_1',
            db: { execute: mockExecute } as never
        });

        expect(rawSqlOfCall(0)).toMatch(/mp_payer_email\s+IS\s+NOT\s+NULL/i);
    });

    it('AC-9: never writes the bare `email` column', async () => {
        // `billing_customers.email` is the address Hospeda's own sends read.
        // Invalidating the MercadoPago cache must not be able to touch it,
        // exactly as for `persistMpPayerEmailBestEffort` (HOS-581).
        mockExecute.mockResolvedValueOnce({ rows: [] });

        await clearMpPayerEmailBestEffort({
            customerId: 'cust_1',
            db: { execute: mockExecute } as never
        });

        const rawSql = rawSqlOfCall(0);
        expect(rawSql).not.toMatch(/\bSET\s+email\b/i);
        expect(rawSql).not.toMatch(/,\s*email\s*=/i);
    });

    it('never asks MercadoPago anything: the only side effect is one local UPDATE', async () => {
        // `payer_email` is immutable on an existing preapproval (HOS-937
        // measured the PUT being ignored), so there is nothing to repair
        // provider-side and a live subscription keeps charging untouched.
        mockExecute.mockResolvedValueOnce({ rows: [] });

        await clearMpPayerEmailBestEffort({
            customerId: 'cust_1',
            db: { execute: mockExecute } as never
        });

        expect(mockExecute).toHaveBeenCalledTimes(1);
        expect(rawSqlOfCall(0)).not.toMatch(/preapproval|subscription/i);
    });

    it('is best-effort: swallows a failed UPDATE instead of throwing', async () => {
        // It runs inside a Better Auth `user.update.after` hook — throwing
        // would turn a failed cache invalidation into a failed profile save.
        mockExecute.mockRejectedValueOnce(new Error('connection reset'));

        await expect(
            clearMpPayerEmailBestEffort({
                customerId: 'cust_1',
                db: { execute: mockExecute } as never
            })
        ).resolves.toBeUndefined();

        expect(apiLogger.error).toHaveBeenCalledTimes(1);
    });
});
