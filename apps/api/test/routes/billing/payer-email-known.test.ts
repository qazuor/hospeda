/**
 * Unit tests for the GET payer-email-known billing route (HOS-1234).
 *
 * Covers:
 * - Success: a known `mp_payer_email` -> `{ hasKnownPayerEmail: true }`.
 * - Success: no `mp_payer_email` on file -> `{ hasKnownPayerEmail: false }`.
 * - `getMpPayerEmail` failing (degrades to `null` internally, best-effort) ->
 *   still `{ hasKnownPayerEmail: false }`, never a throw.
 * - Billing not configured -> 503.
 * - No `billingCustomerId` on session -> 400.
 *
 * Mocking strategy mirrors `trial-eligibility.test.ts`:
 * - `getMpPayerEmail` is mocked at module level so the test stays unit-level
 *   (it has its own dedicated coverage in `payer-email.test.ts`).
 * - `createCRUDRoute` / `createRouter` are mocked to expose the raw handler.
 *
 * @module test/routes/billing/payer-email-known
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/services/billing/payer-email', () => ({
    getMpPayerEmail: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { handlePayerEmailKnown } from '../../../src/routes/billing/payer-email-known';
import { getMpPayerEmail } from '../../../src/services/billing/payer-email';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000099';

/**
 * Build a minimal Hono context stub for direct handler invocation.
 * `billingEnabled` / `billingCustomerId` default to the "happy path" —
 * individual tests override via the map before invoking the handler.
 */
function makeContext(
    overrides: { billingEnabled?: boolean; billingCustomerId?: string | null } = {}
) {
    const store = new Map<string, unknown>([
        ['billingEnabled', overrides.billingEnabled ?? true],
        [
            'billingCustomerId',
            'billingCustomerId' in overrides ? overrides.billingCustomerId : CUSTOMER_ID
        ]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        set: vi.fn((k: string, v: unknown) => store.set(k, v))
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePayerEmailKnown', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('success', () => {
        it('returns hasKnownPayerEmail: true when mp_payer_email is set', async () => {
            vi.mocked(getMpPayerEmail).mockResolvedValue('juan@example.com');

            const ctx = makeContext();
            const result = await handlePayerEmailKnown(ctx as never, {}, {});

            expect(result).toEqual({ hasKnownPayerEmail: true });
            expect(getMpPayerEmail).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('returns hasKnownPayerEmail: false when mp_payer_email is not set', async () => {
            vi.mocked(getMpPayerEmail).mockResolvedValue(null);

            const ctx = makeContext();
            const result = await handlePayerEmailKnown(ctx as never, {}, {});

            expect(result).toEqual({ hasKnownPayerEmail: false });
        });

        it('treats a stored EMPTY STRING as not-known, not as an address', async () => {
            // The shape that started HOS-1234. MercadoPago spells "no email" as
            // `''`, and the column is a nullable varchar, so a row can hold one.
            // `!== null` would answer `true` here and skip the confirm dialog on
            // the strength of an address that is not an address. Today's persist
            // refuses to write `''`, but this route answers for every row ever
            // written, including any predating that check.
            vi.mocked(getMpPayerEmail).mockResolvedValue('');

            const ctx = makeContext();
            const result = await handlePayerEmailKnown(ctx as never, {}, {});

            expect(result).toEqual({ hasKnownPayerEmail: false });
        });

        it('never leaks the actual email in the response — only the boolean', async () => {
            vi.mocked(getMpPayerEmail).mockResolvedValue('secret@example.com');

            const ctx = makeContext();
            const result = await handlePayerEmailKnown(ctx as never, {}, {});

            expect(Object.keys(result)).toEqual(['hasKnownPayerEmail']);
            expect(JSON.stringify(result)).not.toContain('secret@example.com');
        });
    });

    describe('error paths', () => {
        it('throws 503 when billing is not configured', async () => {
            const ctx = makeContext({ billingEnabled: false });

            await expect(handlePayerEmailKnown(ctx as never, {}, {})).rejects.toMatchObject({
                status: 503
            });
            expect(getMpPayerEmail).not.toHaveBeenCalled();
        });

        it('throws 400 when the caller has no billing customer on session', async () => {
            const ctx = makeContext({ billingCustomerId: null });

            await expect(handlePayerEmailKnown(ctx as never, {}, {})).rejects.toMatchObject({
                status: 400
            });
            expect(getMpPayerEmail).not.toHaveBeenCalled();
        });
    });
});
