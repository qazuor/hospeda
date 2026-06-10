import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { LimitKey } from '@repo/billing';
import { CrownIcon } from '@repo/icons';
import * as React from 'react';

export interface LimitProgressIndicatorProps {
    /** Plan limit key to read from the user's entitlements. */
    readonly limitKey: LimitKey | string;
    /** Live count of the resource (typically array length from form state). */
    readonly currentCount: number;
    /** Human-readable label used in the warning copy (e.g. "fotos"). */
    readonly resourceLabel?: string;
    /** Override the "Mejorar plan" CTA destination. */
    readonly upgradeUrl?: string;
    /** Additional CSS classes applied to the wrapper. */
    readonly className?: string;
}

/**
 * Soft visual indicator for plan limits (spec §4.7, sabor 2:
 * "límite cuantitativo... aviso con barra de progreso del límite + CTA
 * de upgrade, junto al recurso que limita").
 *
 * The component renders ONLY when the resolved limit for the given key is a
 * finite positive number. Staff bypass the indicator because the entitlements
 * resolver returns the unlimited sentinel (`-1`) for them (SPEC-171), and any
 * actor whose plan does not expose this limit reads as unlimited too — both
 * collapse into the `maxAllowed === -1 → null` branch below. No role check is
 * needed here: the motor is the single source of truth.
 *
 * Authoritative enforcement of the limit happens server-side (e.g.
 * `enforcePhotoLimit` on `POST /api/v1/admin/media/upload`); this UI is a
 * proactive signal so the host knows where they stand BEFORE the server
 * returns 403. Hiding the resource at-limit would surprise the host.
 *
 * Visual states (driven by `currentCount / maxAllowed`):
 *
 * - < 70% → success token (calm green)
 * - 70% – 89% → warning token (attention amber)
 * - 90% – 99% → destructive token (red, close to cap)
 * - ≥ 100% → destructive + explicit "límite alcanzado" copy + CTA
 *
 * @example
 * ```tsx
 * <LimitProgressIndicator
 *   limitKey={LimitKey.MAX_PHOTOS_PER_ACCOMMODATION}
 *   currentCount={gallery.length}
 *   resourceLabel={t('admin-entities.fields.media.gallery.label')}
 * />
 * ```
 */
export const LimitProgressIndicator = React.memo(function LimitProgressIndicatorComponent({
    limitKey,
    currentCount,
    resourceLabel,
    upgradeUrl,
    className
}: LimitProgressIndicatorProps) {
    const { t } = useTranslations();
    const { limit, isLoading, error } = useMyEntitlements();

    // While loading or on error we keep silent rather than flashing — the
    // alternative (a placeholder bar) is noisier than just waiting.
    if (isLoading || error) return null;

    const maxAllowed = limit(limitKey);
    // Unlimited or unknown → no indicator. Staff (resolver returns -1 per
    // SPEC-171) and actors whose plan does not expose this limit (hook
    // defaults missing keys to -1) both land here. Fail-open by design.
    if (maxAllowed === undefined || maxAllowed === -1) return null;
    if (maxAllowed === 0) return null;

    const ratio = currentCount / maxAllowed;
    const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
    const atLimit = currentCount >= maxAllowed;
    const tone: 'low' | 'medium' | 'high' = atLimit
        ? 'high'
        : ratio < 0.7
          ? 'low'
          : ratio < 0.9
            ? 'medium'
            : 'high';

    const toneStyles = {
        low: { bar: 'bg-success', text: 'text-success', border: 'border-success/30' },
        medium: { bar: 'bg-warning', text: 'text-warning', border: 'border-warning/30' },
        high: { bar: 'bg-destructive', text: 'text-destructive', border: 'border-destructive/30' }
    }[tone];

    const resolvedUpgradeUrl = upgradeUrl ?? '/billing/my-plan';
    const labelKey = atLimit
        ? 'admin-entities.limitGate.atLimit'
        : 'admin-entities.limitGate.belowLimit';

    return (
        <div
            className={cn('rounded-md border bg-card px-3 py-2', toneStyles.border, className)}
            data-testid={`limit-indicator-${limitKey}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('font-medium text-sm tabular-nums', toneStyles.text)}>
                        {currentCount} / {maxAllowed}
                    </span>
                    {resourceLabel && (
                        <span className="truncate text-muted-foreground text-sm">
                            {resourceLabel}
                        </span>
                    )}
                </div>
                {atLimit && (
                    <a
                        href={resolvedUpgradeUrl}
                        className="inline-flex flex-none items-center gap-1 rounded text-primary text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                        <CrownIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                        />
                        {t('admin-entities.limitGate.upgradeLink')}
                    </a>
                )}
            </div>
            <div
                className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
            >
                <span
                    className={cn('block h-full rounded-full transition-[width]', toneStyles.bar)}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
                {t(labelKey, { current: currentCount, max: maxAllowed })}
            </p>
        </div>
    );
});

LimitProgressIndicator.displayName = 'LimitProgressIndicator';
