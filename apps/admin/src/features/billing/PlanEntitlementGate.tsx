/**
 * PlanEntitlementGate — plan-aware feature gate for the admin app.
 *
 * Replaces the `@qazuor/qzpay-react` `EntitlementGate` for fields whose
 * visibility depends on the **currently-logged-in user's** plan entitlements
 * (e.g. `can_use_rich_description`, `can_embed_video`).
 *
 * Unlike `EntitlementGate`, this component does NOT require a `customerId`
 * prop or a customer wired into the `QZPayContext`. It reads entitlements
 * from `GET /api/v1/protected/users/me/entitlements` via `useMyEntitlements`
 * and renders `children` or `fallback` accordingly.
 *
 * @module features/billing/PlanEntitlementGate
 */
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { useTranslations } from '@/hooks/use-translations';
import { EntitlementKey } from '@repo/billing';
import type * as React from 'react';

export interface PlanEntitlementGateProps {
    /** The entitlement flag that must be present to render `children`. */
    readonly entitlementKey: EntitlementKey | string;
    /** Rendered when the entitlement is present. */
    // biome-ignore lint/suspicious/noExplicitAny: React 19 ReactNode type compatibility
    readonly children: any;
    /**
     * Rendered when the entitlement is absent.
     * Defaults to a generic upgrade nudge box.
     */
    // biome-ignore lint/suspicious/noExplicitAny: React 19 ReactNode type compatibility
    readonly fallback?: any;
    /** Human-readable field label used in the default fallback message. */
    readonly fieldLabel?: string;
    /**
     * Variant controls which default fallback nudge text is shown when
     * `fallback` is not provided.
     *
     * - `'rich-description'` — nudge mentioning rich text descriptions.
     * - `'video'` — nudge mentioning video embedding.
     * - `'generic'` — generic premium feature nudge.
     */
    readonly nudgeVariant?: 'rich-description' | 'video' | 'generic';
    /** URL to direct the user to upgrade their plan. */
    readonly upgradeUrl?: string;
}

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
 *   entitlementKey={EntitlementKey.CAN_USE_RICH_DESCRIPTION}
 *   nudgeVariant="rich-description"
 *   fieldLabel="Descripción Enriquecida"
 * >
 *   <RichTextField {...fieldProps} />
 * </PlanEntitlementGate>
 * ```
 */
/**
 * Derives the nudge variant from the entitlement key when not explicitly
 * provided by the caller.
 */
function deriveNudgeVariant(
    key: EntitlementKey | string,
    explicit: PlanEntitlementGateProps['nudgeVariant']
): PlanEntitlementGateProps['nudgeVariant'] {
    if (explicit !== undefined) return explicit;
    if (key === EntitlementKey.CAN_USE_RICH_DESCRIPTION) return 'rich-description';
    if (key === EntitlementKey.CAN_EMBED_VIDEO) return 'video';
    return 'generic';
}

export function PlanEntitlementGate({
    entitlementKey,
    children,
    fallback,
    fieldLabel,
    nudgeVariant,
    upgradeUrl
}: PlanEntitlementGateProps): React.ReactNode {
    const { has, isLoading, error } = useMyEntitlements();
    const { t } = useTranslations();

    const resolvedNudgeVariant = deriveNudgeVariant(entitlementKey, nudgeVariant);

    // While loading — show children to avoid layout flash.
    if (isLoading) {
        return children;
    }

    // On error — fail safe: show fallback.
    if (error) {
        return (
            fallback ?? (
                <DefaultFallback
                    nudgeVariant={resolvedNudgeVariant}
                    fieldLabel={fieldLabel}
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
                nudgeVariant={resolvedNudgeVariant}
                fieldLabel={fieldLabel}
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
    readonly nudgeVariant: PlanEntitlementGateProps['nudgeVariant'];
    readonly fieldLabel?: string;
    readonly upgradeUrl?: string;
    // biome-ignore lint/suspicious/noExplicitAny: translation fn dynamic key access
    readonly t: (key: any, vars?: Record<string, string>) => string;
}

function DefaultFallback({
    nudgeVariant,
    fieldLabel,
    upgradeUrl,
    t
}: DefaultFallbackProps): React.ReactNode {
    let nudgeText: string;

    switch (nudgeVariant) {
        case 'rich-description':
            nudgeText = t('admin-entities.entitlementGate.richDescriptionNudge');
            break;
        case 'video':
            nudgeText = t('admin-entities.entitlementGate.videoNudge');
            break;
        default:
            nudgeText = fieldLabel
                ? t('admin-entities.entitlementGate.fieldPremiumDescription')
                : t('admin-entities.entitlementGate.description');
    }

    const upgradeLinkText = t('admin-entities.entitlementGate.upgradeLink');

    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-medium text-foreground text-sm">
                {fieldLabel
                    ? t('admin-entities.entitlementGate.fieldPremium', { field: fieldLabel })
                    : t('admin-entities.entitlementGate.premiumFeature')}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">{nudgeText}</p>
            {upgradeUrl && (
                <a
                    href={upgradeUrl}
                    className="mt-2 inline-block text-primary text-xs underline hover:no-underline"
                >
                    {upgradeLinkText}
                </a>
            )}
        </div>
    );
}
