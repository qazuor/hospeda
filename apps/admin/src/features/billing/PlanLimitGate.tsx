/**
 * PlanLimitGate — plan-aware numeric limit gate for the admin app.
 *
 * Replaces the `@qazuor/qzpay-react` `LimitGate` for fields and pages whose
 * availability depends on the **currently-logged-in user's** plan limits
 * (e.g. `LimitKey.MAX_ACCOMMODATIONS`, `LimitKey.MAX_ACTIVE_PROMOTIONS`).
 *
 * Unlike `LimitGate`, this component does NOT require a `customerId` prop or
 * a customer wired into the `QZPayContext`. It reads limit values from
 * `GET /api/v1/protected/users/me/entitlements` via `useMyEntitlements` and
 * compares them against the caller-supplied `currentCount`.
 *
 * @module features/billing/PlanLimitGate
 */
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { useTranslations } from '@/hooks/use-translations';
import type { LimitKey } from '@repo/billing';
import type * as React from 'react';

export interface PlanLimitGateProps {
    /** The plan limit key to gate on (e.g., LimitKey.MAX_ACCOMMODATIONS). */
    readonly limitKey: LimitKey | string;
    /** Caller-provided current usage count for this limit. */
    readonly currentCount: number;
    /** Rendered when under the limit. */
    // biome-ignore lint/suspicious/noExplicitAny: React 19 ReactNode type compatibility
    readonly children: any;
    /**
     * Rendered when at-or-over the limit.
     * Defaults to a generic limit-reached nudge box.
     */
    // biome-ignore lint/suspicious/noExplicitAny: React 19 ReactNode type compatibility
    readonly fallback?: any;
    /** Human-readable field label used in the default fallback message. */
    readonly fieldLabel?: string;
    /** Override the upgrade URL on the default nudge. */
    readonly upgradeUrl?: string;
}

/**
 * Gate component that renders `children` only when the current user's plan
 * limit for `limitKey` has not yet been reached by `currentCount`.
 *
 * Fail-open while loading (children shown, no layout flash).
 * Fail-closed on error (fallback shown, safe side).
 *
 * Special values for the resolved limit:
 * - `-1` → unlimited → always renders children.
 * - `0`  → never allowed → always renders fallback.
 * - `undefined` → limit key unknown or entitlements not loaded → renders children (fail-open).
 *
 * @example
 * ```tsx
 * const { count } = useAccommodationCount();
 * <PlanLimitGate
 *   limitKey={LimitKey.MAX_ACCOMMODATIONS}
 *   currentCount={count}
 *   fieldLabel="Alojamientos"
 * >
 *   <AccommodationForm />
 * </PlanLimitGate>
 * ```
 */
export function PlanLimitGate({
    limitKey,
    currentCount,
    children,
    fallback,
    fieldLabel,
    upgradeUrl
}: PlanLimitGateProps): React.ReactNode {
    const { limit, isLoading, error } = useMyEntitlements();
    const { t } = useTranslations();

    // While loading — show children to avoid layout flash (fail-open during load).
    if (isLoading) {
        return children;
    }

    // On error — fail-closed: show fallback.
    if (error) {
        return (
            fallback ?? (
                <DefaultFallback
                    limitKey={limitKey}
                    currentCount={currentCount}
                    maxAllowed={0}
                    fieldLabel={fieldLabel}
                    upgradeUrl={upgradeUrl}
                    t={t}
                />
            )
        );
    }

    const maxAllowed = limit(limitKey);

    // Unknown limit key (not in plan data yet) — fail-open.
    if (maxAllowed === undefined) {
        return children;
    }

    // -1 means unlimited — always allow.
    if (maxAllowed === -1) {
        return children;
    }

    // 0 means never allowed for this plan tier.
    if (maxAllowed === 0) {
        return (
            fallback ?? (
                <DefaultFallback
                    limitKey={limitKey}
                    currentCount={currentCount}
                    maxAllowed={maxAllowed}
                    fieldLabel={fieldLabel}
                    upgradeUrl={upgradeUrl}
                    t={t}
                />
            )
        );
    }

    // Under the limit — allow.
    if (currentCount < maxAllowed) {
        return children;
    }

    // At or over the limit — show fallback.
    return (
        fallback ?? (
            <DefaultFallback
                limitKey={limitKey}
                currentCount={currentCount}
                maxAllowed={maxAllowed}
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
    readonly limitKey: LimitKey | string;
    readonly currentCount: number;
    readonly maxAllowed: number;
    readonly fieldLabel?: string;
    readonly upgradeUrl?: string;
    // biome-ignore lint/suspicious/noExplicitAny: translation fn dynamic key access
    readonly t: (key: any, vars?: Record<string, string>) => string;
}

function DefaultFallback({
    currentCount,
    maxAllowed,
    fieldLabel,
    upgradeUrl,
    t
}: DefaultFallbackProps): React.ReactNode {
    const title = fieldLabel
        ? t('admin-entities.limitGate.fieldLimitReached', { field: fieldLabel })
        : t('admin-entities.limitGate.titleDefault');

    const description = t('admin-entities.limitGate.descriptionTemplate', {
        currentCount: String(currentCount),
        maxAllowed: String(maxAllowed)
    });

    const upgradeLinkText = t('admin-entities.limitGate.upgradeLink');
    const resolvedUpgradeUrl = upgradeUrl ?? '/billing/my-plan';

    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-medium text-foreground text-sm">{title}</p>
            <p className="mt-1 text-muted-foreground text-xs">{description}</p>
            <a
                href={resolvedUpgradeUrl}
                className="mt-2 inline-block text-primary text-xs underline hover:no-underline"
            >
                {upgradeLinkText}
            </a>
        </div>
    );
}
