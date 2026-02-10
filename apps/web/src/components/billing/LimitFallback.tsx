/**
 * LimitFallback Component
 *
 * Fallback component for LimitGate's `fallback` prop.
 * Displays the limit name, current usage vs max, and a CTA to upgrade.
 *
 * @module components/billing/LimitFallback
 */

'use client';

import { useTranslations } from '@repo/i18n';
import type { ReactElement } from 'react';

/**
 * LimitFallback component props
 */
export interface LimitFallbackProps {
    /**
     * Human-readable name of the limit (e.g., "alojamientos", "eventos")
     * @example "alojamientos"
     */
    limitName: string;

    /**
     * Current usage count
     * @example 5
     */
    currentValue: number;

    /**
     * Maximum allowed by current plan
     * @example 5
     */
    maxValue: number;

    /**
     * Name of the current plan
     * @example "Básico"
     */
    currentPlan: string;

    /**
     * Link to the upgrade/pricing page
     * @example "/precios/propietarios"
     */
    upgradeLink: string;
}

/**
 * Warning icon SVG
 * Inline SVG to avoid external dependencies
 */
function WarningIcon(): ReactElement {
    return (
        <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <title>Warning</title>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
    );
}

/**
 * Arrow right icon SVG
 * Used in CTA button
 */
function ArrowRightIcon(): ReactElement {
    return (
        <svg
            className="ml-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <title>Arrow right</title>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
        </svg>
    );
}

/**
 * LimitFallback Component
 *
 * Renders a card displaying limit information when a user has reached their plan limit.
 * Shows the current usage, max allowed, and a call-to-action to upgrade.
 *
 * Visual design:
 * - Warning icon with limit title
 * - Message explaining the limit reached
 * - Progress bar showing usage percentage
 * - Counter displaying current/max values
 * - CTA button linking to upgrade page
 *
 * Accessibility:
 * - Uses semantic HTML
 * - Includes aria-live for screen reader announcements
 * - Proper color contrast
 * - Keyboard navigable CTA link
 *
 * @param props - Component props
 * @returns React element displaying limit fallback UI
 *
 * @example
 * ```tsx
 * import { LimitGate } from '@qazuor/qzpay-react';
 * import { LimitFallback } from '@/components/billing';
 *
 * <LimitGate
 *   limit="max_accommodations"
 *   fallback={
 *     <LimitFallback
 *       limitName="alojamientos"
 *       currentValue={5}
 *       maxValue={5}
 *       currentPlan="Básico"
 *       upgradeLink="/precios/propietarios"
 *     />
 *   }
 * >
 *   <AddAccommodationButton />
 * </LimitGate>
 * ```
 */
export function LimitFallback({
    limitName,
    currentValue,
    maxValue,
    currentPlan,
    upgradeLink
}: LimitFallbackProps): ReactElement {
    const { t } = useTranslations();

    // Calculate usage percentage
    const percentage = Math.min((currentValue / maxValue) * 100, 100);

    // Determine progress bar color based on percentage
    // Red when at/over limit (>=100%), amber when near limit (>75%)
    const progressColorClass =
        percentage >= 100 ? 'bg-red-500' : percentage > 75 ? 'bg-amber-500' : 'bg-blue-500';

    return (
        <div
            className="rounded-xl border-red-400 border-l-4 bg-white p-6 shadow-md"
            role="alert"
            aria-live="polite"
        >
            {/* Icon and title */}
            <div className="mb-4 flex items-start gap-3">
                <WarningIcon />
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-xl">
                        {t('billing.limits.reached')}
                    </h3>
                </div>
            </div>

            {/* Message */}
            <p className="mb-4 text-gray-600">
                {t('billing.limits.reachedMessage', {
                    maxValue: String(maxValue),
                    limitName,
                    currentPlan
                })}
            </p>

            {/* Progress bar and counter */}
            <div className="mb-6">
                {/* Counter */}
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-gray-500 text-sm">
                        {t('billing.limits.currentUsage')}
                    </span>
                    <span className="font-medium text-gray-900 text-sm">
                        {currentValue}/{maxValue}
                    </span>
                </div>

                {/* Progress bar container */}
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                    {/* Progress bar fill */}
                    <div
                        className={`h-full transition-all duration-300 ${progressColorClass}`}
                        style={{ width: `${percentage}%` }}
                        role="progressbar"
                        aria-valuenow={currentValue}
                        aria-valuemin={0}
                        aria-valuemax={maxValue}
                        aria-label={t('billing.limits.usageAriaLabel', {
                            currentValue: String(currentValue),
                            maxValue: String(maxValue),
                            limitName
                        })}
                        tabIndex={0}
                    />
                </div>
            </div>

            {/* CTA button */}
            <a
                href={upgradeLink}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-base text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                {t('billing.limits.upgradeCta', { limitName })}
                <ArrowRightIcon />
            </a>
        </div>
    );
}
