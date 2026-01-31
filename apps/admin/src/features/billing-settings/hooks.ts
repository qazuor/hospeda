import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BillingSettings, UpdateBillingSettingsPayload } from './types';

const API_BASE = '/api/v1';

/**
 * Default billing settings (mock data)
 */
const DEFAULT_SETTINGS: BillingSettings = {
    trial: {
        trialDurationDays: 14,
        autoBlockOnExpiry: true
    },
    payment: {
        gracePeriodDays: 3,
        paymentRetryAttempts: 3,
        retryIntervalHours: 24,
        defaultCurrency: 'ARS'
    },
    webhook: {
        webhookUrl: 'https://api.hospeda.com/webhooks/mercadopago',
        webhookSecret: '••••••••••••••••',
        lastWebhookReceivedAt: null
    },
    notification: {
        sendPaymentReminders: true,
        reminderDaysBeforeDue: 3,
        sendReceiptOnPayment: true
    }
};

/**
 * Query keys for billing settings
 */
export const billingSettingsQueryKeys = {
    settings: ['billing-settings'] as const
};

/**
 * Fetch billing settings
 * TODO: Replace with actual API endpoint once billing API routes are implemented
 */
async function fetchBillingSettings(): Promise<BillingSettings> {
    try {
        // TODO: Update endpoint when API is ready
        // Expected endpoint: GET /api/v1/billing/settings
        const response = await fetch(`${API_BASE}/billing/settings`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch billing settings: ${response.statusText}`);
        }

        const json = await response.json();
        return json.data;
    } catch (_error) {
        // Return default settings if API is not available
        return DEFAULT_SETTINGS;
    }
}

/**
 * Update billing settings
 * TODO: Replace with actual API endpoint once billing API routes are implemented
 */
async function updateBillingSettings(
    payload: UpdateBillingSettingsPayload
): Promise<BillingSettings> {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PATCH /api/v1/billing/settings
    const response = await fetch(`${API_BASE}/billing/settings`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to update billing settings: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch billing settings
 */
export const useBillingSettingsQuery = () => {
    return useQuery({
        queryKey: billingSettingsQueryKeys.settings,
        queryFn: fetchBillingSettings,
        staleTime: 5 * 60 * 1000 // 5 minutes
    });
};

/**
 * Hook to update billing settings
 */
export const useUpdateBillingSettingsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdateBillingSettingsPayload) => updateBillingSettings(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: billingSettingsQueryKeys.settings });
        }
    });
};
