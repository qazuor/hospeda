/**
 * User Activity Tab Route
 *
 * Displays activity history and metadata for a specific user.
 * Shows user creation/update timestamps and placeholder for activity logs.
 */

import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserQuery } from '@/features/users/hooks/useUserQuery';
import { createFileRoute } from '@tanstack/react-router';
import { Activity, AlertCircle, Calendar, Clock } from 'lucide-react';

export const Route = createFileRoute('/_authed/access/users/$id/activity')({
    component: UserActivityPage
});

/**
 * Format date for display
 */
function formatDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(dateObj);
}

/**
 * Calculate time since date
 */
function getTimeSince(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
}

function UserActivityPage() {
    const { id } = Route.useParams();

    // Fetch user data
    const { data: user, isLoading, error } = useUserQuery(id);

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.usersView">
                <div className="space-y-4">
                    <PageTabs
                        tabs={userTabs}
                        basePath={`/access/users/${id}`}
                    />
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                            <p className="text-muted-foreground text-sm">Loading user data...</p>
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    if (error || !user) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.usersView">
                <div className="space-y-4">
                    <PageTabs
                        tabs={userTabs}
                        basePath={`/access/users/${id}`}
                    />
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <AlertCircle className="h-12 w-12 text-destructive" />
                            <div>
                                <p className="font-semibold">Error loading user</p>
                                <p className="text-muted-foreground text-sm">
                                    {error?.message || 'User not found'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.usersView">
            <div className="space-y-4">
                <PageTabs
                    tabs={userTabs}
                    basePath={`/access/users/${id}`}
                />

                <div className="space-y-6">
                    {/* User metadata */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Account created */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                                        <Calendar className="h-5 w-5 text-green-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Account Created</CardTitle>
                                        <p className="text-muted-foreground text-sm">
                                            When the user registered
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-medium">{formatDate(user.createdAt)}</p>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {getTimeSince(user.createdAt)}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Last updated */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                        <Clock className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Last Updated</CardTitle>
                                        <p className="text-muted-foreground text-sm">
                                            Most recent profile change
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-medium">{formatDate(user.updatedAt)}</p>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {getTimeSince(user.updatedAt)}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Activity log (placeholder) */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                    <Activity className="h-5 w-5 text-purple-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Activity History</CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        Recent user actions and events
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Activity className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
                                <p className="mb-2 font-medium text-muted-foreground">
                                    No activity history available
                                </p>
                                <p className="max-w-md text-muted-foreground text-sm">
                                    Activity tracking is not yet implemented. When available, this
                                    section will display login history, content interactions, and
                                    administrative actions performed by this user.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Future features info */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                        <p className="text-blue-900 text-sm dark:text-blue-100">
                            <strong>Coming Soon:</strong> Activity history tracking will include
                            login history, IP addresses, device information, content
                            creation/editing events, permission changes, and administrative actions.
                            This will provide a complete audit trail for user activities.
                        </p>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
