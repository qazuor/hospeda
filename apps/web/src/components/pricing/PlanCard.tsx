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
    highlighted?: boolean;
    badge?: string;
    trialText?: string;
    currency?: string;
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
    highlighted = false,
    badge,
    trialText,
    currency = 'ARS'
}: PlanCardProps) {
    const formattedPrice = formatPrice(price);
    const formattedOriginalPrice = originalPrice ? formatPrice(originalPrice) : null;
    const periodText = period === 'monthly' ? '/mes' : '/año';
    const hasDiscount = originalPrice && originalPrice !== price;

    const handleClick = () => {
        if (onCtaClick) {
            onCtaClick();
        } else if (ctaLink) {
            window.location.href = ctaLink;
        }
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
                className={`mb-6 w-full rounded-lg px-6 py-3 font-semibold transition-colors ${
                    highlighted
                        ? 'bg-white text-primary hover:bg-gray-100'
                        : 'bg-primary text-white hover:bg-primary/90'
                }`}
            >
                {ctaText}
            </button>

            <FeatureList
                features={features}
                className={highlighted ? '[&_span]:text-white [&_svg]:text-green-300' : ''}
            />
        </div>
    );
}
