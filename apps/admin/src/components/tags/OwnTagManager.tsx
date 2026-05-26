import { Button } from '@/components/ui/button';
import { useDeleteOwnTag, useOwnTagQuota, useOwnTags } from '@/hooks/use-own-tags';
import { TagsIcon } from '@repo/icons';
import type { Tag } from '@repo/schemas';
import { useState } from 'react';
import { CreateOwnTagDialog } from './CreateOwnTagDialog';
import { OwnTagRow } from './OwnTagRow';

/** Lifecycle state filter tabs with D-022 (show all states). */
const LIFECYCLE_TABS: ReadonlyArray<{ value: string; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'INACTIVE', label: 'Inactivos' },
    { value: 'ARCHIVED', label: 'Archivados' }
] as const;

/**
 * Own-Tag Manager page component.
 *
 * Displays the authenticated user's personal USER tags with:
 * - Quota indicator: "X / N tags activos" with visual progress bar.
 * - Lifecycle tabs: ALL / ACTIVE / INACTIVE / ARCHIVED (D-022).
 * - Tag list with per-row actions (edit, delete).
 * - "+ Crear tag personal" button disabled at quota with message.
 *
 * @see AC-003-01, AC-003-02, AC-003-03, AC-003-04, D-022, US-003
 * @see SPEC-086 T-032
 */
export function OwnTagManager() {
    const [activeTab, setActiveTab] = useState('');
    const [page, setPage] = useState(1);

    const { data: quotaData } = useOwnTagQuota();
    const quotaUsed = quotaData?.used ?? 0;
    const quotaLimit = quotaData?.limit ?? 50;
    const isAtQuota = quotaUsed >= quotaLimit;
    const quotaPercent = Math.min(100, Math.round((quotaUsed / Math.max(quotaLimit, 1)) * 100));

    const { data, isLoading, error } = useOwnTags({
        page,
        pageSize: 25,
        lifecycleState: activeTab || undefined
    });

    const deleteMutation = useDeleteOwnTag();

    const items: Tag[] = data?.data?.items ?? [];
    const pagination = data?.data?.pagination;

    function handleDeleteConfirm(id: string) {
        deleteMutation.mutate(id);
    }

    return (
        <div
            className="space-y-6"
            data-testid="own-tag-manager"
        >
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TagsIcon
                        className="h-5 w-5 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <h1 className="font-bold text-xl">Mis Tags Personales</h1>
                </div>

                <CreateOwnTagDialog
                    isAtQuota={isAtQuota}
                    trigger={
                        <Button
                            type="button"
                            disabled={isAtQuota}
                            title={
                                isAtQuota ? 'Alcanzaste el límite de tags personales' : undefined
                            }
                            data-testid="create-tag-button"
                        >
                            + Crear tag personal
                        </Button>
                    }
                />
            </div>

            {/* Quota indicator */}
            <div
                className="space-y-1.5"
                data-testid="quota-indicator"
            >
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                        Tags activos usados:{' '}
                        <strong>
                            {quotaUsed} / {quotaLimit}
                        </strong>
                    </span>
                    {isAtQuota && (
                        <span
                            className="font-medium text-destructive text-xs"
                            role="alert"
                            data-testid="quota-reached-message"
                        >
                            Límite alcanzado
                        </span>
                    )}
                </div>
                <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    tabIndex={-1}
                    aria-valuenow={quotaUsed}
                    aria-valuemin={0}
                    aria-valuemax={quotaLimit}
                    aria-label="Uso de cuota de tags personales"
                >
                    <div
                        className={`h-full rounded-full transition-all ${
                            isAtQuota
                                ? 'bg-destructive'
                                : quotaPercent >= 80
                                  ? 'bg-warning'
                                  : 'bg-primary'
                        }`}
                        style={{ width: `${quotaPercent}%` }}
                        data-testid="quota-bar"
                    />
                </div>
            </div>

            {/* Lifecycle tabs */}
            <div
                className="flex gap-1 rounded-lg border bg-muted/40 p-1"
                role="tablist"
                aria-label="Filtrar por estado"
            >
                {LIFECYCLE_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.value}
                        onClick={() => {
                            setActiveTab(tab.value);
                            setPage(1);
                        }}
                        className={`flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                            activeTab === tab.value
                                ? 'bg-background shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid={`tab-${tab.value || 'all'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {isLoading && (
                <p
                    className="text-muted-foreground text-sm"
                    data-testid="loading-message"
                >
                    Cargando tags...
                </p>
            )}

            {error && (
                <p
                    className="text-destructive text-sm"
                    role="alert"
                    data-testid="error-message"
                >
                    Error al cargar los tags. Intentá de nuevo.
                </p>
            )}

            {!isLoading && !error && items.length === 0 && (
                <div
                    className="flex flex-col items-center justify-center gap-3 py-14 text-center text-muted-foreground"
                    data-testid="empty-state"
                >
                    <TagsIcon
                        className="h-9 w-9"
                        aria-hidden="true"
                    />
                    <p className="text-sm">
                        {activeTab
                            ? 'No hay tags con este estado.'
                            : 'Todavía no tenés tags personales.'}
                    </p>
                    {!activeTab && !isAtQuota && (
                        <CreateOwnTagDialog
                            trigger={
                                <Button
                                    variant="outline"
                                    type="button"
                                >
                                    Crear primer tag personal
                                </Button>
                            }
                        />
                    )}
                </div>
            )}

            {!isLoading && !error && items.length > 0 && (
                <div
                    className="overflow-x-auto rounded-lg border"
                    data-testid="tag-list"
                >
                    <table
                        className="w-full text-sm"
                        aria-label="Tabla de tags personales"
                    >
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                                <th className="px-4 py-3 text-left font-medium">Aplicado a</th>
                                <th className="px-4 py-3 text-left font-medium">Estado</th>
                                <th className="px-4 py-3 text-right font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map((tag) => (
                                <OwnTagRow
                                    key={tag.id}
                                    tag={tag}
                                    onDeleteConfirm={handleDeleteConfirm}
                                    isDeleting={
                                        deleteMutation.isPending &&
                                        deleteMutation.variables === tag.id
                                    }
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div
                    className="flex items-center justify-between text-sm"
                    aria-label="Paginación"
                >
                    <span className="text-muted-foreground">{pagination.total} tags en total</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            aria-label="Página anterior"
                        >
                            Anterior
                        </Button>
                        <span className="flex items-center px-2">
                            {page} / {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            aria-label="Página siguiente"
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
