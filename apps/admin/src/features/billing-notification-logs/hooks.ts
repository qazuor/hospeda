import { useQuery } from '@tanstack/react-query';

const API_BASE = '/api/v1';

/**
 * Notification log entry types
 */
export type NotificationType =
    | 'payment_success'
    | 'payment_failed'
    | 'trial_ending'
    | 'trial_expired'
    | 'subscription_cancelled'
    | 'payment_reminder'
    | 'payment_receipt';

export type NotificationStatus = 'sent' | 'failed' | 'pending';

export type NotificationChannel = 'email' | 'sms' | 'push';

export interface NotificationLog {
    id: string;
    type: NotificationType;
    recipient: string;
    subject: string;
    status: NotificationStatus;
    channel: NotificationChannel;
    sentAt: string;
    metadata?: Record<string, unknown>;
    errorMessage?: string;
    userId?: string;
    userName?: string;
}

/**
 * Query keys for notification log queries
 */
export const notificationLogQueryKeys = {
    notifications: {
        all: ['billing-notification-logs'] as const,
        lists: () => [...notificationLogQueryKeys.notifications.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...notificationLogQueryKeys.notifications.lists(), filters] as const,
        details: () => [...notificationLogQueryKeys.notifications.all, 'detail'] as const,
        detail: (id: string) => [...notificationLogQueryKeys.notifications.details(), id] as const
    }
};

/**
 * Fetch notification logs with filters
 */
async function fetchNotificationLogs(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const response = await fetch(`${API_BASE}/admin/billing/notifications?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch notification logs: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch a single notification log by ID
 */
async function fetchNotificationLog(id: string) {
    const response = await fetch(`${API_BASE}/admin/billing/notifications/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch notification log: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch notification logs
 */
export const useNotificationLogsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: notificationLogQueryKeys.notifications.list(filters),
        queryFn: () => fetchNotificationLogs(filters),
        staleTime: 30_000
    });
};

/**
 * Hook to fetch a single notification log
 */
export const useNotificationLogQuery = (id: string) => {
    return useQuery({
        queryKey: notificationLogQueryKeys.notifications.detail(id),
        queryFn: () => fetchNotificationLog(id),
        staleTime: 60_000,
        enabled: !!id
    });
};
