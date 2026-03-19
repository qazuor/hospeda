/**
 * Billing Subscription Fixtures
 *
 * Mock data for billing subscription entities used in admin integration tests.
 * Shapes derived from Subscription in apps/admin/src/features/billing-subscriptions/types.ts
 *
 * NOTE: billing_plans.id is UUID but billing_subscriptions.plan_id is varchar (slug).
 */
import { mockPaginatedResponse } from '../mocks/handlers';

/** Single valid subscription */
export const mockBillingSubscription = {
    id: 'sub-uuid-001',
    userId: 'user-uuid-001',
    userName: 'Juan Perez',
    userEmail: 'juan@example.com',
    planSlug: 'basic-owner',
    status: 'active',
    startDate: '2024-01-15T00:00:00.000Z',
    currentPeriodEnd: '2024-02-15T00:00:00.000Z',
    monthlyAmount: 500000,
    cancelAtPeriodEnd: false
} as const;

/** List of 3 subscriptions */
export const mockBillingSubscriptionList = [
    mockBillingSubscription,
    {
        ...mockBillingSubscription,
        id: 'sub-uuid-002',
        userId: 'user-uuid-002',
        userName: 'Maria Garcia',
        userEmail: 'maria@example.com',
        planSlug: 'pro-owner',
        status: 'trialing',
        startDate: '2024-03-01T00:00:00.000Z',
        currentPeriodEnd: '2024-03-15T00:00:00.000Z',
        monthlyAmount: 1500000,
        trialEnd: '2024-03-15T00:00:00.000Z'
    },
    {
        ...mockBillingSubscription,
        id: 'sub-uuid-003',
        userId: 'user-uuid-003',
        userName: 'Carlos Lopez',
        userEmail: 'carlos@example.com',
        planSlug: 'enterprise-complex',
        status: 'cancelled',
        startDate: '2023-06-01T00:00:00.000Z',
        currentPeriodEnd: '2024-01-01T00:00:00.000Z',
        monthlyAmount: 5000000,
        cancelAtPeriodEnd: true,
        discountPercent: 10
    }
] as const;

/** Paginated response for subscriptions */
export const mockBillingSubscriptionPage = mockPaginatedResponse([...mockBillingSubscriptionList]);
