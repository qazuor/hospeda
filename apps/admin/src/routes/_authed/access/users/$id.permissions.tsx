/**
 * User Permissions Tab Route
 *
 * Displays permissions for a specific user based on their role.
 * Shows inherited permissions from role and any direct overrides.
 */

import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserQuery } from '@/features/users/hooks/useUserQuery';
import { RoleEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Info, Shield } from 'lucide-react';

export const Route = createFileRoute('/_authed/access/users/$id/permissions')({
    component: UserPermissionsPage
});

// Role descriptions for context
const ROLE_INFO: Record<RoleEnum, { label: string; description: string }> = {
    [RoleEnum.SUPER_ADMIN]: {
        label: 'Super Admin',
        description: 'Full system access with all permissions'
    },
    [RoleEnum.ADMIN]: {
        label: 'Admin',
        description: 'Manages platform content and users'
    },
    [RoleEnum.CLIENT_MANAGER]: {
        label: 'Client Manager',
        description: 'Manages client accounts, billing and subscriptions'
    },
    [RoleEnum.EDITOR]: {
        label: 'Editor',
        description: 'Creates and edits events and posts'
    },
    [RoleEnum.HOST]: {
        label: 'Host',
        description: 'Manages their own accommodation listings'
    },
    [RoleEnum.USER]: {
        label: 'User',
        description: 'Registered user of the public portal'
    },
    [RoleEnum.GUEST]: {
        label: 'Guest',
        description: 'Public visitor, not logged in'
    }
};

function UserPermissionsPage() {
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

    // Get role info
    const userRole = (user.role || RoleEnum.USER) as RoleEnum;
    const roleInfo = ROLE_INFO[userRole];

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.usersView">
            <div className="space-y-4">
                <PageTabs
                    tabs={userTabs}
                    basePath={`/access/users/${id}`}
                />

                <div className="space-y-6">
                    {/* User role card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                    <Shield className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Current Role</CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        Role assigned to this user
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="default"
                                        className="text-sm"
                                    >
                                        {roleInfo.label}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    {roleInfo.description}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inherited permissions info */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                    <Info className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Inherited Permissions</CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        Permissions inherited from role assignment
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-muted-foreground text-sm">
                                    This user inherits all permissions associated with the{' '}
                                    <strong>{roleInfo.label}</strong> role. Role-based permissions
                                    are managed through the Roles page and apply to all users with
                                    the same role.
                                </p>

                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                                    <p className="text-blue-900 text-sm dark:text-blue-100">
                                        <strong>View Role Details:</strong> To see the complete list
                                        of permissions for the {roleInfo.label} role, visit the{' '}
                                        <a
                                            href="/access/roles"
                                            className="underline hover:text-blue-700 dark:hover:text-blue-200"
                                        >
                                            Roles page
                                        </a>
                                        .
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Direct permission overrides (placeholder) */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                    <Shield className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        Direct Permission Overrides
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        User-specific permission exceptions
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Shield className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                                <p className="mb-1 text-muted-foreground text-sm">
                                    No direct permission overrides
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    This user only has permissions inherited from their role
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Feature note */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                        <p className="text-amber-900 text-sm dark:text-amber-100">
                            <strong>Future Feature:</strong> Permission management functionality
                            will be available in a future update. This will allow administrators to
                            grant or revoke specific permissions at the user level, overriding role
                            defaults.
                        </p>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
