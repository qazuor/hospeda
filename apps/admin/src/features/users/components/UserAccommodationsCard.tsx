import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import {
    getLifecycleStateBadgeOptions,
    getVisibilityBadgeOptions
} from '@/components/entity-list/columns.factory.types';
import { EmptyState } from '@/components/feedback/EmptyState';
import { BadgeCell } from '@/components/table/cells/BadgeCell';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui-wrapped/Card';
import { useAccommodationListQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import type { Accommodation } from '@/features/accommodations/schemas/accommodations.schemas';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';

interface UserAccommodationsCardProps {
    readonly userId: string;
}

export function UserAccommodationsCard({ userId }: UserAccommodationsCardProps) {
    const { t, tPlural } = useTranslations();
    const permissions = useUserPermissions();
    const { user } = useAuthContext();

    const canViewAccommodations =
        permissions.includes(PermissionEnum.ACCOMMODATION_VIEW_ALL) ||
        (permissions.includes(PermissionEnum.ACCOMMODATION_VIEW_OWN) && user?.id === userId);

    const canEditAccommodations =
        permissions.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY) ||
        (permissions.includes(PermissionEnum.ACCOMMODATION_UPDATE_OWN) && user?.id === userId);

    const accommodationsQuery = useAccommodationListQuery(
        {
            ownerId: userId,
            pageSize: 100,
            sort: 'name:asc'
        },
        { enabled: canViewAccommodations }
    );

    if (!canViewAccommodations) {
        return null;
    }

    const accommodations = (accommodationsQuery.data?.accommodations ?? []) as Accommodation[];
    const total = accommodationsQuery.data?.total ?? 0;

    return (
        <Card>
            <CardHeader divider>
                <CardTitle>{t('admin-pages.access.users.accommodations.title')}</CardTitle>
                <CardDescription>
                    {tPlural('admin-pages.access.users.accommodations.count', total, {
                        count: total
                    })}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {accommodationsQuery.isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
                                key={index}
                                className="h-20 animate-pulse rounded-md bg-muted"
                            />
                        ))}
                    </div>
                ) : accommodationsQuery.isError ? (
                    <EmptyState
                        message={t('admin-pages.access.users.accommodations.error')}
                        action={
                            <Button
                                variant="outline"
                                onClick={() => void accommodationsQuery.refetch()}
                            >
                                {t('admin-common.actions.tryAgain')}
                            </Button>
                        }
                    />
                ) : accommodations.length === 0 ? (
                    <EmptyState message={t('admin-pages.access.users.accommodations.empty')} />
                ) : (
                    <div className="divide-y rounded-md border">
                        {accommodations.map((accommodation) => {
                            const destinationName = accommodation.cityDestination?.name;
                            const subtitle = destinationName || accommodation.slug;

                            return (
                                <div
                                    key={accommodation.id}
                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                                to="/accommodations/$id"
                                                params={{ id: accommodation.id }}
                                                className="truncate font-medium text-primary hover:underline"
                                            >
                                                {accommodation.name ||
                                                    accommodation.slug ||
                                                    accommodation.id}
                                            </Link>
                                            {accommodation.visibility ? (
                                                <BadgeCell
                                                    value={accommodation.visibility}
                                                    options={getVisibilityBadgeOptions(t)}
                                                />
                                            ) : null}
                                            {accommodation.lifecycleState ? (
                                                <BadgeCell
                                                    value={accommodation.lifecycleState}
                                                    options={getLifecycleStateBadgeOptions(t)}
                                                />
                                            ) : null}
                                        </div>

                                        <p className="truncate text-muted-foreground text-sm">
                                            {subtitle || t('admin-common.entityPage.notAvailable')}
                                        </p>
                                    </div>

                                    <div className="flex flex-shrink-0 items-center gap-2">
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                        >
                                            <Link
                                                to="/accommodations/$id"
                                                params={{ id: accommodation.id }}
                                            >
                                                {t('admin-common.entityPage.actions.view')}
                                            </Link>
                                        </Button>

                                        {canEditAccommodations ? (
                                            <Button
                                                asChild
                                                size="sm"
                                            >
                                                <Link
                                                    to="/accommodations/$id/edit"
                                                    params={{ id: accommodation.id }}
                                                >
                                                    {t('admin-common.entityPage.actions.edit')}
                                                </Link>
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
