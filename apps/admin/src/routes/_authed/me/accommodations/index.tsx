/**
 * My Accommodations Page Route
 *
 * Displays accommodations owned by the current authenticated user.
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui-wrapped/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccommodationListQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import type { AccommodationCore } from '@/features/accommodations/schemas/accommodation-client.schema';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Building2, Eye, Pencil, Plus } from 'lucide-react';

export const Route = createFileRoute('/_authed/me/accommodations/')({
    component: MyAccommodations
});

function MyAccommodations() {
    const { t } = useTranslations();
    const { user } = useAuthContext();
    const navigate = useNavigate();

    const { data, isLoading, error } = useAccommodationListQuery(
        { ownerId: user?.id ? [user.id] : undefined, limit: 50 },
        { enabled: !!user?.id }
    );

    const accommodations = data?.accommodations ?? [];

    const goToView = (id: string) => {
        navigate({ to: '/accommodations/$id', params: { id } });
    };

    const goToEdit = (id: string) => {
        navigate({ to: '/accommodations/$id/edit', params: { id } });
    };

    return (
        <SidebarPageLayout title={t('admin-pages.titles.myAccommodations')}>
            <div className="space-y-6">
                {/* Header with create button */}
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">
                        {t('admin-entities.entities.accommodation.description')}
                    </p>
                    <Link to="/accommodations/new">
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            {t('admin-entities.list.new')}
                        </Button>
                    </Link>
                </div>

                {/* Loading state */}
                {isLoading && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {['skeleton-a', 'skeleton-b', 'skeleton-c'].map((key) => (
                            <Card key={key}>
                                <CardContent className="pt-6">
                                    <div className="animate-pulse space-y-3">
                                        <div className="h-4 w-3/4 rounded bg-muted" />
                                        <div className="h-3 w-1/2 rounded bg-muted" />
                                        <div className="h-3 w-2/3 rounded bg-muted" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-destructive">
                                {t('admin-entities.messages.error.load')}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Empty state */}
                {!isLoading && !error && accommodations.length === 0 && (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
                            <h3 className="mb-2 font-semibold text-lg">
                                {t('admin-entities.messages.empty.title')}
                            </h3>
                            <p className="mb-4 text-muted-foreground text-sm">
                                {t('admin-entities.entities.accommodation.description')}
                            </p>
                            <Link to="/accommodations/new">
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('admin-entities.list.new')}
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {/* Accommodation cards */}
                {!isLoading && accommodations.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {accommodations.map((accommodation: AccommodationCore) => {
                            const acc = accommodation as AccommodationCore &
                                Record<string, unknown>;
                            const accId = acc.id as string;
                            const accName =
                                (acc.name as string) ||
                                t('admin-entities.entities.accommodation.singular');
                            const accDescription = acc.description as string | undefined;
                            const accType = acc.type as string | undefined;
                            const accStatus = acc.lifecycleStatus as string | undefined;

                            return (
                                <Card
                                    key={accId}
                                    className="transition-shadow hover:shadow-md"
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="line-clamp-1 text-base">
                                                {accName}
                                            </CardTitle>
                                            {accStatus && (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-2 flex-shrink-0"
                                                >
                                                    {accStatus}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {accDescription && (
                                            <p className="mb-3 line-clamp-2 text-muted-foreground text-sm">
                                                {accDescription}
                                            </p>
                                        )}
                                        {accType && (
                                            <Badge
                                                variant="secondary"
                                                className="mb-3"
                                            >
                                                {accType}
                                            </Badge>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => goToView(accId)}
                                            >
                                                <Eye className="mr-1 h-3 w-3" />
                                                {t('admin-entities.actions.view')}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => goToEdit(accId)}
                                            >
                                                <Pencil className="mr-1 h-3 w-3" />
                                                {t('admin-entities.actions.edit')}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Total count */}
                {!isLoading && data && data.total > 0 && (
                    <p className="text-center text-muted-foreground text-sm">
                        {data.total} {t('admin-entities.entities.accommodation.plural')}
                    </p>
                )}
            </div>
        </SidebarPageLayout>
    );
}
