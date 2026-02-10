/**
 * BillingIsland Component
 *
 * React island component that wraps children with QZPayProvider for client-side
 * billing operations. Uses an HTTP storage adapter to communicate with the
 * Hospeda API.
 *
 * This component is designed for Astro's islands architecture and accepts only
 * serializable props (primitives) to ensure proper hydration.
 *
 * @module components/billing/BillingIsland
 */

'use client';

import { type QZPayCustomer, createQZPayBilling } from '@qazuor/qzpay-core';
import { QZPayProvider, QZPayThemeProvider } from '@qazuor/qzpay-react';
import { useTranslations } from '@repo/i18n';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { createHttpBillingAdapter } from '../../lib/billing-http-adapter';
import { hospedaQzpayTheme } from '../../lib/qzpay-theme';

/**
 * BillingIsland component props
 *
 * All props must be serializable (primitives only) for Astro island hydration
 */
export interface BillingIslandProps {
    /**
     * Base API URL for billing endpoints
     * @example '/api/v1' or 'http://localhost:3001/api/v1'
     */
    apiUrl: string;

    /**
     * Customer ID to initialize the billing context
     * If not provided, the island operates in anonymous mode
     */
    customerId?: string;

    /**
     * Whether the billing system is in live mode (production)
     * @default false
     */
    livemode?: boolean;

    /**
     * Child components to render within the billing context
     */
    children: ReactNode;

    /**
     * Optional function to get authentication token
     * This is a function that returns a promise resolving to a token string
     * If not provided, requests will be made without authentication
     */
    getAuthToken?: () => Promise<string | null>;
}

/**
 * BillingIsland Component
 *
 * Provides QZPay billing context to child components in an Astro island.
 * Creates a fetch-based storage adapter that communicates with the Hospeda API.
 * Includes theme integration via QZPayThemeProvider and SSR-safe loading skeleton.
 *
 * @param props - Component props
 * @returns React element wrapped with QZPayProvider and QZPayThemeProvider
 *
 * @example
 * ```astro
 * ---
 * import { BillingIsland } from '@/components/billing';
 * import { SubscriptionPlans } from '@/components/billing/SubscriptionPlans';
 * import { getAuth } from '@clerk/astro/server';
 *
 * const { userId } = getAuth(Astro);
 * ---
 *
 * <BillingIsland
 *   client:load
 *   apiUrl="/api/v1"
 *   customerId={userId}
 *   livemode={import.meta.env.PROD}
 * >
 *   <SubscriptionPlans />
 * </BillingIsland>
 * ```
 *
 * @example
 * ```astro
 * <!-- Anonymous mode (no customer ID) -->
 * <BillingIsland
 *   client:idle
 *   apiUrl={import.meta.env.PUBLIC_API_URL}
 * >
 *   <PlanComparison />
 * </BillingIsland>
 * ```
 */
export function BillingIsland({
    apiUrl,
    customerId,
    livemode = false,
    children,
    getAuthToken
}: BillingIslandProps) {
    const { t } = useTranslations();

    // SSR-safe hydration detection
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Create billing instance (memoized to avoid recreation on re-renders)
    const billing = useMemo(() => {
        // Create HTTP storage adapter
        const storage = createHttpBillingAdapter({
            apiUrl,
            getAuthToken
        });

        // Create QZPay billing instance
        return createQZPayBilling({
            storage,
            livemode
        });
    }, [apiUrl, livemode, getAuthToken]);

    // Convert customerId string to customer object for QZPayProvider
    const initialCustomer: QZPayCustomer | undefined = customerId
        ? ({ id: customerId } as QZPayCustomer)
        : undefined;

    // Show loading skeleton during SSR and before hydration
    if (!isHydrated) {
        return (
            <div
                className="billing-island-skeleton animate-pulse"
                // biome-ignore lint/a11y/useSemanticElements: loading indicator pattern used in tests
                role="status"
                aria-label={t('billing.island.loadingAria')}
            >
                <div className="mb-4 h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-1/2 rounded bg-gray-200" />
            </div>
        );
    }

    // Note: Type cast needed due to React version mismatch between
    // @qazuor/qzpay-react (built with React 19) and web app (React 18)
    return (
        <>
            {
                QZPayProvider({
                    billing,
                    initialCustomer,
                    children: QZPayThemeProvider({
                        theme: hospedaQzpayTheme,
                        children
                    }) as React.ReactElement
                }) as React.ReactElement
            }
        </>
    );
}
