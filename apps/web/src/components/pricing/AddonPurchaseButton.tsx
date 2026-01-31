'use client';

import { useState } from 'react';

/**
 * AddonPurchaseButton Props
 */
interface AddonPurchaseButtonProps {
    addonSlug: string;
    price: number;
}

/**
 * AddonPurchaseButton Component
 * Handles addon purchase flow by initiating Mercado Pago checkout
 */
export function AddonPurchaseButton({ addonSlug, price }: AddonPurchaseButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async () => {
        setLoading(true);
        setError(null);

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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Error al procesar la compra');
            }

            if (data.data?.checkoutUrl) {
                // Redirect to Mercado Pago checkout
                window.location.href = data.data.checkoutUrl;
            } else {
                throw new Error('No se recibió URL de checkout');
            }
        } catch (err) {
            console.error('Purchase failed:', err);
            setError(err instanceof Error ? err.message : 'Error al procesar la compra');
            setLoading(false);
        }
    };

    const formatPrice = (priceInCents: number): string => {
        const priceValue = priceInCents / 100;
        return new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(priceValue);
    };

    return (
        <div>
            <button
                type="button"
                onClick={handlePurchase}
                disabled={loading}
                className="block w-full rounded-lg bg-primary px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
                {loading ? 'Procesando...' : `Comprar - $${formatPrice(price)}`}
            </button>

            {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}
        </div>
    );
}
