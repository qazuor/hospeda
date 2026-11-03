import type { TranslationKey } from '@repo/i18n';
import type { AdminPartnerApplicationPanelItem, PartnerApplicationPanelView } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { usePartnerApplicationPanel } from '../hooks/usePartnerApplicationPanel';
import { PartnerApplicationRowActions } from './PartnerApplicationRowActions';

const VIEWS: readonly PartnerApplicationPanelView[] = [
    'pending',
    'approvedUnclaimed',
    'rejectedWaiting'
];

/** Renders the paginated admin views of partner applications. */
export function PartnerApplicationPanelScreen() {
    const { t, locale } = useTranslations();
    const [view, setView] = useState<PartnerApplicationPanelView>('pending');
    const [page, setPage] = useState(1);
    const query = usePartnerApplicationPanel({ view, page, pageSize: 50 });
    const canManagePartners = useHasPermission(PermissionEnum.PARTNER_MANAGE);
    const label = (key: string) =>
        t(`admin-entities.partnerApplicationPanel.${key}` as TranslationKey);
    const date = (value: string) =>
        formatCalendarDate({
            value,
            locale,
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });
    if (query.isPending) return <p>{label('loading')}</p>;
    if (query.isError) return <p role="alert">{label('error')}</p>;
    const columns =
        view === 'pending'
            ? ['email', 'received', 'status', 'actions']
            : view === 'approvedUnclaimed'
              ? ['email', 'partner', 'approved', 'claim']
              : ['email', 'rejected', 'waitEnds', 'actions'];
    const dateColumn = (item: AdminPartnerApplicationPanelItem) =>
        view === 'pending' ? date(item.createdAt) : date(item.resolvedAt ?? item.createdAt);
    return (
        <section className="space-y-4">
            <p>{label('intro')}</p>
            <div
                role="tablist"
                aria-label={label('views')}
                className="flex gap-2"
            >
                {VIEWS.map((next) => (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === next}
                        key={next}
                        onClick={() => {
                            setView(next);
                            setPage(1);
                        }}
                        className="rounded-md border px-3 py-2"
                    >
                        {label(`views.${next}`)}
                    </button>
                ))}
            </div>
            {query.data.items.length === 0 ? (
                <p>{label('empty')}</p>
            ) : (
                <table
                    data-testid="partner-application-panel-table"
                    className="w-full"
                >
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column}>{label(`columns.${column}`)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {query.data.items.map((item) => (
                            <tr
                                key={item.id}
                                data-testid={`partner-application-row-${item.id}`}
                            >
                                <td>{item.email}</td>
                                {view === 'pending' && (
                                    <>
                                        <td>
                                            {dateColumn(item)}
                                            {item.overdue && (
                                                <span
                                                    className="ml-2 rounded bg-amber-100 px-2 py-1"
                                                    data-testid={`partner-application-overdue-${item.id}`}
                                                >
                                                    {label('overdue')}
                                                </span>
                                            )}
                                        </td>
                                        <td>{label('status.pending')}</td>
                                    </>
                                )}
                                {view === 'approvedUnclaimed' && (
                                    <>
                                        <td>
                                            {item.partner && canManagePartners ? (
                                                <Link
                                                    to="/partners/$id"
                                                    params={{ id: item.partner.id }}
                                                >
                                                    {item.partner.name}
                                                </Link>
                                            ) : (
                                                item.partner?.name
                                            )}
                                        </td>
                                        <td>{dateColumn(item)}</td>
                                        <td>{label('unclaimed')}</td>
                                    </>
                                )}
                                {view === 'rejectedWaiting' && (
                                    <>
                                        <td>{dateColumn(item)}</td>
                                        <td>{item.waitEndsAt ? date(item.waitEndsAt) : '—'}</td>
                                    </>
                                )}
                                {view !== 'approvedUnclaimed' && (
                                    <td>
                                        <PartnerApplicationRowActions
                                            item={item}
                                            view={view}
                                        />
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <nav className="flex items-center gap-3">
                <button
                    type="button"
                    disabled={!query.data.pagination.hasPreviousPage}
                    onClick={() => setPage(page - 1)}
                >
                    {label('previous')}
                </button>
                <span>
                    {label('page')
                        .replace('{page}', String(query.data.pagination.page))
                        .replace('{totalPages}', String(query.data.pagination.totalPages))}
                </span>
                <button
                    type="button"
                    disabled={!query.data.pagination.hasNextPage}
                    onClick={() => setPage(page + 1)}
                >
                    {label('next')}
                </button>
            </nav>
        </section>
    );
}
