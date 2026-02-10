/**
 * Upgrade Fallback Component
 *
 * Reusable fallback component for EntitlementGate that displays upgrade information
 * when a feature is not available in the current plan.
 *
 * @module components/billing/UpgradeFallback
 */

'use client';

import { useTranslations } from '@repo/i18n';

/**
 * Props for the UpgradeFallback component
 */
export interface UpgradeFallbackProps {
    /** Name of the feature that requires upgrade */
    featureName: string;
    /** Name of the plan that includes this feature */
    requiredPlan: string;
    /** Link to the upgrade/pricing page */
    upgradeLink: string;
    /** Optional description of the feature */
    description?: string;
}

/**
 * UpgradeFallback Component
 *
 * Displays a visually appealing card informing users that a feature is only available
 * in a specific plan, with a call-to-action link to upgrade.
 *
 * Features:
 * - Lock icon visual indicator
 * - Feature name and required plan information
 * - Optional feature description
 * - CTA button linking to upgrade page
 * - Full accessibility support
 * - Responsive design
 *
 * @example
 * ```tsx
 * import { EntitlementGate } from '@qazuor/qzpay-react';
 * import { UpgradeFallback } from '@/components/billing';
 *
 * <EntitlementGate
 *   entitlement="view_advanced_stats"
 *   fallback={
 *     <UpgradeFallback
 *       featureName="Estadísticas avanzadas"
 *       requiredPlan="Profesional"
 *       upgradeLink="/precios/propietarios"
 *       description="Accedé a métricas detalladas de tus alojamientos."
 *     />
 *   }
 * >
 *   <AdvancedStatsPanel />
 * </EntitlementGate>
 * ```
 *
 * @param props - Component properties
 * @returns JSX element representing the upgrade fallback UI
 */
export function UpgradeFallback({
    featureName,
    requiredPlan,
    upgradeLink,
    description
}: UpgradeFallbackProps) {
    const { t } = useTranslations();

    return (
        <div
            className="mx-auto max-w-2xl rounded-xl border-amber-400 border-l-4 bg-white p-6 shadow-md md:mx-0"
            // biome-ignore lint/a11y/useSemanticElements: custom upgrade prompt with CTA
            role="status"
            aria-label={t('billing.upgrade.unavailableAria', { featureName })}
        >
            {/* Lock icon */}
            <div className="flex flex-col items-center gap-4 md:items-start">
                <div className="flex items-center gap-4">
                    <svg
                        className="h-12 w-12 flex-shrink-0 text-amber-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                    </svg>

                    {/* Feature name */}
                    <h3 className="font-bold text-2xl text-gray-900">{featureName}</h3>
                </div>

                <div className="w-full space-y-4">
                    {/* Plan availability message */}
                    <p className="text-center text-gray-600 md:text-left">
                        {t('billing.upgrade.availableInPlan', { requiredPlan })}
                    </p>

                    {/* Optional description */}
                    {description && (
                        <p className="text-center text-gray-500 md:text-left">{description}</p>
                    )}

                    {/* CTA button */}
                    <div className="flex justify-center pt-2 md:justify-start">
                        <a
                            href={upgradeLink}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                            aria-label={t('billing.upgrade.viewPlansAria', { featureName })}
                        >
                            {t('billing.common.viewPlans')}
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                                />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
