/**
 * EntitlementGatedSection
 *
 * Wrapper component that gates a section based on entitlement
 * Used for premium features that require specific plan entitlements
 */
import { PlanEntitlementGate } from '@/features/billing/PlanEntitlementGate';
import { useTranslations } from '@/hooks/use-translations';
import { ShieldAlertIcon } from '@repo/icons';

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
    const { t } = useTranslations();

    return (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-6">
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-warning/15">
                    <ShieldAlertIcon
                        className="h-5 w-5 text-warning"
                        aria-label={t('admin-entities.entitlementGate.premiumFeature')}
                    />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                        {sectionTitle
                            ? t('admin-entities.entitlementGate.titleWithSection', {
                                  section: sectionTitle
                              })
                            : t('admin-entities.entitlementGate.titleDefault')}
                    </h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                        {t('admin-entities.entitlementGate.description')}
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
        <PlanEntitlementGate
            entitlementKey={entitlementKey}
            fallback={fallbackComponent}
        >
            {children}
        </PlanEntitlementGate>
    );
}
