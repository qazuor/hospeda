'use client';

import { useState } from 'react';
import { FeatureList } from './FeatureList';

/**
 * PlanCard Component
 * Displays a single pricing plan with features and CTA
 */
interface Feature {
    name: string;
    description?: string;
    included: boolean;
}

interface PlanCardProps {
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    promoCode?: string;
    period: 'monthly' | 'annual';
    features: Feature[];
    ctaText: string;
    ctaLink?: string;
    onCtaClick?: () => void;
    onCheckout?: (priceId: string) => Promise<void>;
    planSlug?: string;
    highlighted?: boolean;
    badge?: string;
    trialText?: string;
    currency?: string;
    isTrial?: boolean;
    isAuthenticated?: boolean;
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

export function PlanCard({
    name,
    description,
    price,
    originalPrice,
    promoCode,
    period,
    features,
    ctaText,
    ctaLink,
    onCtaClick,
    onCheckout,
    planSlug,
    highlighted = false,
    badge,
    trialText,
    currency = 'ARS',
    isTrial = false,
    isAuthenticated = false
}: PlanCardProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formattedPrice = formatPrice(price);
    const formattedOriginalPrice = originalPrice ? formatPrice(originalPrice) : null;
    const periodText = period === 'monthly' ? '/mes' : '/año';
    const hasDiscount = originalPrice && originalPrice !== price;

    const handleCheckout = async () => {
        if (!onCheckout || !planSlug) return;

        setIsLoading(true);
        setError(null);

        try {
            // Create price ID based on period
            const priceId = period === 'monthly' ? `${planSlug}-monthly` : `${planSlug}-annual`;
            await onCheckout(priceId);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Error al crear sesión de pago';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClick = () => {
        // If checkout handler is provided and user is authenticated, use checkout
        if (onCheckout && isAuthenticated && planSlug) {
            handleCheckout();
        } else if (onCtaClick) {
            onCtaClick();
        } else if (ctaLink) {
            window.location.href = ctaLink;
        }
    };

    // Determine button text
    const getButtonText = () => {
        if (isLoading) return 'Cargando...';
        if (price === 0) return ctaText || 'Crear cuenta gratis';
        if (isTrial) return 'Comenzar prueba gratis (14 días)';
        return ctaText;
    };

    return (
        <div
            className={`relative rounded-2xl p-8 ${
                highlighted
                    ? 'scale-105 bg-primary text-white shadow-2xl ring-2 ring-primary'
                    : 'bg-white shadow-lg hover:shadow-xl'
            } transition-all`}
        >
            {badge && (
                <div className="-top-4 -translate-x-1/2 absolute left-1/2 transform">
                    <span className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-1 font-semibold text-sm text-white shadow-lg">
                        {badge}
                    </span>
                </div>
            )}

            <div className="mb-6">
                <h3
                    className={`mb-2 font-bold text-2xl ${highlighted ? 'text-white' : 'text-gray-900'}`}
                >
                    {name}
                </h3>
                <p className={`text-sm ${highlighted ? 'text-gray-100' : 'text-gray-600'}`}>
                    {description}
                </p>
            </div>

            <div className="mb-6">
                {price === 0 ? (
                    <div
                        className={`font-bold text-4xl ${highlighted ? 'text-white' : 'text-gray-900'}`}
                    >
                        Gratis
                    </div>
                ) : (
                    <>
                        {hasDiscount && formattedOriginalPrice && (
                            <div className="mb-1 flex items-baseline gap-1">
                                <span
                                    className={`text-sm ${highlighted ? 'text-gray-300' : 'text-gray-400'}`}
                                >
                                    {currency}
                                </span>
                                <span
                                    className={`text-xl line-through ${highlighted ? 'text-gray-300' : 'text-gray-400'}`}
                                >
                                    ${formattedOriginalPrice}
                                </span>
                            </div>
                        )}
                        <div className="flex items-baseline gap-1">
                            <span
                                className={`text-lg ${highlighted ? 'text-gray-100' : 'text-gray-600'}`}
                            >
                                {currency}
                            </span>
                            <span
                                className={`font-bold text-4xl ${highlighted ? 'text-white' : 'text-gray-900'}`}
                            >
                                ${formattedPrice}
                            </span>
                            <span
                                className={`text-lg ${highlighted ? 'text-gray-100' : 'text-gray-600'}`}
                            >
                                {periodText}
                            </span>
                        </div>
                        {hasDiscount && promoCode && (
                            <p
                                className={`mt-1 font-medium text-sm ${highlighted ? 'text-green-300' : 'text-green-600'}`}
                            >
                                Con código {promoCode}
                            </p>
                        )}
                        {period === 'annual' && !hasDiscount && (
                            <p
                                className={`mt-1 text-sm ${highlighted ? 'text-gray-100' : 'text-gray-500'}`}
                            >
                                Pagás ${formatPrice(price)} por año
                            </p>
                        )}
                    </>
                )}
                {trialText && (
                    <p
                        className={`mt-2 font-medium text-sm ${highlighted ? 'text-gray-100' : 'text-green-600'}`}
                    >
                        {trialText}
                    </p>
                )}
            </div>

            <button
                type="button"
                onClick={handleClick}
                disabled={isLoading}
                className={`mb-6 w-full rounded-lg px-6 py-3 font-semibold transition-colors ${
                    highlighted
                        ? 'bg-white text-primary hover:bg-gray-100'
                        : 'bg-primary text-white hover:bg-primary/90'
                } ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
                {getButtonText()}
            </button>

            {error && (
                <div className="mb-4 rounded-md bg-red-50 p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <FeatureList
                features={features}
                className={highlighted ? '[&_span]:text-white [&_svg]:text-green-300' : ''}
            />
        </div>
    );
}
