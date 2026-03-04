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
import { useTranslations } from '@/hooks/use-translations';
import { AlertCircleIcon, InfoIcon, LoaderIcon, ShieldIcon } from '@repo/icons';
import { RoleEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/$id_/permissions')({
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
    [RoleEnum.SPONSOR]: {
        label: 'Sponsor',
        description: 'External business sponsor with limited dashboard access'
    },
    [RoleEnum.GUEST]: {
        label: 'Guest',
        description: 'Public visitor, not logged in'
    }
};

function UserPermissionsPage() {
    const { t } = useTranslations();
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
                            <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.access.users.loadingData')}
                            </p>
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
                            <AlertCircleIcon className="h-12 w-12 text-destructive" />
                            <div>
                                <p className="font-semibold">
                                    {t('admin-pages.access.users.errorLoading')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {error?.message || t('admin-pages.access.users.userNotFound')}
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
                                    <ShieldIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.access.users.permissions.currentRole')}
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.access.users.permissions.currentRoleDesc')}
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                                    <InfoIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        {t(
                                            'admin-pages.access.users.permissions.inheritedPermissions'
                                        )}
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {t(
                                            'admin-pages.access.users.permissions.inheritedPermissionsDesc'
                                        )}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.access.users.permissions.inheritedDesc')}{' '}
                                    <strong>{roleInfo.label}</strong>{' '}
                                    {t('admin-pages.access.users.permissions.inheritedNote')}
                                </p>

                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                                    <p className="text-blue-900 text-sm dark:text-blue-100">
                                        <strong>
                                            {t(
                                                'admin-pages.access.users.permissions.viewRoleDetails'
                                            )}
                                        </strong>{' '}
                                        {t(
                                            'admin-pages.access.users.permissions.viewRoleDetailsDesc'
                                        )}{' '}
                                        {roleInfo.label},{' '}
                                        <a
                                            href="/access/roles"
                                            className="underline hover:text-blue-700 dark:hover:text-blue-200"
                                        >
                                            {t(
                                                'admin-pages.access.users.permissions.rolesPageLink'
                                            )}
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-400/10">
                                    <ShieldIcon className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.access.users.permissions.directOverrides')}
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {t(
                                            'admin-pages.access.users.permissions.directOverridesDesc'
                                        )}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <ShieldIcon className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                                <p className="mb-1 text-muted-foreground text-sm">
                                    {t('admin-pages.access.users.permissions.noDirectOverrides')}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    {t(
                                        'admin-pages.access.users.permissions.noDirectOverridesDesc'
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Feature note */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                        <p className="text-amber-900 text-sm dark:text-amber-100">
                            <strong>
                                {t('admin-pages.access.users.permissions.futureFeature')}
                            </strong>{' '}
                            {t('admin-pages.access.users.permissions.futureFeatureDesc')}
                        </p>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
