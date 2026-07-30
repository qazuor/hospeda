/**
 * User Permissions Tab Route
 *
 * Displays the roles a user holds and the permissions that follow from them.
 *
 * HOS-296: the "current role" summary card was a single-value read of
 * `user.role`, a column that no longer exists. It is replaced by
 * {@link UserRolesCard}, which shows the full SET with each hat's provenance
 * and lets an operator grant/revoke — the panel-side half of AC-10.
 *
 * Uses the same sticky header chrome as `$id.tsx` and `$id_.edit.tsx` via
 * `UserSiblingPageShell` so navigation between Perfil / Permisos / Actividad
 * stays visually cohesive.
 */

import { InfoIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionOverridesCard } from '@/features/users/components/permissions/PermissionOverridesCard';
import { UserRolesCard } from '@/features/users/components/roles/UserRolesCard';
import { UserSiblingPageShell } from '@/features/users/components/UserSiblingPageShell';
import { useTranslations } from '@/hooks/use-translations';

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

    return (
        <div className="space-y-6">
            {/* Held roles + grant/revoke (HOS-296) */}
            <UserRolesCard userId={userId} />

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
                        {/* HOS-296: the copy is role-set aware — a user inherits the
                            UNION of the permissions of every hat they wear, not the
                            permissions of "their role". */}
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.access.users.permissions.inheritedFromRolesDesc')}
                        </p>

                        <div className="rounded-lg border border-info/30 bg-info/10 p-4">
                            <p className="text-foreground text-sm">
                                <strong>
                                    {t('admin-pages.access.users.permissions.viewRoleDetails')}
                                </strong>{' '}
                                {t('admin-pages.access.users.permissions.viewRoleDetailsRolesDesc')}{' '}
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

            {/* Direct permission overrides (SPEC-170): live grant/deny management. */}
            <PermissionOverridesCard userId={userId} />
        </div>
    );
}
