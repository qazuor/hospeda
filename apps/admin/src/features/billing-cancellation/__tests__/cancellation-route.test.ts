/** Tests the direct URL permission gate for action 8 cancellation. */

import { PermissionEnum } from '@repo/schemas';
import { isRedirect } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', async (importOriginal) => importOriginal());
vi.mock('@/features/billing-cancellation/components/SubscriptionCancellationScreen', () => ({
    SubscriptionCancellationScreen: () => null
}));
vi.mock('@/components/layout/SidebarPageLayout', () => ({ SidebarPageLayout: () => null }));
const { Route } = await import(
    '@/routes/_authed/billing/subscriptions/$subscriptionId.cancellation'
);
type GateFn = (input: {
    readonly context: { readonly permissions: readonly PermissionEnum[] };
}) => unknown;
function runBeforeLoad(permissions: readonly PermissionEnum[]): unknown {
    const beforeLoad = Route.options.beforeLoad as unknown as GateFn;
    return beforeLoad({ context: { permissions } });
}
describe('TEST:1696:3 AC:1696:3 cancellation route beforeLoad', () => {
    it('allows an admin holding BILLING_CANCEL_SUBSCRIPTION', () => {
        expect(() =>
            runBeforeLoad([
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
            ])
        ).not.toThrow();
    });
    it('redirects an admin with billing permissions but without BILLING_CANCEL_SUBSCRIPTION', () => {
        let thrown: unknown = null;
        try {
            runBeforeLoad([
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.BILLING_SETTINGS_WRITE,
                PermissionEnum.PAYMENT_REFUND
            ]);
        } catch (error) {
            thrown = error;
        }
        expect(isRedirect(thrown)).toBe(true);
        expect((thrown as { options?: { to?: string } }).options?.to).toBe('/auth/forbidden');
    });
});
