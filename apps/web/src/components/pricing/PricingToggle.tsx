'use client';

import { useState } from 'react';

/**
 * PricingToggle Component
 * Allows users to toggle between monthly and annual pricing
 */
interface PricingToggleProps {
    /** Initial value (monthly or annual) */
    initialValue?: 'monthly' | 'annual';
    /** Callback when value changes */
    onChange: (value: 'monthly' | 'annual') => void;
    /** Text to show savings for annual plans */
    savingsText?: string;
}

export function PricingToggle({
    initialValue = 'monthly',
    onChange,
    savingsText = '¡Ahorrá 2 meses!'
}: PricingToggleProps) {
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>(initialValue);

    const handleToggle = (value: 'monthly' | 'annual') => {
        setBillingPeriod(value);
        onChange(value);
    };

    return (
        <div className="mb-8 flex items-center justify-center gap-4">
            <button
                type="button"
                onClick={() => handleToggle('monthly')}
                className={`rounded-lg px-6 py-2 font-medium transition-colors ${
                    billingPeriod === 'monthly'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                Mensual
            </button>

            <button
                type="button"
                onClick={() => handleToggle('annual')}
                className={`relative rounded-lg px-6 py-2 font-medium transition-colors ${
                    billingPeriod === 'annual'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
                Anual
                {savingsText && (
                    <span className="-top-2 -right-2 absolute whitespace-nowrap rounded-full bg-green-500 px-2 py-0.5 text-white text-xs">
                        {savingsText}
                    </span>
                )}
            </button>
        </div>
    );
}
