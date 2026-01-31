'use client';

import { DEFAULT_PROMO_CODES } from '@repo/billing';
import { type FormEvent, useState } from 'react';

/**
 * Promo code validation result
 */
export interface PromoCodeResult {
    code: string;
    discountPercent: number;
    description: string;
    discountType?: 'percentage' | 'fixed_amount';
    discountValue?: number;
}

/**
 * PromoCodeInput Component Props
 */
interface PromoCodeInputProps {
    onPromoApplied: (result: PromoCodeResult | null) => void;
    planSlug?: string;
    className?: string;
}

/**
 * PromoCodeInput Component
 * Allows users to enter and validate promo codes for discounts
 */
export function PromoCodeInput({ onPromoApplied, planSlug, className = '' }: PromoCodeInputProps) {
    const [code, setCode] = useState('');
    const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [appliedCode, setAppliedCode] = useState<PromoCodeResult | null>(null);

    const validateCode = async (codeToValidate: string): Promise<PromoCodeResult | null> => {
        const upperCode = codeToValidate.trim().toUpperCase();

        // First try local validation (instant feedback for known codes)
        const localPromoCode = DEFAULT_PROMO_CODES.find((p) => p.code === upperCode && p.isActive);

        if (localPromoCode) {
            // Check plan restriction locally
            if (
                localPromoCode.restrictedToPlans &&
                planSlug &&
                !localPromoCode.restrictedToPlans.includes(planSlug)
            ) {
                throw new Error('Este código no es válido para el plan seleccionado');
            }

            return {
                code: localPromoCode.code,
                discountPercent: localPromoCode.discountPercent,
                description: localPromoCode.description
            };
        }

        // Not found locally - try API validation
        try {
            const apiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/v1/billing/promo-codes/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    code: upperCode,
                    planSlug: planSlug || undefined
                })
            });

            if (response.ok) {
                const result = await response.json();

                if (result.data?.valid) {
                    // Convert API response to PromoCodeResult format
                    const discountPercent =
                        result.data.discountType === 'percentage' ? result.data.discountValue : 0;

                    return {
                        code: upperCode,
                        discountPercent,
                        description: result.data.description || `Código ${upperCode} aplicado`,
                        discountType: result.data.discountType,
                        discountValue: result.data.discountValue
                    };
                }

                throw new Error(result.error?.message || 'Código promocional no válido');
            }

            // If API returns error
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Código promocional no válido');
        } catch (apiError) {
            // If API is unavailable or returns error, and we didn't find it locally
            if (apiError instanceof Error && apiError.message) {
                throw apiError;
            }
            throw new Error('Código promocional inválido o expirado');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!code.trim()) {
            setErrorMessage('Ingresá un código promocional');
            setState('error');
            return;
        }

        setState('loading');
        setErrorMessage('');

        try {
            const result = await validateCode(code);

            if (result) {
                setState('success');
                setAppliedCode(result);
                onPromoApplied(result);
                setCode('');
            }
        } catch (error) {
            setState('error');
            setErrorMessage(error instanceof Error ? error.message : 'Error al validar código');
            onPromoApplied(null);
        }
    };

    const handleRemove = () => {
        setAppliedCode(null);
        setState('idle');
        setErrorMessage('');
        onPromoApplied(null);
    };

    const handleInputChange = (value: string) => {
        const upperValue = value.toUpperCase().slice(0, 30);
        setCode(upperValue);

        if (state === 'error') {
            setState('idle');
            setErrorMessage('');
        }
    };

    return (
        <div className={`w-full ${className}`}>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                {appliedCode ? (
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                                <svg
                                    className="h-5 w-5 text-green-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    role="img"
                                    aria-label="Código aplicado correctamente"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span className="font-semibold text-green-700">
                                    Código {appliedCode.code} aplicado
                                </span>
                                <span className="font-bold text-green-600">
                                    {appliedCode.discountPercent}% OFF
                                </span>
                            </div>
                            <p className="text-gray-600 text-sm">{appliedCode.description}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="ml-4 rounded-lg px-4 py-2 font-medium text-red-600 text-sm transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                            Quitar
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label
                                    htmlFor="promo-code"
                                    className="sr-only"
                                >
                                    Código promocional
                                </label>
                                <input
                                    id="promo-code"
                                    type="text"
                                    value={code}
                                    onChange={(e) => handleInputChange(e.target.value)}
                                    placeholder="Código promocional"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary"
                                    disabled={state === 'loading'}
                                    maxLength={30}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={state === 'loading' || !code.trim()}
                                className="rounded-lg bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                                {state === 'loading' ? 'Validando...' : 'Aplicar'}
                            </button>
                        </div>

                        {state === 'error' && errorMessage && (
                            <div className="mt-3 flex items-start gap-2 text-red-600">
                                <svg
                                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    role="img"
                                    aria-label="Error al validar código"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span className="text-sm">{errorMessage}</span>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
