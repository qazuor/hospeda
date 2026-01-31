'use client';

import type { PlanDefinition } from '@repo/billing';
import { useState } from 'react';
import { PlanCard } from './PlanCard';
import { PricingToggle } from './PricingToggle';
import { PromoCodeInput, type PromoCodeResult } from './PromoCodeInput';

/**
 * PricingSection Component
 * Complete pricing section with toggle and plan cards
 */
interface Feature {
    name: string;
    description?: string;
    included: boolean;
}

interface PricingSectionProps {
    plans: PlanDefinition[];
    highlightedPlanSlug?: string;
    badges?: Record<string, string>;
    showToggle?: boolean;
    getCtaText?: (plan: PlanDefinition) => string;
    getCtaLink?: (plan: PlanDefinition) => string;
    onPlanSelect?: (plan: PlanDefinition) => void;
    getFeatures?: (plan: PlanDefinition) => Feature[];
}

export function PricingSection({
    plans,
    highlightedPlanSlug,
    badges = {},
    showToggle = true,
    getCtaText,
    getCtaLink,
    onPlanSelect,
    getFeatures
}: PricingSectionProps) {
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [promoDiscount, setPromoDiscount] = useState<PromoCodeResult | null>(null);

    // Check if any plan has annual pricing
    const hasAnnualPricing = plans.some((plan) => plan.annualPriceArs !== null);

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
                    plans.length === 2
                        ? 'mx-auto max-w-4xl md:grid-cols-2'
                        : plans.length === 3
                          ? 'md:grid-cols-3'
                          : 'md:grid-cols-2 lg:grid-cols-4'
                }`}
            >
                {plans.map((plan) => {
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
                            highlighted={plan.slug === highlightedPlanSlug}
                            badge={badges[plan.slug]}
                            trialText={
                                plan.hasTrial && plan.trialDays > 0
                                    ? `Prueba gratis por ${plan.trialDays} días`
                                    : undefined
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}
