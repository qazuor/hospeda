/**
 * @file _authed/newsletter/subscribers/index.tsx
 * @description Admin subscribers list page (SPEC-101 T-101-38).
 *
 * Read-only paginated table — admins do not edit / delete subscribers
 * directly (per AC-101-07.6, that flow goes through the user-facing
 * subscribe / unsubscribe APIs and Brevo webhook events).
 *
 * Permission: NEWSLETTER_SUBSCRIBER_VIEW (RoutePermissionGuard +
 * service-side check at the API).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { useNewsletterSubscribers } from '@/hooks/newsletter';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EmailIcon } from '@repo/icons';
import {
    type NewsletterSubscriber,
    NewsletterSubscriberStatusEnum,
    PermissionEnum
} from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SubscriberFilters, type SubscriberFiltersValue } from './-components/SubscriberFilters';
import { SubscriberStatsBar } from './-components/SubscriberStatsBar';

export const Route = createFileRoute('/_authed/newsletter/subscribers/')({
    component: SubscribersListPage,
    errorComponent: createErrorComponent('NewsletterSubscribers'),
    pendingComponent: createPendingComponent()
});

const STATUS_BADGE: Readonly<Record<NewsletterSubscriberStatusEnum, string>> = {
    [NewsletterSubscriberStatusEnum.ACTIVE]: 'bg-green-100 text-green-800',
    [NewsletterSubscriberStatusEnum.PENDING_VERIFICATION]: 'bg-yellow-100 text-yellow-800',
    [NewsletterSubscriberStatusEnum.UNSUBSCRIBED]: 'bg-gray-100 text-gray-700',
    [NewsletterSubscriberStatusEnum.BOUNCED]: 'bg-red-100 text-red-800',
    [NewsletterSubscriberStatusEnum.COMPLAINED]: 'bg-red-100 text-red-800'
};

const STATUS_LABEL: Readonly<Record<NewsletterSubscriberStatusEnum, string>> = {
    [NewsletterSubscriberStatusEnum.ACTIVE]: 'Activo',
    [NewsletterSubscriberStatusEnum.PENDING_VERIFICATION]: 'Pendiente',
    [NewsletterSubscriberStatusEnum.UNSUBSCRIBED]: 'No suscripto',
    [NewsletterSubscriberStatusEnum.BOUNCED]: 'Email inválido',
    [NewsletterSubscriberStatusEnum.COMPLAINED]: 'Spam'
};

function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

const EMPTY_FILTERS: SubscriberFiltersValue = {
    subscriberStatus: '',
    locale: '',
    source: '',
    emailSearch: ''
};

function SubscribersListPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<SubscriberFiltersValue>(EMPTY_FILTERS);

    const { data, isLoading, error } = useNewsletterSubscribers({
        page,
        pageSize: 25,
        subscriberStatus: filters.subscriberStatus || undefined,
        locale: filters.locale || undefined,
        source: filters.source || undefined,
        emailSearch: filters.emailSearch || undefined
    });

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered =
        !!filters.subscriberStatus || !!filters.locale || !!filters.source || !!filters.emailSearch;

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <EmailIcon
                        className="h-6 w-6 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <h1 className="font-bold text-2xl">
                        {t('admin-newsletter.subscribers.title')}
                    </h1>
                </div>

                {/* Stats bar */}
                <SubscriberStatsBar />

                {/* Filters */}
                <SubscriberFilters
                    value={filters}
                    onChange={(next) => {
                        setFilters(next);
                        setPage(1);
                    }}
                />

                {/* Loading / error */}
                {isLoading && (
                    <p className="text-muted-foreground text-sm">Cargando suscriptores…</p>
                )}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        Error al cargar los suscriptores. Intentá de nuevo.
                    </p>
                )}

                {/* Empty state */}
                {!isLoading && !error && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                        <EmailIcon
                            className="h-10 w-10"
                            aria-hidden="true"
                        />
                        <p>
                            {isFiltered
                                ? t('admin-newsletter.subscribers.noResults')
                                : 'Todavía no hay suscriptores.'}
                        </p>
                        {isFiltered && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilters(EMPTY_FILTERS);
                                    setPage(1);
                                }}
                            >
                                Limpiar filtros
                            </Button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border">
                        <table
                            className="w-full text-sm"
                            aria-label="Tabla de suscriptores"
                        >
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Email</th>
                                    <th className="px-4 py-3 font-medium">Estado</th>
                                    <th className="px-4 py-3 font-medium">Idioma</th>
                                    <th className="px-4 py-3 font-medium">Origen</th>
                                    <th className="px-4 py-3 font-medium">Suscripto</th>
                                    <th className="px-4 py-3 font-medium">Verificado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((subscriber: NewsletterSubscriber) => (
                                    <tr
                                        key={subscriber.id}
                                        className="border-t hover:bg-muted/20"
                                    >
                                        <td className="px-4 py-3 font-medium">
                                            {subscriber.email}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_BADGE[subscriber.status]}`}
                                            >
                                                {STATUS_LABEL[subscriber.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground uppercase">
                                            {subscriber.locale}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {subscriber.source}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDate(subscriber.subscribedAt)}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDate(subscriber.verifiedAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total}{' '}
                            resultados
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </RoutePermissionGuard>
    );
}
