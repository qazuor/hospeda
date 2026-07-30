import { PermissionEnum } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
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
import type { Event } from '@/features/events/schemas/events.schemas';
import type { Post } from '@/features/posts/schemas/posts.schemas';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';

interface UserPublicationsCardProps {
    readonly userId: string;
    readonly permissions: readonly PermissionEnum[];
}

interface AdminListResult<T> {
    readonly items: T[];
    readonly total: number;
}

function buildSearchParams(filters: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                searchParams.append(key, String(item));
            }
            continue;
        }

        searchParams.append(key, String(value));
    }

    return searchParams.toString();
}

async function fetchAdminList<T>(
    path: string,
    filters: Record<string, unknown>
): Promise<AdminListResult<T>> {
    const searchParams = buildSearchParams(filters);
    const response = await fetchApi({ path: `${path}?${searchParams}` });
    const standardResponse = response.data as {
        success: boolean;
        data: {
            items: T[];
            pagination: {
                total: number;
            };
        };
    };

    return {
        items: standardResponse.data.items,
        total: standardResponse.data.pagination.total
    };
}

function SectionSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
                <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
                    key={index}
                    className="h-20 animate-pulse rounded-md bg-muted"
                />
            ))}
        </div>
    );
}

function SectionTitle({ children }: { readonly children: string }) {
    return (
        <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            {children}
        </h3>
    );
}

export function UserPublicationsCard({ userId, permissions }: UserPublicationsCardProps) {
    const { t, tPlural } = useTranslations();

    const canViewPosts = permissions.includes(PermissionEnum.POST_VIEW_ALL);
    const canEditPosts = permissions.includes(PermissionEnum.POST_UPDATE);
    const canViewEvents = permissions.includes(PermissionEnum.EVENT_VIEW_ALL);
    const canEditEvents = permissions.includes(PermissionEnum.EVENT_UPDATE);

    const postsQuery = useQuery({
        queryKey: ['user-publications', 'posts', userId],
        queryFn: () =>
            fetchAdminList<Post>('/api/v1/admin/posts', {
                authorId: userId,
                pageSize: 100,
                sort: 'createdAt:desc'
            }),
        enabled: canViewPosts,
        staleTime: 30_000
    });

    const eventsQuery = useQuery({
        queryKey: ['user-publications', 'events', userId],
        queryFn: () =>
            fetchAdminList<Event>('/api/v1/admin/events', {
                authorId: userId,
                pageSize: 100,
                sort: 'createdAt:desc'
            }),
        enabled: canViewEvents,
        staleTime: 30_000
    });

    if (!canViewPosts && !canViewEvents) {
        return null;
    }

    const posts = postsQuery.data?.items ?? [];
    const events = eventsQuery.data?.items ?? [];
    const totalPublications = (postsQuery.data?.total ?? 0) + (eventsQuery.data?.total ?? 0);

    const showGlobalEmpty =
        !postsQuery.isLoading &&
        !eventsQuery.isLoading &&
        !postsQuery.isError &&
        !eventsQuery.isError &&
        posts.length === 0 &&
        events.length === 0;

    return (
        <Card>
            <CardHeader divider>
                <CardTitle>{t('admin-pages.access.users.publications.title')}</CardTitle>
                <CardDescription>
                    {tPlural(
                        'admin-pages.access.users.publications.totalCount',
                        totalPublications,
                        {
                            count: totalPublications
                        }
                    )}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {showGlobalEmpty ? (
                    <EmptyState message={t('admin-pages.access.users.publications.empty')} />
                ) : null}

                {canViewEvents && !showGlobalEmpty ? (
                    <div className="space-y-3">
                        <SectionTitle>
                            {tPlural(
                                'admin-pages.access.users.publications.eventsCount',
                                eventsQuery.data?.total ?? 0,
                                {
                                    count: eventsQuery.data?.total ?? 0
                                }
                            )}
                        </SectionTitle>

                        {eventsQuery.isLoading ? <SectionSkeleton /> : null}

                        {eventsQuery.isError ? (
                            <EmptyState
                                message={t('admin-pages.access.users.publications.eventsError')}
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={() => void eventsQuery.refetch()}
                                    >
                                        {t('admin-common.actions.tryAgain')}
                                    </Button>
                                }
                            />
                        ) : null}

                        {!eventsQuery.isLoading && !eventsQuery.isError && events.length > 0 ? (
                            <div className="divide-y rounded-md border">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    to="/events/$id"
                                                    params={{ id: event.id }}
                                                    className="truncate font-medium text-primary hover:underline"
                                                >
                                                    {event.name || event.id}
                                                </Link>
                                                {event.visibility ? (
                                                    <BadgeCell
                                                        value={event.visibility}
                                                        options={getVisibilityBadgeOptions(t)}
                                                    />
                                                ) : null}
                                                {event.lifecycleState ? (
                                                    <BadgeCell
                                                        value={event.lifecycleState}
                                                        options={getLifecycleStateBadgeOptions(t)}
                                                    />
                                                ) : null}
                                            </div>

                                            <p className="truncate text-muted-foreground text-sm">
                                                {event.organizerName ||
                                                    event.locationName ||
                                                    t('admin-common.entityPage.notAvailable')}
                                            </p>
                                        </div>

                                        <div className="flex flex-shrink-0 items-center gap-2">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link
                                                    to="/events/$id"
                                                    params={{ id: event.id }}
                                                >
                                                    {t('admin-common.entityPage.actions.view')}
                                                </Link>
                                            </Button>

                                            {canEditEvents ? (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                >
                                                    <Link
                                                        to="/events/$id/edit"
                                                        params={{ id: event.id }}
                                                    >
                                                        {t('admin-common.entityPage.actions.edit')}
                                                    </Link>
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {canViewPosts && !showGlobalEmpty ? (
                    <div className="space-y-3">
                        <SectionTitle>
                            {tPlural(
                                'admin-pages.access.users.publications.postsCount',
                                postsQuery.data?.total ?? 0,
                                {
                                    count: postsQuery.data?.total ?? 0
                                }
                            )}
                        </SectionTitle>

                        {postsQuery.isLoading ? <SectionSkeleton /> : null}

                        {postsQuery.isError ? (
                            <EmptyState
                                message={t('admin-pages.access.users.publications.postsError')}
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={() => void postsQuery.refetch()}
                                    >
                                        {t('admin-common.actions.tryAgain')}
                                    </Button>
                                }
                            />
                        ) : null}

                        {!postsQuery.isLoading && !postsQuery.isError && posts.length > 0 ? (
                            <div className="divide-y rounded-md border">
                                {posts.map((post) => (
                                    <div
                                        key={post.id}
                                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Link
                                                    to="/posts/$id"
                                                    params={{ id: post.id }}
                                                    className="truncate font-medium text-primary hover:underline"
                                                >
                                                    {post.title || post.id}
                                                </Link>
                                                {post.visibility ? (
                                                    <BadgeCell
                                                        value={post.visibility}
                                                        options={getVisibilityBadgeOptions(t)}
                                                    />
                                                ) : null}
                                                {post.lifecycleState ? (
                                                    <BadgeCell
                                                        value={post.lifecycleState}
                                                        options={getLifecycleStateBadgeOptions(t)}
                                                    />
                                                ) : null}
                                            </div>

                                            <p className="truncate text-muted-foreground text-sm">
                                                {post.summary ||
                                                    post.authorName ||
                                                    t('admin-common.entityPage.notAvailable')}
                                            </p>
                                        </div>

                                        <div className="flex flex-shrink-0 items-center gap-2">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Link
                                                    to="/posts/$id"
                                                    params={{ id: post.id }}
                                                >
                                                    {t('admin-common.entityPage.actions.view')}
                                                </Link>
                                            </Button>

                                            {canEditPosts ? (
                                                <Button
                                                    asChild
                                                    size="sm"
                                                >
                                                    <Link
                                                        to="/posts/$id/edit"
                                                        params={{ id: post.id }}
                                                    >
                                                        {t('admin-common.entityPage.actions.edit')}
                                                    </Link>
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
