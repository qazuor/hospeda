import { CheckIcon } from '@repo/icons';

/** Props for the SubscriptionFeaturesList component */
interface SubscriptionFeaturesListProps {
    readonly features: readonly string[];
    readonly heading: string;
}

/**
 * Semantic features list with check icons for the subscription card.
 *
 * @param features - Array of feature description strings to display
 * @param heading - Section heading text rendered above the list
 */
export function SubscriptionFeaturesList({ features, heading }: SubscriptionFeaturesListProps) {
    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-sm text-text-secondary uppercase tracking-wide">
                {heading}
            </h3>
            <ul className="space-y-2">
                {features.map((feature) => (
                    <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                        <CheckIcon
                            size="xs"
                            weight="bold"
                            className="shrink-0 text-secondary"
                            aria-hidden="true"
                        />
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Props for the SubscriptionUpgradeCta component */
interface SubscriptionUpgradeCtaProps {
    readonly heading: string;
    readonly description: string;
    readonly buttonText: string;
    readonly href: string;
}

/**
 * Upgrade call-to-action section for free plan users.
 *
 * @param heading - CTA section heading text
 * @param description - Supporting description text below the heading
 * @param buttonText - Text label for the upgrade button/link
 * @param href - URL for the upgrade link
 */
export function SubscriptionUpgradeCta({
    heading,
    description,
    buttonText,
    href
}: SubscriptionUpgradeCtaProps) {
    return (
        <div className="space-y-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-4">
            <h3 className="font-semibold text-text">{heading}</h3>
            <p className="text-sm text-text-secondary">{description}</p>
            <a
                href={href}
                className="mt-2 inline-block rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
                {buttonText}
            </a>
        </div>
    );
}
