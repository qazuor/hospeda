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

import type * as React from 'react';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
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
    /** Listing vertical used to resolve the owner's plan. */
    readonly vertical?: 'accommodation' | 'venue' | 'experience';
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
 *   upgradeUrl="/es/planes/anfitriones/precios/"
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
    locale = 'es',
    vertical = 'accommodation'
}: PlanEntitlementGateProps): React.ReactNode {
    const { has, isLoading, error } = useMyEntitlements({ vertical });
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
                    entitlementKey={entitlementKey}
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
                entitlementKey={entitlementKey}
                upgradeUrl={upgradeUrl}
                t={t}
            />
        )
    );
}

/** Place in `Field.hint` so a formatting upgrade never separates label/control. */
export function PlanEntitlementHint({
    entitlementKey,
    upgradeUrl,
    locale = 'es',
    vertical = 'accommodation'
}: Pick<
    PlanEntitlementGateProps,
    'entitlementKey' | 'upgradeUrl' | 'locale' | 'vertical'
>): React.ReactNode {
    const { t } = createTranslations(locale);
    const nudge =
        entitlementKey === 'can_use_rich_description'
            ? {
                  key: 'richDescriptionHint',
                  fallback:
                      'Texto con formato en la descripción: negritas, listas y más. Disponible en planes superiores.'
              }
            : (NUDGE_KEY_BY_ENTITLEMENT[entitlementKey] ?? GENERIC_NUDGE);
    return (
        <PlanEntitlementGate
            entitlementKey={entitlementKey}
            locale={locale}
            vertical={vertical}
            fallback={
                <span className={styles.hint}>
                    {t(`host.properties.editor.entitlement.${nudge.key}`, nudge.fallback)}{' '}
                    {upgradeUrl ? (
                        <a href={upgradeUrl}>
                            {t('host.properties.editor.entitlement.upgradeLink', 'Mejorar plan')}
                        </a>
                    ) : null}
                </span>
            }
        >
            {null}
        </PlanEntitlementGate>
    );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Upgrade-copy key (under `host.properties.editor.entitlement`) per gated
 * entitlement. Unmapped entitlements get the generic nudge (HOS-1809).
 */
const NUDGE_KEY_BY_ENTITLEMENT: Readonly<Record<string, { key: string; fallback: string }>> = {
    can_use_rich_description: {
        key: 'richDescriptionNudge',
        fallback: 'Actualizá tu plan para usar descripciones enriquecidas con formato.'
    },
    can_use_calendar: {
        key: 'calendarNudge',
        fallback: 'Actualizá tu plan para usar el calendario de disponibilidad.'
    }
} as const;

const GENERIC_NUDGE = {
    key: 'genericNudge',
    fallback: 'Esta función está disponible en un plan superior.'
} as const;

interface DefaultFallbackProps {
    readonly entitlementKey: string;
    readonly upgradeUrl?: string;
    readonly t: (key: string, fallback?: string) => string;
}

function DefaultFallback({ entitlementKey, upgradeUrl, t }: DefaultFallbackProps): React.ReactNode {
    const title = t('host.properties.editor.entitlement.premiumFeature', 'Función premium');
    const nudge = NUDGE_KEY_BY_ENTITLEMENT[entitlementKey] ?? GENERIC_NUDGE;
    const description = t(`host.properties.editor.entitlement.${nudge.key}`, nudge.fallback);
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
