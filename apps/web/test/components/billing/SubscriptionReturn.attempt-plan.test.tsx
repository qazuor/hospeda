import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/billing/SubscriptionReturn.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, property) => String(property)
    })
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, _fallback?: string, values?: Record<string, string>) =>
            values?.plan ? `${key}:${values.plan}` : key
    })
}));
const readMock = vi.fn();
const startMock = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: {
        read: (...args: unknown[]) => readMock(...args),
        start: (...args: unknown[]) => startMock(...args)
    }
}));

import {
    SubscriptionReturn,
    type SubscriptionReturnProps
} from '../../../src/components/billing/SubscriptionReturn.client';

const SUBSCRIPTION_ID = '123e4567-e89b-42d3-a456-426614174000';
const BILLING_OPTION_ID = '223e4567-e89b-42d3-a456-426614174000';
const props: Omit<SubscriptionReturnProps, 'attemptPlanName'> = {
    locale: 'es',
    subscriptionId: SUBSCRIPTION_ID,
    initialStatus: 'CHARGE_DECLINED',
    billingOptionId: BILLING_OPTION_ID,
    accountEmail: 'account@example.test',
    declaredPayerEmail: 'payer@example.test'
};

beforeEach(() => {
    vi.useFakeTimers();
    readMock.mockReset();
    startMock.mockReset();
    window.sessionStorage.clear();
});
afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('HOS-2064 declined signup notice island', () => {
    it('renders the attempted plan line on a declined notice', () => {
        // Arrange
        render(
            <SubscriptionReturn
                {...props}
                attemptPlanName="Plan Básico"
            />
        );
        // Act
        const planLine = screen.getByTestId('subscription-return-attempt-plan');
        // Assert
        expect(planLine.textContent).toBe(
            'billing.checkout.return.rejected.attemptPlan:Plan Básico'
        );
    });

    it('omits the plan line without attemptPlanName', () => {
        // Arrange
        render(<SubscriptionReturn {...props} />);
        // Act
        const planLine = screen.queryByTestId('subscription-return-attempt-plan');
        // Assert
        expect(planLine).toBeNull();
    });

    it('a declined notice does not poll the subscription read', async () => {
        // Arrange
        render(<SubscriptionReturn {...props} />);
        // Act
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });
        // Assert
        expect(readMock).toHaveBeenCalledTimes(0);
    });

    it('the retry button starts one checkout with the declined option', async () => {
        // Arrange
        startMock.mockResolvedValue({ ok: false, error: { status: 503, reason: 'PROVIDER_BUSY' } });
        render(<SubscriptionReturn {...props} />);
        // Act
        await act(async () => {
            fireEvent.click(screen.getByTestId('subscription-return-retry'));
        });
        // Assert
        expect(startMock).toHaveBeenCalledTimes(1);
        expect(startMock).toHaveBeenCalledWith({
            billingOptionId: BILLING_OPTION_ID,
            payerEmail: 'payer@example.test'
        });
    });
});
