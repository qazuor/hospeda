'use client';

import type { PlanDefinition } from '@repo/billing';
import { useMemo, useState } from 'react';
import { createCheckoutSession } from '../../lib/billing-api-client';
import { PlanCard } from './PlanCard';
import { PricingToggle } from './PricingToggle';
import { PromoCodeInput, type PromoCodeResult } from './PromoCodeInput';

/**
 * Feature definition for plan cards
 */
interface Feature {
    name: string;
    description?: string;
    included: boolean;
}

/**
 * QZPayPlan type from @qazuor/qzpay-core
 * Represents the plan data returned from the QZPay API
 */
interface QZPayPlan {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    sortOrder: number;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * UsePlans hook result from @qazuor/qzpay-react
 */
interface UsePlansResult {
    plans: QZPayPlan[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * PricingSection Component Props
 */
interface PricingSectionProps {
    plans: PlanDefinition[];
    highlightedPlanSlug?: string;
    badges?: Record<string, string>;
    showToggle?: boolean;
    getCtaText?: (plan: PlanDefinition) => string;
    getCtaLink?: (plan: PlanDefinition) => string;
    onPlanSelect?: (plan: PlanDefinition) => void;
    getFeatures?: (plan: PlanDefinition) => Feature[];
    isAuthenticated?: boolean;
    successUrl?: string;
    cancelUrl?: string;
}

/**
 * Hook wrapper to safely use usePlans with fallback
 * Returns empty data if not in QZPayProvider context
 */
function usePlansOrFallback(): UsePlansResult {
    try {
        // Dynamic require for conditional hook import with graceful degradation
        const { usePlans } = require('@qazuor/qzpay-react');
        return usePlans({ activeOnly: true });
    } catch {
        // Not in QZPayProvider context - return empty result
        return {
            plans: [],
            isLoading: false,
            error: null,
            refetch: async () => {}
        };
    }
}

/**
 * PricingSection Component
 *
 * Complete pricing section with plan cards, billing period toggle, and promo code input.
 * Integrates with QZPay API to fetch live plan data when available, falling back to
 * static prop data on error or when not in a QZPayProvider context.
 *
 * @param props - Component props
 * @returns React element with pricing section
 *
 * @example
 * ```tsx
 * // With static data only
 * <PricingSection plans={staticPlans} />
 *
 * // Inside BillingIsland with API integration
 * <BillingIsland apiUrl="/api/v1" client:load>
 *   <PricingSection plans={staticPlans} highlightedPlanSlug="pro" />
 * </BillingIsland>
 * ```
 */
export function PricingSection({
    plans,
    highlightedPlanSlug,
    badges = {},
    showToggle = true,
    getCtaText,
    getCtaLink,
    onPlanSelect,
    getFeatures,
    isAuthenticated = false,
    successUrl,
    cancelUrl
}: PricingSectionProps) {
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [promoDiscount, setPromoDiscount] = useState<PromoCodeResult | null>(null);

    // Try to fetch plans from API (will be empty if not in QZPayProvider)
    const { plans: apiPlans, isLoading: isApiLoading, error: apiError } = usePlansOrFallback();

    // Merge API data with static plans
    const effectivePlans = useMemo(() => {
        if (apiPlans.length > 0) {
            // API plans loaded - merge with static for pricing/entitlements data
            const merged = plans.map((staticPlan) => {
                const apiPlan = apiPlans.find((p) => p.slug === staticPlan.slug);
                if (apiPlan) {
                    return {
                        ...staticPlan,
                        name: apiPlan.name,
                        description: apiPlan.description ?? staticPlan.description,
                        isActive: apiPlan.isActive
                    };
                }
                return staticPlan;
            });
            return merged;
        }

        if (apiError) {
            console.warn(
                '[PricingSection] Failed to fetch plans from API, using static data:',
                apiError.message
            );
        }

        return plans;
    }, [apiPlans, plans, apiError]);

    // Check if any plan has annual pricing
    const hasAnnualPricing = effectivePlans.some((plan) => plan.annualPriceArs !== null);

    // Default CTA text generator
    const defaultGetCtaText = (plan: PlanDefinition): string => {
        if (plan.monthlyPriceArs === 0) {
            return 'Crear cuenta gratis';
        }
        if (plan.hasTrial && plan.trialDays > 0) {
            return `Comenzar prueba gratis (${plan.trialDays} días)`;
        }
        return 'Suscribirse';
    };

    // Default CTA link generator
    const defaultGetCtaLink = (plan: PlanDefinition): string => {
        const base = `/auth/sign-up?plan=${plan.slug}`;
        return promoDiscount ? `${base}&promo=${promoDiscount.code}` : base;
    };

    // Default feature generator from entitlements and limits
    const defaultGetFeatures = (plan: PlanDefinition): Feature[] => {
        const features: Feature[] = [];

        // Add entitlements as features
        for (const entitlement of plan.entitlements) {
            features.push({
                name: entitlement as string,
                included: true
            });
        }

        // Add limits as features
        for (const limit of plan.limits) {
            const typedLimit = limit as {
                name: string;
                value: number;
                key: string;
                description: string;
            };
            const value = typedLimit.value === -1 ? 'Ilimitado' : typedLimit.value.toString();
            features.push({
                name: `${typedLimit.name}: ${value}`,
                included: true
            });
        }

        return features;
    };

    const handlePlanClick = (plan: PlanDefinition) => {
        if (onPlanSelect) {
            onPlanSelect(plan);
        }
    };

    // Handle checkout session creation
    const handleCheckout = async (planSlug: string, priceId: string) => {
        // Determine interval from priceId
        const interval = priceId.includes('annual') ? 'year' : 'month';

        // Get current URL for cancel redirect
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const defaultCancelUrl =
            cancelUrl || `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}checkout=cancelled`;

        // Create checkout session
        const { checkoutUrl } = await createCheckoutSession({
            planSlug,
            interval,
            promoCode: promoDiscount?.code,
            successUrl: successUrl || '/mi-cuenta/suscripcion?checkout=success',
            cancelUrl: defaultCancelUrl
        });

        // Redirect to checkout
        window.location.href = checkoutUrl;
    };

    // Show loading skeleton when API is loading AND no static plans are available
    if (isApiLoading && plans.length === 0) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-12">
                <output
                    className="grid gap-8 md:grid-cols-3"
                    aria-label="Loading pricing plans..."
                >
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="animate-pulse"
                        >
                            <div className="rounded-lg border border-gray-200 p-6">
                                {/* Plan name */}
                                <div className="mb-4 h-6 w-3/4 rounded bg-gray-200" />
                                {/* Plan description */}
                                <div className="mb-2 h-4 w-full rounded bg-gray-200" />
                                <div className="mb-6 h-4 w-5/6 rounded bg-gray-200" />
                                {/* Price */}
                                <div className="mb-6 h-10 w-1/2 rounded bg-gray-200" />
                                {/* Features */}
                                <div className="space-y-3">
                                    <div className="h-4 w-full rounded bg-gray-200" />
                                    <div className="h-4 w-full rounded bg-gray-200" />
                                    <div className="h-4 w-full rounded bg-gray-200" />
                                    <div className="h-4 w-4/5 rounded bg-gray-200" />
                                </div>
                                {/* CTA Button */}
                                <div className="mt-6 h-10 w-full rounded bg-gray-200" />
                            </div>
                        </div>
                    ))}
                </output>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-12">
            {showToggle && hasAnnualPricing && (
                <PricingToggle
                    initialValue={billingPeriod}
                    onChange={setBillingPeriod}
                    savingsText="¡Ahorrá 2 meses!"
                />
            )}

            <div className="mx-auto mb-8 max-w-2xl">
                <PromoCodeInput onPromoApplied={setPromoDiscount} />
            </div>

            <div
                className={`grid gap-8 ${
                    effectivePlans.length === 2
                        ? 'mx-auto max-w-4xl md:grid-cols-2'
                        : effectivePlans.length === 3
                          ? 'md:grid-cols-3'
                          : 'md:grid-cols-2 lg:grid-cols-4'
                }`}
            >
                {effectivePlans.map((plan) => {
                    const originalPrice =
                        billingPeriod === 'monthly'
                            ? plan.monthlyPriceArs
                            : (plan.annualPriceArs ?? plan.monthlyPriceArs);

                    const discountedPrice =
                        promoDiscount && originalPrice > 0
                            ? Math.round(originalPrice * (1 - promoDiscount.discountPercent / 100))
                            : originalPrice;

                    const features = getFeatures ? getFeatures(plan) : defaultGetFeatures(plan);
                    const ctaText = getCtaText ? getCtaText(plan) : defaultGetCtaText(plan);
                    const ctaLink = getCtaLink ? getCtaLink(plan) : defaultGetCtaLink(plan);

                    // Create checkout wrapper for this specific plan
                    const handlePlanCheckout =
                        isAuthenticated && originalPrice > 0
                            ? (priceId: string) => handleCheckout(plan.slug, priceId)
                            : undefined;

                    return (
                        <PlanCard
                            key={plan.slug}
                            name={plan.name}
                            description={plan.description}
                            price={discountedPrice}
                            originalPrice={
                                promoDiscount && originalPrice > 0 ? originalPrice : undefined
                            }
                            promoCode={promoDiscount?.code}
                            period={billingPeriod}
                            features={features}
                            ctaText={ctaText}
                            ctaLink={ctaLink}
                            onCtaClick={() => handlePlanClick(plan)}
                            onCheckout={handlePlanCheckout}
                            planSlug={plan.slug}
                            highlighted={plan.slug === highlightedPlanSlug}
                            badge={badges[plan.slug]}
                            trialText={
                                plan.hasTrial && plan.trialDays > 0
                                    ? `Prueba gratis por ${plan.trialDays} días`
                                    : undefined
                            }
                            isTrial={plan.hasTrial && plan.trialDays > 0}
                            isAuthenticated={isAuthenticated}
                        />
                    );
                })}
            </div>
        </div>
    );
}
