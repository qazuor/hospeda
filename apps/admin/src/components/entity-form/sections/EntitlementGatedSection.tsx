/**
 * EntitlementGatedSection
 *
 * Wrapper component that gates a section based on entitlement
 * Used for premium features that require specific plan entitlements
 */
import { EntitlementGate } from '@qazuor/qzpay-react';

export interface EntitlementGatedSectionProps {
    /** Entitlement key required to view section */
    entitlementKey: string;
    /** Content to render if entitlement is granted */
    // biome-ignore lint/suspicious/noExplicitAny: React 19 ReactNode type compatibility
    children: any;
    /** Optional custom fallback UI */
    // biome-ignore lint/suspicious/noExplicitAny: React 19 ReactNode type compatibility
    fallback?: any;
    /** Section title for fallback message */
    sectionTitle?: string;
}

/**
 * Default fallback UI for gated sections
 */
function DefaultFallback({ sectionTitle }: { sectionTitle?: string }) {
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <svg
                        className="h-5 w-5 text-amber-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                    </svg>
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-amber-900">
                        {sectionTitle
                            ? `${sectionTitle} - Funcionalidad Premium`
                            : 'Funcionalidad Premium'}
                    </h4>
                    <p className="mt-1 text-amber-800 text-sm">
                        Esta funcionalidad está disponible en planes superiores. Actualiza tu plan
                        para acceder a esta sección.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * EntitlementGatedSection component
 * Wraps section content with entitlement check
 */
export function EntitlementGatedSection({
    entitlementKey,
    children,
    fallback,
    sectionTitle
}: EntitlementGatedSectionProps) {
    const fallbackComponent = fallback || <DefaultFallback sectionTitle={sectionTitle} />;

    return (
        <EntitlementGate
            entitlementKey={entitlementKey}
            fallback={fallbackComponent}
        >
            {children}
        </EntitlementGate>
    );
}
