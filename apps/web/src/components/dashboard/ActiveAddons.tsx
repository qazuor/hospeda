'use client';

import { useEffect, useState } from 'react';

/**
 * ActiveAddons Component
 * Displays user's active add-ons with management options
 */

interface Addon {
    id: string;
    addonSlug: string;
    addonName: string;
    description: string | null;
    status: 'active' | 'expiring_soon' | 'expired';
    expiresAt: string | null;
    purchasedAt: string;
}

interface ApiResponse {
    success: boolean;
    data: Addon[];
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Format date in Spanish locale
 */
function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

/**
 * Get status badge styling
 */
function getStatusBadge(status: Addon['status']) {
    switch (status) {
        case 'active':
            return {
                className: 'bg-green-100 text-green-700',
                label: 'Activo'
            };
        case 'expiring_soon':
            return {
                className: 'bg-yellow-100 text-yellow-700',
                label: 'Por vencer'
            };
        case 'expired':
            return {
                className: 'bg-gray-100 text-gray-700',
                label: 'Vencido'
            };
    }
}

export function ActiveAddons() {
    const [addons, setAddons] = useState<Addon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        const fetchAddons = async () => {
            try {
                const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
                const response = await fetch(`${apiUrl}/api/v1/billing/addons/mine`, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Error al cargar los complementos');
                }

                const data: ApiResponse = await response.json();

                if (data.success) {
                    setAddons(data.data);
                } else {
                    throw new Error(data.error?.message || 'Error desconocido');
                }
            } catch (err) {
                console.error('Error fetching addons:', err);
                setError(err instanceof Error ? err.message : 'Error al cargar los complementos');
            } finally {
                setLoading(false);
            }
        };

        fetchAddons();
    }, []);

    const handleCancel = async (addonId: string) => {
        if (!confirm('¿Estás seguro que querés cancelar este complemento?')) {
            return;
        }

        setActionLoading(addonId);
        try {
            const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/v1/billing/addons/${addonId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Error al cancelar');
            }

            // Remove addon from list
            setAddons((prev) => prev.filter((addon) => addon.id !== addonId));
        } catch (err) {
            console.error('Error canceling addon:', err);
            alert(err instanceof Error ? err.message : 'Error al cancelar el complemento');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRenew = async (addonSlug: string) => {
        setActionLoading(addonSlug);
        try {
            const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/v1/billing/addons/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ addonSlug })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Error al renovar');
            }

            const data = await response.json();

            if (data.data?.checkoutUrl) {
                window.location.href = data.data.checkoutUrl;
            } else {
                throw new Error('No se recibió URL de checkout');
            }
        } catch (err) {
            console.error('Error renewing addon:', err);
            alert(err instanceof Error ? err.message : 'Error al renovar el complemento');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Complementos activos</h2>
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Complementos activos</h2>
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
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
            </div>
        );
    }

    if (addons.length === 0) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Complementos activos</h2>
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
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                    </svg>
                    <h3 className="mb-2 font-bold text-gray-900 text-xl">
                        No tenés complementos activos
                    </h3>
                    <p className="mb-6 text-gray-600">Agregá complementos para potenciar tu plan</p>
                    <a
                        href="/precios/complementos"
                        className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        Ver complementos disponibles
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Complementos activos</h2>

            <div className="grid gap-6 md:grid-cols-2">
                {addons.map((addon) => {
                    const statusBadge = getStatusBadge(addon.status);
                    const isExpired = addon.status === 'expired';
                    const isLoading =
                        actionLoading === addon.id || actionLoading === addon.addonSlug;

                    return (
                        <div
                            key={addon.id}
                            className="rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-md"
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <div>
                                    <h3 className="mb-1 font-bold text-gray-900 text-lg">
                                        {addon.addonName}
                                    </h3>
                                    <span
                                        className={`inline-block rounded-full px-3 py-1 font-medium text-sm ${statusBadge.className}`}
                                    >
                                        {statusBadge.label}
                                    </span>
                                </div>
                            </div>

                            {addon.description && (
                                <p className="mb-4 text-gray-600 text-sm">{addon.description}</p>
                            )}

                            <div className="mb-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Comprado el:</span>
                                    <span className="font-medium text-gray-900">
                                        {formatDate(new Date(addon.purchasedAt))}
                                    </span>
                                </div>
                                {addon.expiresAt && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">
                                            {isExpired ? 'Venció el:' : 'Vence el:'}
                                        </span>
                                        <span
                                            className={`font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}
                                        >
                                            {formatDate(new Date(addon.expiresAt))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {isExpired ? (
                                    <button
                                        type="button"
                                        onClick={() => handleRenew(addon.addonSlug)}
                                        disabled={isLoading}
                                        className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                                    >
                                        {isLoading ? 'Procesando...' : 'Renovar'}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleRenew(addon.addonSlug)}
                                            disabled={isLoading}
                                            className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                                        >
                                            {isLoading ? 'Procesando...' : 'Renovar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCancel(addon.id)}
                                            disabled={isLoading}
                                            className="flex-1 rounded-lg border-2 border-red-500 px-4 py-2 font-semibold text-red-500 text-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-300"
                                        >
                                            {isLoading ? 'Cancelando...' : 'Cancelar'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
