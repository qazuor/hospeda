/**
 * User Permissions Tab Route
 *
 * Displays permissions for a specific user based on their role.
 * Shows inherited permissions from role and any direct overrides.
 *
 * Uses the same sticky header chrome as `$id.tsx` and `$id_.edit.tsx` via
 * `UserSiblingPageShell` so navigation between Perfil / Permisos / Actividad
 * stays visually cohesive.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserSiblingPageShell } from '@/features/users/components/UserSiblingPageShell';
import { useUserQuery } from '@/features/users/hooks/useUserQuery';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { InfoIcon, ShieldIcon } from '@repo/icons';
import { RoleEnum } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/$id_/permissions')({
    component: UserPermissionsPage
});

function UserPermissionsPage() {
    const { id } = Route.useParams();

    return (
        <UserSiblingPageShell userId={id}>
            <PermissionsBody userId={id} />
        </UserSiblingPageShell>
    );
}

function PermissionsBody({ userId }: { readonly userId: string }) {
    const { t } = useTranslations();
    const { data: user } = useUserQuery(userId);

    if (!user) return null;

    const userRole = (user.role || RoleEnum.USER) as RoleEnum;
    const roleInfo = {
        label: t(`admin-pages.access.roles.catalog.${userRole}.name` as TranslationKey),
        description: t(`admin-pages.access.roles.catalog.${userRole}.description` as TranslationKey)
    };

    return (
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
                        <p className="text-muted-foreground text-sm">{roleInfo.description}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Inherited permissions info */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                            <InfoIcon className="h-5 w-5 text-info" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">
                                {t('admin-pages.access.users.permissions.inheritedPermissions')}
                            </CardTitle>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.access.users.permissions.inheritedPermissionsDesc')}
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

                        <div className="rounded-lg border border-info/30 bg-info/10 p-4">
                            <p className="text-foreground text-sm">
                                <strong>
                                    {t('admin-pages.access.users.permissions.viewRoleDetails')}
                                </strong>{' '}
                                {t('admin-pages.access.users.permissions.viewRoleDetailsDesc')}{' '}
                                {roleInfo.label},{' '}
                                <a
                                    href="/access/roles"
                                    className="underline hover:text-info"
                                >
                                    {t('admin-pages.access.users.permissions.rolesPageLink')}
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                            <ShieldIcon className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">
                                {t('admin-pages.access.users.permissions.directOverrides')}
                            </CardTitle>
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.access.users.permissions.directOverridesDesc')}
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
                            {t('admin-pages.access.users.permissions.noDirectOverridesDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Feature note */}
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
                <p className="text-foreground text-sm">
                    <strong>{t('admin-pages.access.users.permissions.futureFeature')}</strong>{' '}
                    {t('admin-pages.access.users.permissions.futureFeatureDesc')}
                </p>
            </div>
        </div>
    );
}
