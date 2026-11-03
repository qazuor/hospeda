import type { TranslationKey } from '@repo/i18n';
import type { AdminListingFixRequestItem, AdminListingFixRequestListQuery } from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getPublicationStatusBadgeOptions } from '@/features/listing/config/publication-status-options';
import { useTranslations } from '@/hooks/use-translations';
import { useListingFixRequests } from '../hooks/useListingFixRequests';
import { FixRequestRowActions } from './FixRequestRowActions';
import { FixRequestsFilters } from './FixRequestsFilters';

/** Pending fix request list screen with filters, pagination and row actions. */
export function FixRequestsScreen() {
    const { t, tPlural, locale } = useTranslations();
    const [filters, setFilters] = useState<
        Pick<AdminListingFixRequestListQuery, 'vertical' | 'ownerReported' | 'overdue'>
    >({});
    const [page, setPage] = useState(1);
    const query = useListingFixRequests({ filters, page, pageSize: 50 });
    const statuses = getPublicationStatusBadgeOptions({ t: t as never });
    const routes: Readonly<
        Record<
            AdminListingFixRequestItem['vertical'],
            '/accommodations/$id' | '/venues/$id' | '/experiences/$id'
        >
    > = {
        accommodation: '/accommodations/$id',
        venue: '/venues/$id',
        experience: '/experiences/$id'
    };
    const label = (key: string, params?: Record<string, unknown>) =>
        t(`admin-entities.fixRequestList.${key}` as TranslationKey, params);
    const date = (value: string) =>
        formatCalendarDate({
            value,
            locale,
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    const updateFilters = (next: typeof filters) => {
        setFilters(next);
        setPage(1);
    };
    if (query.isPending) return <p>{label('loading')}</p>;
    if (query.isError) return <p role="alert">{label('error')}</p>;
    const { items, pagination } = query.data;
    return (
        <section>
            <p>{label('intro')}</p>
            <FixRequestsFilters
                value={filters}
                onChange={updateFilters}
            />
            {items.length === 0 ? (
                <p>{label('empty')}</p>
            ) : (
                <table data-testid="fix-requests-table">
                    <thead>
                        <tr>
                            {[
                                'listing',
                                'vertical',
                                'status',
                                'reason',
                                'openedAt',
                                'suggestedDate',
                                'ownerReported',
                                'actions'
                            ].map((key) => (
                                <th key={key}>{label(`columns.${key}`)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => {
                            const status =
                                statuses.find((option) => option.value === item.publicationStatus)
                                    ?.label ?? item.publicationStatus;
                            return (
                                <tr
                                    key={item.fixRequestId}
                                    data-testid={`fix-request-row-${item.fixRequestId}`}
                                >
                                    <td>
                                        <Link
                                            to={routes[item.vertical]}
                                            params={{ id: item.listingId }}
                                        >
                                            {item.listingName}
                                        </Link>
                                    </td>
                                    <td>
                                        {t(`admin-entities.entities.${item.vertical}.singular`)}
                                    </td>
                                    <td>{status}</td>
                                    <td>{item.reason}</td>
                                    <td>
                                        {item.ageDays === 0
                                            ? label('openedToday')
                                            : tPlural(
                                                  'admin-entities.fixRequestList.age',
                                                  item.ageDays
                                              )}
                                    </td>
                                    <td>
                                        {item.suggestedDate ? (
                                            <>
                                                {date(item.suggestedDate)}
                                                {item.overdue && <span>{label('overdue')}</span>}
                                            </>
                                        ) : (
                                            label('noSuggestedDate')
                                        )}
                                    </td>
                                    <td>
                                        {item.ownerReportedFixedAt
                                            ? label('ownerReportedAt', {
                                                  date: date(item.ownerReportedFixedAt.slice(0, 10))
                                              })
                                            : label('ownerNotReported')}
                                    </td>
                                    <td>
                                        <FixRequestRowActions item={item} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            <nav className="flex items-center gap-3">
                <button
                    type="button"
                    disabled={!pagination.hasPreviousPage}
                    onClick={() => setPage(page - 1)}
                >
                    {label('previous')}
                </button>
                <span>
                    {label('page', { page: pagination.page, totalPages: pagination.totalPages })}
                </span>
                <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage(page + 1)}
                >
                    {label('next')}
                </button>
            </nav>
        </section>
    );
}
