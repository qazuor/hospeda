/**
 * Integration tests for the public checkout-config endpoint
 * (`GET /api/v1/public/billing/checkout-config`).
 *
 * HOS-937 review fix: this endpoint is what lets `apps/web` gate the
 * payer-email confirm dialog on the actual server-side
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` flag instead of an inferred or
 * hardcoded value. Covers: public (skipAuth), and both flag states pass
 * through byte-for-byte as `ownPreapprovalEnabled`.
 *
 * Also covers `newPaidSignupsFrozen`, read from the admin-editable billing
 * settings (not env), so the web can show a "signups are paused" notice.
 *
 * @module test/routes/billing/public/getCheckoutConfig
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — before imports
// ---------------------------------------------------------------------------

const { mockCreateSimpleRoute } = vi.hoisted(() => ({
    mockCreateSimpleRoute: vi.fn()
}));

// Capture route factory calls (same pattern as listPlans.test.ts).
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createSimpleRoute: mockCreateSimpleRoute
}));

// Mutable so each test can flip the flag before re-importing the handler.
const mockEnv: { HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: boolean } = {
    HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: false
};

vi.mock('../../../../src/utils/env.js', () => ({
    get env() {
        return mockEnv;
    }
}));

// The billing-settings read behind `readNewPaidSignupsFreeze`. Mocked at the
// settings layer (not the freeze module) so the real strict `=== true` read runs.
const { mockGetSettings } = vi.hoisted(() => ({
    mockGetSettings: vi.fn()
}));

vi.mock('../../../../src/services/billing-settings.service', () => ({
    getBillingSettingsService: () => ({ getSettings: mockGetSettings })
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Import module to trigger route factory registration.
import '../../../../src/routes/billing/public/getCheckoutConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CheckoutConfigResult = {
    ownPreapprovalEnabled: boolean;
    newPaidSignupsFrozen: boolean;
};

function getHandler(): (ctx: unknown) => Promise<CheckoutConfigResult> {
    const call = mockCreateSimpleRoute.mock.calls[0];
    return (call?.[0] as Record<string, unknown>)?.handler as (
        ctx: unknown
    ) => Promise<CheckoutConfigResult>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publicGetCheckoutConfigRoute', () => {
    beforeEach(() => {
        mockEnv.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = false;
        mockGetSettings.mockReset();
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: false });
    });

    it('registers with skipAuth: true (public endpoint)', () => {
        const call = mockCreateSimpleRoute.mock.calls[0];
        const config = call?.[0] as Record<string, unknown>;

        expect(config?.options).toMatchObject({ skipAuth: true });
    });

    it('returns ownPreapprovalEnabled: false when the underlying env flag is off (production default)', async () => {
        mockEnv.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = false;

        const result = await getHandler()(undefined);

        expect(result).toEqual({ ownPreapprovalEnabled: false, newPaidSignupsFrozen: false });
    });

    it('returns ownPreapprovalEnabled: true when the underlying env flag is on', async () => {
        mockEnv.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED = true;

        const result = await getHandler()(undefined);

        expect(result).toEqual({ ownPreapprovalEnabled: true, newPaidSignupsFrozen: false });
    });

    it('returns newPaidSignupsFrozen: true when an admin froze new paid signups', async () => {
        // Arrange
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: true });

        // Act
        const result = await getHandler()(undefined);

        // Assert
        expect(result.newPaidSignupsFrozen).toBe(true);
    });

    it('returns newPaidSignupsFrozen: false for anything that is not literally true', async () => {
        // Arrange — a malformed stored value must not read as frozen
        mockGetSettings.mockResolvedValue({ newPaidSignupsFrozen: 'true' });

        // Act
        const result = await getHandler()(undefined);

        // Assert
        expect(result.newPaidSignupsFrozen).toBe(false);
    });
});
