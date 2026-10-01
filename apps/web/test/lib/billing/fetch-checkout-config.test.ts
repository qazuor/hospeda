/**
 * @file fetch-checkout-config.test.ts
 * @description `fetchCheckoutConfig` reads the public checkout flags, including
 * the admin-editable `newPaidSignupsFrozen`, and never throws: every failure
 * resolves to both flags off.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
    getApiUrl: () => 'https://api.hospeda.test'
}));

import { fetchCheckoutConfig } from '@/lib/billing/fetch-checkout-config';

function mockFetchJson({ status, body }: { status: number; body: unknown }): void {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: status >= 200 && status < 300,
            status,
            json: vi.fn().mockResolvedValue(body)
        })
    );
}

describe('fetchCheckoutConfig', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns newPaidSignupsFrozen: true when the API reports the freeze on', async () => {
        // Arrange
        mockFetchJson({
            status: 200,
            body: { data: { ownPreapprovalEnabled: false, newPaidSignupsFrozen: true } }
        });

        // Act
        const config = await fetchCheckoutConfig();

        // Assert
        expect(config).toEqual({ ownPreapprovalEnabled: false, newPaidSignupsFrozen: true });
    });

    it('reads newPaidSignupsFrozen as false when an older API omits the field', async () => {
        // Arrange
        mockFetchJson({ status: 200, body: { data: { ownPreapprovalEnabled: true } } });

        // Act
        const config = await fetchCheckoutConfig();

        // Assert
        expect(config).toEqual({ ownPreapprovalEnabled: true, newPaidSignupsFrozen: false });
    });

    it('reads a non-boolean newPaidSignupsFrozen as false', async () => {
        // Arrange
        mockFetchJson({
            status: 200,
            body: { data: { ownPreapprovalEnabled: false, newPaidSignupsFrozen: 'true' } }
        });

        // Act
        const config = await fetchCheckoutConfig();

        // Assert
        expect(config.newPaidSignupsFrozen).toBe(false);
    });

    it('falls back to both flags off on a non-OK response', async () => {
        // Arrange
        mockFetchJson({ status: 503, body: {} });

        // Act
        const config = await fetchCheckoutConfig();

        // Assert
        expect(config).toEqual({ ownPreapprovalEnabled: false, newPaidSignupsFrozen: false });
    });

    it('falls back to both flags off when fetch rejects', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        // Act
        const config = await fetchCheckoutConfig();

        // Assert
        expect(config).toEqual({ ownPreapprovalEnabled: false, newPaidSignupsFrozen: false });
    });
});
