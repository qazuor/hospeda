/**
 * FeatureList Component
 * Displays a list of features with checkmarks
 */
interface Feature {
    name: string;
    description?: string;
    included: boolean;
}

interface FeatureListProps {
    features: Feature[];
    className?: string;
}

export function FeatureList({ features, className = '' }: FeatureListProps) {
    return (
        <ul className={`space-y-3 ${className}`}>
            {features.map((feature) => (
                <li
                    key={feature.name}
                    className="flex items-start gap-3"
                >
                    {feature.included ? (
                        <svg
                            role="img"
                            aria-hidden="true"
                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    ) : (
                        <svg
                            role="img"
                            aria-hidden="true"
                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    )}
                    <div className="flex-1">
                        <span className={feature.included ? 'text-gray-900' : 'text-gray-400'}>
                            {feature.name}
                        </span>
                        {feature.description && (
                            <p className="mt-1 text-gray-500 text-sm">{feature.description}</p>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
}
