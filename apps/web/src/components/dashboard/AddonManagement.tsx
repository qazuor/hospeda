'use client';

import { ALL_ADDONS } from '@repo/billing';
import type { AddonDefinition } from '@repo/billing';
import { useCallback, useEffect, useState } from 'react';

/**
 * AddonManagement Component
 * Comprehensive add-on management with filters and actions
 * Displays active, expired, and cancelled add-ons
 * Includes detail view, cancel/renew actions, and purchase section
 */

type AddonStatus = 'active' | 'expiring_soon' | 'expired' | 'cancelled';

interface Addon {
    id: string;
    addonSlug: string;
    addonName: string;
    description: string | null;
    status: AddonStatus;
    expiresAt: string | null;
    purchasedAt: string;
    cancelledAt: string | null;
    priceArs: number;
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
 * Get status badge styling
 */
function getStatusBadge(status: AddonStatus) {
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
        case 'cancelled':
            return {
                className: 'bg-red-100 text-red-700',
                label: 'Cancelado'
            };
    }
}

export function AddonManagement() {
    const [addons, setAddons] = useState<Addon[]>([]);
    const [filteredAddons, setFilteredAddons] = useState<Addon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<AddonStatus | 'all'>('all');
    const [expandedAddonId, setExpandedAddonId] = useState<string | null>(null);
    const [cancelDialogAddon, setCancelDialogAddon] = useState<Addon | null>(null);

    const fetchAddons = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/v1/billing/addons/mine?includeAll=true`, {
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
                setFilteredAddons(data.data);
            } else {
                throw new Error(data.error?.message || 'Error desconocido');
            }
        } catch (err) {
            console.error('Error fetching addons:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar los complementos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddons();
    }, [fetchAddons]);

    useEffect(() => {
        if (filterStatus === 'all') {
            setFilteredAddons(addons);
        } else {
            setFilteredAddons(addons.filter((addon) => addon.status === filterStatus));
        }
    }, [filterStatus, addons]);

    const handleCancelClick = (addon: Addon) => {
        setCancelDialogAddon(addon);
    };

    const handleCancelConfirm = async () => {
        if (!cancelDialogAddon) return;

        const addonId = cancelDialogAddon.id;
        setCancelDialogAddon(null);
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

            // Refresh addons list
            await fetchAddons();
        } catch (err) {
            console.error('Error canceling addon:', err);
            alert(err instanceof Error ? err.message : 'Error al cancelar el complemento');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelDialogClose = () => {
        setCancelDialogAddon(null);
    };

    const handlePurchase = async (addonSlug: string) => {
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
                throw new Error(data.error?.message || 'Error al procesar la compra');
            }

            const data = await response.json();

            if (data.data?.checkoutUrl) {
                window.location.href = data.data.checkoutUrl;
            } else {
                throw new Error('No se recibió URL de checkout');
            }
        } catch (err) {
            console.error('Error purchasing addon:', err);
            alert(err instanceof Error ? err.message : 'Error al procesar la compra');
        } finally {
            setActionLoading(null);
        }
    };

    const toggleAddonExpansion = (addonId: string) => {
        setExpandedAddonId(expandedAddonId === addonId ? null : addonId);
    };

    const getAvailableAddons = (): AddonDefinition[] => {
        return ALL_ADDONS.filter((addon) => addon.isActive);
    };

    // Count by status
    const statusCounts = {
        all: addons.length,
        active: addons.filter((a) => a.status === 'active').length,
        expiring_soon: addons.filter((a) => a.status === 'expiring_soon').length,
        expired: addons.filter((a) => a.status === 'expired').length,
        cancelled: addons.filter((a) => a.status === 'cancelled').length
    };

    if (loading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Mis complementos</h2>
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Mis complementos</h2>
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
                    <button
                        type="button"
                        onClick={() => fetchAddons()}
                        className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const availableAddons = getAvailableAddons();

    return (
        <>
            {/* Cancel Confirmation Dialog */}
            {cancelDialogAddon && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4">
                            <h3 className="mb-2 font-bold text-gray-900 text-xl">
                                Confirmar cancelación
                            </h3>
                            <p className="text-gray-600">
                                ¿Estás seguro que querés cancelar{' '}
                                <strong>{cancelDialogAddon.addonName}</strong>?
                            </p>
                        </div>

                        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                            <div className="flex gap-3">
                                <svg
                                    className="h-6 w-6 flex-shrink-0 text-yellow-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-medium text-sm text-yellow-800">
                                        Importante
                                    </p>
                                    <p className="mt-1 text-sm text-yellow-700">
                                        {cancelDialogAddon.status === 'active' ||
                                        cancelDialogAddon.status === 'expiring_soon'
                                            ? 'Al cancelar, perderás el acceso a este complemento inmediatamente y no se emitirán reembolsos.'
                                            : 'Esta acción no se puede deshacer.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleCancelDialogClose}
                                className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                            >
                                No, mantener
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelConfirm}
                                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700"
                            >
                                Sí, cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="space-y-8">
                {/* My Add-ons Section */}
                <div className="rounded-xl bg-white p-8 shadow-lg">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="font-bold text-2xl text-gray-900">Mis complementos</h2>

                        {/* Filter Tabs */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setFilterStatus('all')}
                                className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === 'all'
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Todos ({statusCounts.all})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('active')}
                                className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === 'active'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Activos ({statusCounts.active})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('expiring_soon')}
                                className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === 'expiring_soon'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Por vencer ({statusCounts.expiring_soon})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('expired')}
                                className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === 'expired'
                                        ? 'bg-gray-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Vencidos ({statusCounts.expired})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('cancelled')}
                                className={`rounded-lg px-4 py-2 font-medium text-sm transition-colors ${
                                    filterStatus === 'cancelled'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Cancelados ({statusCounts.cancelled})
                            </button>
                        </div>
                    </div>

                    {filteredAddons.length === 0 ? (
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
                                {filterStatus === 'all'
                                    ? 'No tenés complementos'
                                    : `No hay complementos ${getStatusBadge(filterStatus).label.toLowerCase()}`}
                            </h3>
                            <p className="mb-6 text-gray-600">
                                Agregá complementos para potenciar tu plan
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredAddons.map((addon) => {
                                const statusBadge = getStatusBadge(addon.status);
                                const isExpired = addon.status === 'expired';
                                const isCancelled = addon.status === 'cancelled';
                                const isLoading =
                                    actionLoading === addon.id || actionLoading === addon.addonSlug;
                                const isExpanded = expandedAddonId === addon.id;

                                return (
                                    <div
                                        key={addon.id}
                                        className="rounded-lg border border-gray-200 transition-shadow hover:shadow-md"
                                    >
                                        {/* Card Header - Always Visible */}
                                        <div className="p-6">
                                            <div className="mb-4 flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h3 className="mb-2 font-bold text-gray-900 text-lg">
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
                                                <p className="mb-4 text-gray-600 text-sm">
                                                    {addon.description}
                                                </p>
                                            )}

                                            {/* Summary Info */}
                                            <div className="mb-4 space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Precio:</span>
                                                    <span className="font-medium text-gray-900">
                                                        ${formatPrice(addon.priceArs)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">
                                                        Comprado el:
                                                    </span>
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

                                            {/* Toggle Details Button */}
                                            <button
                                                type="button"
                                                onClick={() => toggleAddonExpansion(addon.id)}
                                                className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-100"
                                            >
                                                {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                                                <svg
                                                    role="img"
                                                    aria-hidden="true"
                                                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 9l-7 7-7-7"
                                                    />
                                                </svg>
                                            </button>

                                            {/* Expandable Details */}
                                            {isExpanded && (
                                                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                                    <h4 className="mb-3 font-semibold text-gray-900 text-sm">
                                                        Información detallada
                                                    </h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between border-gray-200 border-b pb-2">
                                                            <span className="text-gray-600">
                                                                ID de transacción:
                                                            </span>
                                                            <span className="font-mono text-gray-900 text-xs">
                                                                {addon.id}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between border-gray-200 border-b pb-2">
                                                            <span className="text-gray-600">
                                                                Slug del complemento:
                                                            </span>
                                                            <span className="font-mono text-gray-900 text-xs">
                                                                {addon.addonSlug}
                                                            </span>
                                                        </div>
                                                        {addon.cancelledAt && (
                                                            <div className="flex justify-between border-gray-200 border-b pb-2">
                                                                <span className="text-gray-600">
                                                                    Cancelado el:
                                                                </span>
                                                                <span className="font-medium text-red-600">
                                                                    {formatDate(
                                                                        new Date(addon.cancelledAt)
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="pt-2">
                                                            <p className="mb-1 font-medium text-gray-700 text-xs">
                                                                Estado actual:
                                                            </p>
                                                            <p className="text-gray-600 text-xs">
                                                                {addon.status === 'active' &&
                                                                    'El complemento está activo y funcional.'}
                                                                {addon.status === 'expiring_soon' &&
                                                                    'El complemento vencerá pronto. Considerá renovarlo.'}
                                                                {addon.status === 'expired' &&
                                                                    'El complemento ha vencido. Podés recomprarlo.'}
                                                                {addon.status === 'cancelled' &&
                                                                    'El complemento fue cancelado. Podés recomprarlo si lo necesitás.'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                {isExpired || isCancelled ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePurchase(addon.addonSlug)
                                                        }
                                                        disabled={isLoading}
                                                        className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                    >
                                                        {isLoading ? 'Procesando...' : 'Recomprar'}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handlePurchase(addon.addonSlug)
                                                            }
                                                            disabled={isLoading}
                                                            className="flex-1 rounded-lg bg-primary px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                                                        >
                                                            {isLoading
                                                                ? 'Procesando...'
                                                                : 'Renovar'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancelClick(addon)}
                                                            disabled={isLoading}
                                                            className="flex-1 rounded-lg border-2 border-red-500 px-4 py-2 font-semibold text-red-500 text-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-300"
                                                        >
                                                            {isLoading
                                                                ? 'Cancelando...'
                                                                : 'Cancelar'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Purchase New Add-ons Section */}
                <div className="rounded-xl bg-white p-8 shadow-lg">
                    <div className="mb-6">
                        <h2 className="mb-2 font-bold text-2xl text-gray-900">
                            Complementos disponibles
                        </h2>
                        <p className="text-gray-600">
                            Potenciá tu plan con funcionalidades adicionales
                        </p>
                    </div>

                    {availableAddons.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-gray-600">
                                No hay complementos disponibles en este momento.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {availableAddons.map((addon) => {
                                const isLoading = actionLoading === addon.slug;
                                const isRecurring = addon.billingType === 'recurring';

                                return (
                                    <div
                                        key={addon.slug}
                                        className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 transition-shadow hover:shadow-md"
                                    >
                                        {/* Add-on Header */}
                                        <div className="mb-4">
                                            <h3 className="mb-2 font-bold text-gray-900 text-lg">
                                                {addon.name}
                                            </h3>
                                            <p className="mb-3 text-gray-600 text-sm">
                                                {addon.description}
                                            </p>

                                            {/* Badges */}
                                            <div className="mb-3 flex flex-wrap gap-2">
                                                <span
                                                    className={`rounded-full px-3 py-1 font-medium text-xs ${
                                                        isRecurring
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-orange-100 text-orange-700'
                                                    }`}
                                                >
                                                    {isRecurring ? 'Mensual' : 'Pago único'}
                                                </span>
                                                {addon.durationDays && (
                                                    <span className="rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-700 text-xs">
                                                        {addon.durationDays} días
                                                    </span>
                                                )}
                                            </div>

                                            {/* Benefits */}
                                            {(addon.limitIncrease || addon.grantsEntitlement) && (
                                                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
                                                    <p className="font-medium text-green-900 text-xs">
                                                        Beneficios:
                                                    </p>
                                                    <ul className="mt-1 space-y-1 text-green-800 text-xs">
                                                        {addon.limitIncrease &&
                                                            addon.affectsLimitKey && (
                                                                <li className="flex items-start gap-2">
                                                                    <svg
                                                                        role="img"
                                                                        aria-hidden="true"
                                                                        className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        viewBox="0 0 24 24"
                                                                    >
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            strokeWidth={2}
                                                                            d="M5 13l4 4L19 7"
                                                                        />
                                                                    </svg>
                                                                    <span>
                                                                        +{addon.limitIncrease}{' '}
                                                                        {addon.affectsLimitKey ===
                                                                            'max_photos_per_accommodation' &&
                                                                            'fotos por alojamiento'}
                                                                        {addon.affectsLimitKey ===
                                                                            'max_accommodations' &&
                                                                            'alojamientos'}
                                                                        {addon.affectsLimitKey ===
                                                                            'max_properties' &&
                                                                            'propiedades'}
                                                                    </span>
                                                                </li>
                                                            )}
                                                        {addon.grantsEntitlement && (
                                                            <li className="flex items-start gap-2">
                                                                <svg
                                                                    role="img"
                                                                    aria-hidden="true"
                                                                    className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeWidth={2}
                                                                        d="M5 13l4 4L19 7"
                                                                    />
                                                                </svg>
                                                                <span>Destacado en búsquedas</span>
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Price and CTA */}
                                        <div className="mt-auto">
                                            <div className="mb-4">
                                                <span className="font-bold text-3xl text-gray-900">
                                                    ${formatPrice(addon.priceArs)}
                                                </span>
                                                {isRecurring && (
                                                    <span className="text-gray-600 text-sm">
                                                        {' '}
                                                        /mes
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlePurchase(addon.slug)}
                                                disabled={isLoading}
                                                className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                                            >
                                                {isLoading ? 'Procesando...' : 'Comprar ahora'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
