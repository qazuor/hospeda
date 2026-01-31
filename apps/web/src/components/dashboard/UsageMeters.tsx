'use client';

import { useEffect, useState } from 'react';

/**
 * UsageMeters Component
 * Displays usage progress bars for subscription limits
 */

interface LimitUsage {
    limitKey: string;
    limitName: string;
    limitDescription: string | null;
    maxValue: number;
    currentValue: number;
    unit: string | null;
}

interface ApiResponse {
    success: boolean;
    data: LimitUsage[];
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Get color classes based on usage percentage
 */
function getUsageColor(percentage: number) {
    if (percentage >= 100) {
        return {
            bg: 'bg-red-500',
            text: 'text-red-700',
            ring: 'ring-red-200'
        };
    }
    if (percentage >= 90) {
        return {
            bg: 'bg-orange-500',
            text: 'text-orange-700',
            ring: 'ring-orange-200'
        };
    }
    if (percentage >= 80) {
        return {
            bg: 'bg-yellow-500',
            text: 'text-yellow-700',
            ring: 'ring-yellow-200'
        };
    }
    return {
        bg: 'bg-green-500',
        text: 'text-green-700',
        ring: 'ring-green-200'
    };
}

/**
 * Format usage value with unit
 */
function formatUsage(value: number, unit: string | null): string {
    if (unit) {
        return `${value} ${unit}`;
    }
    return value.toString();
}

export function UsageMeters() {
    const [limits, setLimits] = useState<LimitUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
                const response = await fetch(`${apiUrl}/api/v1/billing/usage`, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Error al cargar el uso');
                }

                const data: ApiResponse = await response.json();

                if (data.success) {
                    // Filter out zero limits
                    const filteredLimits = data.data.filter((limit) => limit.maxValue > 0);
                    setLimits(filteredLimits);
                } else {
                    throw new Error(data.error?.message || 'Error desconocido');
                }
            } catch (err) {
                console.error('Error fetching usage:', err);
                setError(err instanceof Error ? err.message : 'Error al cargar el uso');
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, []);

    if (loading) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Uso de recursos</h2>
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Uso de recursos</h2>
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

    if (limits.length === 0) {
        return (
            <div className="rounded-xl bg-white p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">Uso de recursos</h2>
                <div className="rounded-lg bg-gradient-to-r from-green-50 to-blue-50 p-8 text-center">
                    <svg
                        className="mx-auto mb-4 h-16 w-16 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                    </svg>
                    <h3 className="mb-2 font-bold text-gray-900 text-xl">Recursos ilimitados</h3>
                    <p className="text-gray-600">
                        Tu plan incluye uso ilimitado de todos los recursos
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-white p-8 shadow-lg">
            <h2 className="mb-6 font-bold text-2xl text-gray-900">Uso de recursos</h2>

            <div className="space-y-6">
                {limits.map((limit) => {
                    const percentage = Math.min((limit.currentValue / limit.maxValue) * 100, 100);
                    const colors = getUsageColor(percentage);
                    const isApproachingLimit = percentage >= 80;
                    const isAtLimit = percentage >= 100;

                    return (
                        <div
                            key={limit.limitKey}
                            className="space-y-2"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                        {limit.limitName}
                                    </h3>
                                    {limit.limitDescription && (
                                        <p className="text-gray-600 text-sm">
                                            {limit.limitDescription}
                                        </p>
                                    )}
                                </div>
                                <div className="ml-4 text-right">
                                    <span className={`font-bold text-sm ${colors.text}`}>
                                        {formatUsage(limit.currentValue, limit.unit)} /{' '}
                                        {formatUsage(limit.maxValue, limit.unit)}
                                    </span>
                                    <p className="text-gray-500 text-xs">
                                        {percentage.toFixed(0)}% usado
                                    </p>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div
                                className="h-3 overflow-hidden rounded-full bg-gray-100"
                                aria-label={`${limit.limitName}: ${percentage.toFixed(0)}% usado`}
                            >
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            {/* Warning messages */}
                            {isAtLimit && (
                                <div
                                    className={`mt-3 rounded-lg border p-3 ${colors.ring} bg-red-50 ring-2`}
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
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
                                            <p className="font-medium text-red-800 text-sm">
                                                Límite alcanzado
                                            </p>
                                            <p className="mt-1 text-red-700 text-sm">
                                                Alcanzaste el límite de tu plan.{' '}
                                                <a
                                                    href="/precios/propietarios"
                                                    className="font-semibold underline hover:no-underline"
                                                >
                                                    Mejorá tu plan
                                                </a>{' '}
                                                para aumentar tu capacidad.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isApproachingLimit && !isAtLimit && (
                                <div
                                    className={`mt-3 rounded-lg border p-3 ${colors.ring} bg-yellow-50 ring-2`}
                                >
                                    <div className="flex items-start gap-2">
                                        <svg
                                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-yellow-800">
                                                Acercándose al límite
                                            </p>
                                            <p className="mt-1 text-sm text-yellow-700">
                                                Estás usando el {percentage.toFixed(0)}% de tu
                                                capacidad.{' '}
                                                <a
                                                    href="/precios/propietarios"
                                                    className="font-semibold underline hover:no-underline"
                                                >
                                                    Considerá mejorar tu plan
                                                </a>{' '}
                                                para evitar interrupciones.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Overall upgrade CTA if any limit is near/at capacity */}
            {limits.some((limit) => (limit.currentValue / limit.maxValue) * 100 >= 80) && (
                <div className="mt-8 rounded-lg bg-gradient-to-r from-primary/10 to-blue-500/10 p-6">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                        <div className="text-center sm:text-left">
                            <h3 className="mb-1 font-bold text-gray-900">
                                ¿Necesitás más capacidad?
                            </h3>
                            <p className="text-gray-600 text-sm">
                                Mejorá tu plan y obtené acceso a más recursos
                            </p>
                        </div>
                        <a
                            href="/precios/propietarios"
                            className="rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
                        >
                            Ver planes
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
