/**
 * Unit tests: HOS-191 Path C link-preapproval route handler (F2, back_url).
 *
 * Coverage:
 * - 503 when billing is not configured / unavailable
 * - 400 when the caller has no billing account
 * - 200 outcome:'linked' / outcome:'already' on success
 * - 409 on 'idor'
 * - 422 on 'not_found' / 'reconcile_assisted'
 * - 500 on unexpected errors, HTTPException passthrough
 *
 * @module test/routes/billing/link-preapproval
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: vi.fn()
}));

vi.mock('../../../src/lib/qzpay-logger', () => ({
    qzpayLogger: {}
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user-1', email: 'test@test.com', roles: [] }))
}));

vi.mock('../../../src/services/billing/link-preapproval.service', () => ({
    linkPreapprovalToLocalSub: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

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
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createMercadoPagoAdapter } from '@repo/billing';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handleLinkPreapproval } from '../../../src/routes/billing/link-preapproval';
import { linkPreapprovalToLocalSub } from '../../../src/services/billing/link-preapproval.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Record<string, unknown> = {}) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', 'cust-1'],
        ...Object.entries(overrides)
    ]);
    return { get: vi.fn((k: string) => store.get(k)) };
}

const BODY = { preapprovalId: 'pa-1', localSubscriptionId: 'sub-1' };

describe('handleLinkPreapproval', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getQZPayBilling).mockReturnValue({} as never);
        vi.mocked(createMercadoPagoAdapter).mockReturnValue({
            subscriptions: {
                retrieve: vi.fn().mockResolvedValue({
                    id: 'pa-1',
                    externalReference: null,
                    payerEmail: null
                })
            }
        } as never);
    });

    it('throws 503 when billing is not enabled', async () => {
        const c = makeContext({ billingEnabled: false });
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 503
        });
    });

    it('throws 503 when the billing instance is unavailable', async () => {
        vi.mocked(getQZPayBilling).mockReturnValue(null);
        const c = makeContext();
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 503
        });
    });

    it('throws 400 when the caller has no billing customer', async () => {
        const c = makeContext({ billingCustomerId: undefined });
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 400
        });
    });

    it('returns 200 outcome:linked on success', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockResolvedValue({
            outcome: 'linked',
            localSubscriptionId: 'sub-1'
        });
        const c = makeContext();
        const result = await handleLinkPreapproval(c as never, BODY);
        expect(result).toEqual({ outcome: 'linked', localSubscriptionId: 'sub-1' });
        expect(linkPreapprovalToLocalSub).toHaveBeenCalledWith(
            expect.objectContaining({
                preapprovalId: 'pa-1',
                expectedLocalSubscriptionId: 'sub-1',
                expectedCustomerId: 'cust-1'
            })
        );
    });

    it('returns 200 outcome:already on idempotent replay', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockResolvedValue({
            outcome: 'already',
            localSubscriptionId: 'sub-1'
        });
        const c = makeContext();
        const result = await handleLinkPreapproval(c as never, BODY);
        expect(result).toEqual({ outcome: 'already', localSubscriptionId: 'sub-1' });
    });

    it('throws 409 on idor', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockResolvedValue({ outcome: 'idor' });
        const c = makeContext();
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 409
        });
    });

    it('throws 422 on not_found', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockResolvedValue({ outcome: 'not_found' });
        const c = makeContext();
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 422
        });
    });

    it('throws 422 on reconcile_assisted', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockResolvedValue({ outcome: 'reconcile_assisted' });
        const c = makeContext();
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 422
        });
    });

    it('rethrows HTTPException as-is', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockRejectedValue(
            new HTTPException(418, { message: 'teapot' })
        );
        const c = makeContext();
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 418
        });
    });

    it('throws 500 on unexpected errors', async () => {
        vi.mocked(linkPreapprovalToLocalSub).mockRejectedValue(new Error('boom'));
        const c = makeContext();
        await expect(handleLinkPreapproval(c as never, BODY)).rejects.toMatchObject({
            status: 500
        });
    });
});
