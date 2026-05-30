/**
 * UserSiblingPageShell — chrome wrapper for user "tab" pages that are NOT
 * the main profile view/edit (i.e. permissions and activity).
 *
 * Renders the same EntityPageHeader sticky chrome (avatar + displayName +
 * role subtitle + lifecycle badge + Impersonate + Delete + tab strip) and
 * delegates the body to its children. Use this for pages reached by the
 * Perfil / Permisos / Actividad tab navigation so the chrome stays
 * consistent with `$id.tsx` and `$id_.edit.tsx`.
 *
 * Loading + error states are rendered inline (no EntityPageHeader chrome) so
 * the sticky header never appears with empty / placeholder data.
 */

import { EntityPageHeader } from '@/components/entity-header/EntityPageHeader';
import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { ImpersonateButton } from '@/features/users/components/ImpersonateButton';
import { useUserHeaderProps } from '@/features/users/hooks/useUserHeaderProps';
import { useDeleteUserMutation, useUserQuery } from '@/features/users/hooks/useUserQuery';
import { useTranslations } from '@/hooks/use-translations';
import { AlertCircleIcon, LoaderIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface UserSiblingPageShellProps {
    readonly userId: string;
    readonly children: ReactNode;
}

export function UserSiblingPageShell({ userId, children }: UserSiblingPageShellProps) {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const { data: user, isLoading, error } = useUserQuery(userId);

    const headerProps = useUserHeaderProps({
        entity: user as Record<string, unknown> | undefined
    });

    if (isLoading) {
        return (
            <div className="space-y-4 p-6">
                <h1 className="sr-only">{t('admin-common.states.loading')}</h1>
                <div className="flex min-h-[400px] items-center justify-center">
                    <div className="text-center">
                        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-muted-foreground text-sm">
                            {t('admin-common.states.loading')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="space-y-4 p-6">
                <div className="flex min-h-[400px] items-center justify-center">
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
        );
    }

    const userEntity = user as { displayName?: string; slug?: string };
    const displayName = userEntity.displayName || userEntity.slug || userId;

    const headerExtraActions = (
        <>
            <ImpersonateButton
                userId={userId}
                variant="responsive"
            />
            <DeleteRowButton
                entityId={userId}
                entityName={displayName}
                entityLabel={t('admin-entities.entities.user.singular')}
                permission={PermissionEnum.USER_DELETE}
                useDeleteMutation={useDeleteUserMutation}
                variant="responsive"
                onDeleted={() => navigate({ to: '/access/users' })}
            />
        </>
    );

    const headerTabs = (
        <PageTabs
            tabs={userTabs}
            basePath={`/access/users/${userId}`}
            className="!mb-0 !border-b-0"
        />
    );

    return (
        <div className="space-y-4 p-6">
            <h1 className="sr-only">{displayName}</h1>
            <EntityErrorBoundary>
                <EntityPageHeader
                    mode="view"
                    title={displayName}
                    subtitle={headerProps.subtitle}
                    badges={headerProps.badges}
                    media={headerProps.media}
                    extraActions={headerExtraActions}
                    tabs={headerTabs}
                />
                {children}
            </EntityErrorBoundary>
        </div>
    );
}
