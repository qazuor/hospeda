import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { formatDate } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/notifications')({
    component: NotificationsPage
});

type NotificationType = 'success' | 'warning' | 'error' | 'info';

type Notification = {
    id: string;
    type: NotificationType;
    message: string;
    timestamp: string;
    read: boolean;
};

const STORAGE_KEY = 'hospeda-admin-notifications';

function getNotifications(): Notification[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveNotifications(notifications: Notification[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
        // Silently fail if localStorage is not available
    }
}

function getVariantForType(
    type: NotificationType
): 'default' | 'destructive' | 'secondary' | 'outline' {
    switch (type) {
        case 'success':
            return 'default';
        case 'error':
            return 'destructive';
        case 'warning':
            return 'secondary';
        default:
            return 'outline';
    }
}

function NotificationsPage() {
    const { t, locale } = useTranslations();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        setNotifications(getNotifications());
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications((prev) => {
            const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
            saveNotifications(updated);
            return updated;
        });
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
        saveNotifications([]);
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <MainPageLayout title={t('admin-pages.notifications.title')}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-2xl">
                            {t('admin-pages.notifications.title')}
                        </h2>
                        <p className="text-muted-foreground">
                            {unreadCount > 0
                                ? `${unreadCount} ${unreadCount > 1 ? t('admin-pages.notifications.unreadPlural').replace('{{count}}', String(unreadCount)) : t('admin-pages.notifications.unreadSingular').replace('{{count}}', String(unreadCount))}`
                                : t('admin-pages.notifications.allRead')}
                        </p>
                    </div>
                    {notifications.length > 0 && (
                        <Button
                            onClick={clearAll}
                            variant="outline"
                        >
                            {t('admin-pages.notifications.clearAll')}
                        </Button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <p className="text-muted-foreground">
                                {t('admin-pages.notifications.empty')}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notification) => (
                            <Card
                                key={notification.id}
                                className={notification.read ? 'opacity-60' : ''}
                            >
                                <CardContent className="pt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={getVariantForType(notification.type)}
                                                >
                                                    {notification.type}
                                                </Badge>
                                                {!notification.read && (
                                                    <Badge variant="outline">
                                                        {t('admin-pages.notifications.unreadBadge')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm">{notification.message}</p>
                                            <p className="text-muted-foreground text-xs">
                                                {formatDate({
                                                    date: notification.timestamp,
                                                    locale,
                                                    options: {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short'
                                                    }
                                                })}
                                            </p>
                                        </div>
                                        {!notification.read && (
                                            <Button
                                                onClick={() => markAsRead(notification.id)}
                                                variant="ghost"
                                                size="sm"
                                            >
                                                {t('admin-pages.notifications.markAsRead')}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </MainPageLayout>
    );
}
