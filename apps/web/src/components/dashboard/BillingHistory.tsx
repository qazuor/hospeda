'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * BillingHistory Component
 * Displays chronological list of billing events with pagination
 */

type BillingEventType =
    | 'payment'
    | 'subscription_created'
    | 'subscription_updated'
    | 'subscription_canceled'
    | 'addon_purchased'
    | 'refund';

interface BillingEvent {
    id: string;
    type: BillingEventType;
    description: string;
    amountCents: number;
    currency: string;
    status: 'completed' | 'pending' | 'failed' | 'refunded';
    createdAt: string;
    metadata?: {
        planName?: string;
        addonName?: string;
        invoiceId?: string;
        receiptUrl?: string;
    };
}

interface ApiResponse {
    success: boolean;
    data: BillingEvent[];
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasMore: boolean;
    };
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Format price in ARS with thousands separator
 */
function formatPrice(priceInCents: number): string {
    const price = priceInCents / 100;
    return new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

/**
 * Format date in Spanish locale
 */
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

/**
 * Get event type label in Spanish
 */
function getEventTypeLabel(type: BillingEventType): string {
    const labels: Record<BillingEventType, string> = {
        payment: 'Pago',
        subscription_created: 'Suscripción',
        subscription_updated: 'Cambio de plan',
        subscription_canceled: 'Cancelación',
        addon_purchased: 'Complemento',
        refund: 'Reembolso'
    };
    return labels[type];
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: BillingEvent['status']) {
    switch (status) {
        case 'completed':
            return {
                className: 'bg-green-100 text-green-700',
                label: 'Completado'
            };
        case 'pending':
            return {
                className: 'bg-yellow-100 text-yellow-700',
                label: 'Pendiente'
            };
        case 'failed':
            return {
                className: 'bg-red-100 text-red-700',
                label: 'Fallido'
            };
        case 'refunded':
            return {
                className: 'bg-gray-100 text-gray-700',
                label: 'Reembolsado'
            };
    }
}

export function BillingHistory() {
    const [events, setEvents] = useState<BillingEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [filterType, setFilterType] = useState<BillingEventType | 'all'>('all');

    const fetchEvents = useCallback(
        async (page: number, type: BillingEventType | 'all', append = false) => {
            try {
                if (append) {
                    setLoadingMore(true);
                } else {
                    setLoading(true);
                    setError(null);
                }

                const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
                const typeParam = type !== 'all' ? `&type=${type}` : '';
                const response = await fetch(
                    `${apiUrl}/api/v1/billing/history?page=${page}&pageSize=10${typeParam}`,
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    }
                );

                if (!response.ok) {
                    throw new Error('Error al cargar el historial');
                }

                const data: ApiResponse = await response.json();

                if (data.success) {
                    if (append) {
                        setEvents((prev) => [...prev, ...data.data]);
                    } else {
                        setEvents(data.data);
                    }
                    setPagination(data.pagination);
                    setCurrentPage(page);
                } else {
                    throw new Error(data.error?.message || 'Error desconocido');
                }
            } catch (err) {
                console.error('Error fetching billing history:', err);
                setError(err instanceof Error ? err.message : 'Error al cargar el historial');
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        []
    );

    useEffect(() => {
        fetchEvents(1, filterType);
    }, [filterType, fetchEvents]);

    const handleLoadMore = () => {
        if (pagination?.hasMore) {
            fetchEvents(currentPage + 1, filterType, true);
        }
    };

    const handleFilterChange = (type: BillingEventType | 'all') => {
        setFilterType(type);
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Historial de facturación</h2>
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-bold text-2xl text-gray-900">Historial de facturación</h2>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <label
                        htmlFor="type-filter"
                        className="text-gray-700 text-sm"
                    >
                        Filtrar:
                    </label>
                    <select
                        id="type-filter"
                        value={filterType}
                        onChange={(e) =>
                            handleFilterChange(e.target.value as BillingEventType | 'all')
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="all">Todos</option>
                        <option value="payment">Pagos</option>
                        <option value="subscription_created">Suscripciones</option>
                        <option value="subscription_updated">Cambios de plan</option>
                        <option value="addon_purchased">Complementos</option>
                        <option value="refund">Reembolsos</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <svg
                        className="mx-auto mb-3 h-12 w-12 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {events.length === 0 && !error && (
                <div className="py-12 text-center">
                    <svg
                        className="mx-auto mb-4 h-16 w-16 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <h3 className="mb-2 font-bold text-gray-900 text-xl">Sin historial</h3>
                    <p className="text-gray-600">
                        No hay eventos de facturación
                        {filterType !== 'all' && ' para este filtro'}
                    </p>
                </div>
            )}

            {events.length > 0 && (
                <>
                    <div className="space-y-4">
                        {events.map((event) => {
                            const statusBadge = getStatusBadge(event.status);
                            const typeLabel = getEventTypeLabel(event.type);

                            return (
                                <div
                                    key={event.id}
                                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex-1">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700 text-xs">
                                                {typeLabel}
                                            </span>
                                            <span
                                                className={`rounded-full px-3 py-1 font-medium text-xs ${statusBadge.className}`}
                                            >
                                                {statusBadge.label}
                                            </span>
                                        </div>
                                        <p className="mb-1 font-medium text-gray-900">
                                            {event.description}
                                        </p>
                                        <p className="text-gray-600 text-sm">
                                            {formatDate(new Date(event.createdAt))}
                                        </p>
                                        {event.metadata?.receiptUrl && (
                                            <a
                                                href={event.metadata.receiptUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center gap-1 text-primary text-sm hover:underline"
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    aria-hidden="true"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                    />
                                                </svg>
                                                Ver comprobante
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <div className="font-bold text-gray-900 text-lg">
                                            {event.status === 'refunded' && '- '}$
                                            {formatPrice(event.amountCents)}
                                        </div>
                                        <div className="text-gray-600 text-sm">
                                            {event.currency}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Load more button */}
                    {pagination?.hasMore && (
                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-300"
                            >
                                {loadingMore ? (
                                    <span className="flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                                        Cargando...
                                    </span>
                                ) : (
                                    `Cargar más (${pagination.totalItems - events.length} restantes)`
                                )}
                            </button>
                        </div>
                    )}

                    {/* Pagination info */}
                    {pagination && (
                        <div className="mt-6 text-center text-gray-600 text-sm">
                            Mostrando {events.length} de {pagination.totalItems} eventos
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
