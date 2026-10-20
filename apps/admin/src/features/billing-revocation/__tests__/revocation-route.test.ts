/**
 * Tests for the revocation page's `beforeLoad` gate (HOS-1678, H14): the first
 * of the two gates by `BILLING_CANCEL_SUBSCRIPTION`. A direct URL must redirect
 * an admin who holds other billing permissions but not this one.
 */

import { PermissionEnum } from '@repo/schemas';
import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

// The global setup stubs the router without `redirect`; this test needs the real one.
vi.mock('@tanstack/react-router', async (importOriginal) => importOriginal());

vi.mock('@/features/billing-revocation/components/SubscriptionRevocationScreen', () => ({
    SubscriptionRevocationScreen: () => null
}));
vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: () => null
}));

const { Route } = await import('@/routes/_authed/billing/subscriptions/$subscriptionId.revocation');

/** The part of `beforeLoad` the gate uses. */
type GateFn = (input: {
    readonly context: { readonly permissions: readonly PermissionEnum[] };
}) => unknown;

/** Runs the page's `beforeLoad` with a context holding `permissions`. */
function runBeforeLoad(permissions: readonly PermissionEnum[]): unknown {
    // TYPE-WORKAROUND: the router's beforeLoad wants a full match context; the gate reads only `context`.
    const beforeLoad = Route.options.beforeLoad as unknown as GateFn;
    return beforeLoad({ context: { permissions } });
}

describe('HOS-1678 revocation page beforeLoad', () => {
    it('lets through an admin holding BILLING_CANCEL_SUBSCRIPTION', () => {
        // Arrange + Act + Assert
        expect(() =>
            runBeforeLoad([
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
            ])
        ).not.toThrow();
    });

    it('redirects an admin with other billing permissions but not BILLING_CANCEL_SUBSCRIPTION', () => {
        // Arrange
        const permissions = [
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.BILLING_SETTINGS_WRITE,
            PermissionEnum.PAYMENT_REFUND
        ];

        // Act
        let thrown: unknown = null;
        try {
            runBeforeLoad(permissions);
        } catch (error) {
            thrown = error;
        }

        // Assert
        expect(isRedirect(thrown)).toBe(true);
        expect((thrown as { options?: { to?: string } }).options?.to).toBe('/auth/forbidden');
    });
});
