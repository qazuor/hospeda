/**
 * @file _authed/newsletter/campaigns/index.tsx
 * @description Admin campaigns list page (SPEC-101 T-101-39).
 *
 * Paginated table of every newsletter campaign with status filter.
 * Each row links to the detail page (T-101-40 /campaigns/$campaignId).
 * "Nueva campaña" CTA in the header navigates to /campaigns/new.
 *
 * Permission: NEWSLETTER_CAMPAIGN_VIEW (enforced by RoutePermissionGuard
 * + the API itself).
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { Button } from '@/components/ui/button';
import { useNewsletterCampaigns } from '@/hooks/newsletter';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { EmailIcon } from '@repo/icons';
import {
    type NewsletterCampaign,
    NewsletterCampaignStatusEnum,
    PermissionEnum
} from '@repo/schemas';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/newsletter/campaigns/')({
    component: CampaignsListPage,
    errorComponent: createErrorComponent('NewsletterCampaigns'),
    pendingComponent: createPendingComponent()
});

/** Tailwind colour classes per lifecycle status. */
const STATUS_BADGE: Readonly<Record<NewsletterCampaignStatusEnum, string>> = {
    [NewsletterCampaignStatusEnum.DRAFT]: 'bg-warning/15 text-warning',
    [NewsletterCampaignStatusEnum.SENDING]: 'bg-info/15 text-info',
    [NewsletterCampaignStatusEnum.SENT]: 'bg-success/15 text-success',
    [NewsletterCampaignStatusEnum.CANCELLED]: 'bg-gray-100 text-gray-600'
};

const STATUS_LABEL: Readonly<Record<NewsletterCampaignStatusEnum, string>> = {
    [NewsletterCampaignStatusEnum.DRAFT]: 'Borrador',
    [NewsletterCampaignStatusEnum.SENDING]: 'Enviando',
    [NewsletterCampaignStatusEnum.SENT]: 'Enviada',
    [NewsletterCampaignStatusEnum.CANCELLED]: 'Cancelada'
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

function CampaignsListPage() {
    const { t } = useTranslations();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<NewsletterCampaignStatusEnum | ''>('');

    const { data, isLoading, error } = useNewsletterCampaigns({
        page,
        pageSize: 25,
        campaignStatus: statusFilter || undefined,
        sort: 'desc'
    });

    const items = data?.items ?? [];
    const pagination = data?.pagination;
    const isFiltered = statusFilter !== '';

    return (
        <RoutePermissionGuard permissions={[PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW]}>
            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <EmailIcon
                            className="h-6 w-6 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <h1 className="font-bold text-2xl">
                            {t('admin-newsletter.campaigns.title')}
                        </h1>
                    </div>
                    <Button asChild>
                        <Link to="/newsletter/campaigns/new">
                            {t('admin-newsletter.campaigns.newCampaign')}
                        </Link>
                    </Button>
                </div>

                {/* Filter */}
                <div className="flex flex-wrap items-center gap-3">
                    <label
                        htmlFor="campaign-status-filter"
                        className="text-muted-foreground text-sm"
                    >
                        {t('admin-newsletter.subscribers.filterStatus')}:
                    </label>
                    <select
                        id="campaign-status-filter"
                        className="rounded-md border bg-background px-3 py-1.5 text-sm"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as NewsletterCampaignStatusEnum | '');
                            setPage(1);
                        }}
                    >
                        <option value="">Todos</option>
                        {Object.values(NewsletterCampaignStatusEnum).map((status) => (
                            <option
                                key={status}
                                value={status}
                            >
                                {STATUS_LABEL[status]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Loading / error */}
                {isLoading && <p className="text-muted-foreground text-sm">Cargando campañas…</p>}
                {error && (
                    <p
                        className="text-destructive text-sm"
                        role="alert"
                    >
                        Error al cargar las campañas. Intentá de nuevo.
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
                                ? 'No hay campañas que coincidan con el filtro.'
                                : 'Todavía no creaste ninguna campaña.'}
                        </p>
                        {!isFiltered && (
                            <Button asChild>
                                <Link to="/newsletter/campaigns/new">
                                    {t('admin-newsletter.campaigns.newCampaign')}
                                </Link>
                            </Button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                        <table
                            className="w-full text-sm"
                            aria-label="Tabla de campañas de newsletter"
                        >
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-newsletter.campaigns.titleField')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t('admin-newsletter.campaigns.subjectField')}
                                    </th>
                                    <th className="px-4 py-3 font-medium">Estado</th>
                                    <th className="px-4 py-3 font-medium">Audiencia</th>
                                    <th className="px-4 py-3 font-medium">Enviada</th>
                                    <th
                                        className="px-4 py-3 font-medium"
                                        aria-label="Acciones"
                                    />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((campaign: NewsletterCampaign) => (
                                    <tr
                                        key={campaign.id}
                                        className="border-t hover:bg-muted/20"
                                    >
                                        <td className="px-4 py-3 font-medium">{campaign.title}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {campaign.subject}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_BADGE[campaign.status]}`}
                                            >
                                                {STATUS_LABEL[campaign.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground uppercase">
                                            {campaign.localeFilter}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDate(campaign.sentAt as string | Date | null)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Link
                                                    to="/newsletter/campaigns/$campaignId"
                                                    params={{ campaignId: campaign.id }}
                                                >
                                                    Ver
                                                </Link>
                                            </Button>
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
