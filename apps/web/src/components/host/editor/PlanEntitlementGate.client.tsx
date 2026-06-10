/**
 * @file PlanEntitlementGate.client.tsx
 * @description Plan-aware feature gate for the web app.
 *
 * Renders `children` only when the current user's plan includes the specified
 * entitlement key. Shows a locked state with upgrade CTA when the entitlement
 * is absent.
 *
 * @module components/host/editor/PlanEntitlementGate
 */

import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type * as React from 'react';
import styles from './PlanEntitlementGate.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanEntitlementGateProps {
    /** The entitlement flag that must be present to render `children`. */
    readonly entitlementKey: string;
    /** Rendered when the entitlement is present. */
    readonly children: React.ReactNode;
    /**
     * Rendered when the entitlement is absent.
     * Defaults to a generic upgrade nudge box.
     */
    readonly fallback?: React.ReactNode;
    /** URL to direct the user to upgrade their plan. */
    readonly upgradeUrl?: string;
    /** Locale for i18n translations. */
    readonly locale?: SupportedLocale;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Gate component that renders `children` only when the current user's plan
 * includes `entitlementKey`.
 *
 * While the entitlements query is loading the gate is open (children are
 * rendered) to avoid a layout flash. On error the gate closes (fallback is
 * rendered) to fail safe.
 *
 * @example
 * ```tsx
 * <PlanEntitlementGate
 *   entitlementKey="can_use_rich_description"
 *   upgradeUrl="/suscriptores/precios/"
 * >
 *   <RichTextEditor {...props} />
 * </PlanEntitlementGate>
 * ```
 */
export function PlanEntitlementGate({
    entitlementKey,
    children,
    fallback,
    upgradeUrl,
    locale = 'es'
}: PlanEntitlementGateProps): React.ReactNode {
    const { has, isLoading, error } = useMyEntitlements();
    const { t } = createTranslations(locale);

    // While loading — show children to avoid layout flash.
    if (isLoading) {
        return children;
    }

    // On error — fail safe: show fallback.
    if (error) {
        return (
            fallback ?? (
                <DefaultFallback
                    upgradeUrl={upgradeUrl}
                    t={t}
                />
            )
        );
    }

    if (has(entitlementKey)) {
        return children;
    }

    return (
        fallback ?? (
            <DefaultFallback
                upgradeUrl={upgradeUrl}
                t={t}
            />
        )
    );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DefaultFallbackProps {
    readonly upgradeUrl?: string;
    readonly t: (key: string, fallback?: string) => string;
}

function DefaultFallback({ upgradeUrl, t }: DefaultFallbackProps): React.ReactNode {
    const title = t('host.properties.editor.entitlement.premiumFeature', 'Función premium');
    const description = t(
        'host.properties.editor.entitlement.richDescriptionNudge',
        'Actualizá tu plan para usar descripciones enriquecidas con formato.'
    );
    const upgradeLinkText = t('host.properties.editor.entitlement.upgradeLink', 'Mejorar plan');

    return (
        <div className={styles.locked}>
            <p className={styles.lockedTitle}>{title}</p>
            <p className={styles.lockedDescription}>{description}</p>
            {upgradeUrl && (
                <a
                    href={upgradeUrl}
                    className={styles.upgradeLink}
                >
                    {upgradeLinkText}
                </a>
            )}
        </div>
    );
}
