/**
 * Unit tests for the AC-11 content gate on `sendPartnerPaymentLinkHandler`
 * (HOS-278 D2).
 *
 * The gate is what makes §6.3 order real: content is reviewed BEFORE the
 * partner is charged, so nobody pays for days they are not visible. This suite
 * pins the two things that make it worth having — that an unapproved partner
 * is refused, and that the refusal happens before any MercadoPago customer is
 * created for them.
 *
 * @module test/routes/partners/admin/send-link.content-gate
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getByIdMock, customersGetByExternalIdMock, customersCreateMock, initiateMock } = vi.hoisted(
    () => ({
        getByIdMock: vi.fn(),
        customersGetByExternalIdMock: vi.fn(),
        customersCreateMock: vi.fn(),
        initiateMock: vi.fn()
    })
);

// The real factory wires auth/permission middleware that transitively pulls in
// the whole @repo/db surface. This module only needs the extracted handler.
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createAdminRoute: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    // The gate predicate itself is NOT mocked — the point of this suite is to
    // exercise the real one through the route.
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class PartnerServiceStub {
        getById = getByIdMock;
        update = vi.fn(async () => ({}));
    }
    return { ...actual, PartnerService: PartnerServiceStub };
});

vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => ({
        customers: {
            getByExternalId: customersGetByExternalIdMock,
            create: customersCreateMock
        }
    }))
}));

vi.mock('../../../../src/services/subscription-checkout.service', () => ({
    initiatePartnerMonthlySubscription: initiateMock,
    SubscriptionCheckoutError: class SubscriptionCheckoutError extends Error {}
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'admin-1', roles: [], permissions: [] }))
}));

import { sendPartnerPaymentLinkHandler } from '../../../../src/routes/partners/admin/send-link';

const PARTNER_ID = '00000000-0000-4000-a000-000000000001';
const PLAN_ID = '00000000-0000-4000-a000-000000000002';

const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    name: 'Acme Turismo',
    planId: PLAN_ID,
    contentApprovedAt: null,
    ...overrides
});

// biome-ignore lint/suspicious/noExplicitAny: the handler only reads params, the Hono context is unused here
const ctx = {} as any;

beforeEach(() => {
    vi.clearAllMocks();
    customersGetByExternalIdMock.mockResolvedValue({ id: 'cus_1' });
    initiateMock.mockResolvedValue({
        checkoutUrl: 'https://mp.example.com/checkout',
        localSubscriptionId: 'sub_1'
    });
});

describe('sendPartnerPaymentLinkHandler — AC-11 content gate', () => {
    it('refuses with 422 when the partner content was never approved', async () => {
        // Arrange — a provisioned partner: has a plan assigned, but no admin has
        // looked at their logo and texts yet.
        getByIdMock.mockResolvedValue({ data: makePartner({ contentApprovedAt: null }) });

        // Act + Assert
        await expect(sendPartnerPaymentLinkHandler(ctx, { id: PARTNER_ID })).rejects.toThrow(
            HTTPException
        );
        await expect(sendPartnerPaymentLinkHandler(ctx, { id: PARTNER_ID })).rejects.toMatchObject({
            status: 422
        });
    });

    it('refuses BEFORE touching MercadoPago at all', async () => {
        // Arrange — a partner refused here must not leave a customer record
        // behind on the provider side for a checkout that never happens.
        getByIdMock.mockResolvedValue({ data: makePartner({ contentApprovedAt: null }) });

        // Act — asserting the SPECIFIC refusal, not merely "it threw": a
        // broken mock also throws, and would make the assertions below pass
        // without the gate having run at all.
        await expect(sendPartnerPaymentLinkHandler(ctx, { id: PARTNER_ID })).rejects.toThrow(
            /content has not been approved/i
        );

        // Assert
        expect(customersGetByExternalIdMock).not.toHaveBeenCalled();
        expect(customersCreateMock).not.toHaveBeenCalled();
        expect(initiateMock).not.toHaveBeenCalled();
    });

    it('refuses before the missing-plan check, so the reason reported is the real one', async () => {
        // Arrange — a partner with NEITHER approved content nor a plan. Both
        // paths answer 422; only the message tells the admin which to fix, and
        // "assign a plan" would send them down the wrong one.
        getByIdMock.mockResolvedValue({
            data: makePartner({ contentApprovedAt: null, planId: null })
        });

        // Act + Assert
        await expect(sendPartnerPaymentLinkHandler(ctx, { id: PARTNER_ID })).rejects.toThrow(
            /content has not been approved/i
        );
    });

    it('proceeds to checkout once the content is approved', async () => {
        // Arrange
        getByIdMock.mockResolvedValue({
            data: makePartner({ contentApprovedAt: new Date('2026-07-10T12:00:00Z') })
        });

        // Act
        const result = await sendPartnerPaymentLinkHandler(ctx, { id: PARTNER_ID });

        // Assert
        expect(result).toEqual({
            paymentUrl: 'https://mp.example.com/checkout',
            planId: PLAN_ID
        });
        expect(initiateMock).toHaveBeenCalledTimes(1);
    });
});
