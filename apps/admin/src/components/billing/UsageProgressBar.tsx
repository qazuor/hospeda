/**
 * Standalone usage progress bar (SPEC-156 PR-4 T-035).
 *
 * Reusable presentational component for "X of Y consumed" style metrics
 * inside the Mi facturación page (and any other page that needs to render
 * plan-usage progress). Intentionally NOT a SPEC-155 dashboard widget per
 * tech-analysis D5 — this is a primitive consumed by the Mi facturación
 * sections (T-036) directly.
 *
 * Color thresholds (per AC-9):
 *   - default tone when usage < 80 %
 *   - warning tone when 80 % ≤ usage < 95 %
 *   - danger tone when usage ≥ 95 %
 *
 * Treats `limit === null` (or `Number.POSITIVE_INFINITY`) as "unlimited"
 * and renders a non-progress info row so the caller can still surface the
 * metric for plans that have no cap.
 */

import { cn } from '@/lib/utils';

const WARNING_THRESHOLD = 80;
const DANGER_THRESHOLD = 95;

export type UsageProgressTone = 'default' | 'warning' | 'danger';

export interface UsageProgressBarProps {
    /** Localized field label shown above the bar (e.g. "Alojamientos publicados"). */
    readonly label: string;
    /** Current usage value in the plan's natural unit (count, bytes, etc.). */
    readonly used: number;
    /**
     * Plan limit in the same unit as `used`. Pass `null` (or
     * `Number.POSITIVE_INFINITY`) to indicate the resource is uncapped.
     */
    readonly limit: number | null;
    /** Optional text label shown next to the value (e.g. "alojamientos"). */
    readonly unit?: string;
    /** Localized rendering of "{used} of {limit}" — caller provides for i18n. */
    readonly unitOfLimitLabel?: string;
    /** Localized "Sin límite" text shown when `limit === null`. */
    readonly unlimitedLabel?: string;
    /** Extra classes for the outer container. */
    readonly className?: string;
}

/**
 * Compute the usage percentage clamped to `[0, 100]`.
 *
 * Exported separately so the same threshold math is reusable from unit
 * tests and from callers that render their own label rows alongside the
 * bar without duplicating the calculation.
 */
export function computeUsagePercent(used: number, limit: number | null): number {
    if (limit === null || !Number.isFinite(limit) || limit <= 0) return 0;
    if (used <= 0) return 0;
    const raw = (used / limit) * 100;
    if (raw >= 100) return 100;
    return Math.round(raw * 10) / 10;
}

/**
 * Pick the tone for a given percentage value per the AC-9 thresholds.
 *
 * Exported so consumers can react to the same tone (e.g. a row badge) and
 * so tests can assert the threshold boundaries directly.
 */
export function pickUsageTone(percent: number): UsageProgressTone {
    if (percent >= DANGER_THRESHOLD) return 'danger';
    if (percent >= WARNING_THRESHOLD) return 'warning';
    return 'default';
}

function isUnlimited(limit: number | null): boolean {
    return limit === null || !Number.isFinite(limit);
}

export function UsageProgressBar(props: UsageProgressBarProps) {
    const { label, used, limit, unit, unitOfLimitLabel, unlimitedLabel, className } = props;

    const unlimited = isUnlimited(limit);
    const percent = unlimited ? 0 : computeUsagePercent(used, limit);
    const tone = pickUsageTone(percent);

    const fillToneClass: Record<UsageProgressTone, string> = {
        default: 'bg-primary',
        warning: 'bg-warning',
        danger: 'bg-destructive'
    };

    const trackClass = 'relative h-2 w-full overflow-hidden rounded-full bg-secondary';

    return (
        <div
            className={cn('space-y-2', className)}
            data-testid="usage-progress-bar"
            data-tone={tone}
            data-percent={percent}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-muted-foreground text-xs">
                    {unlimited
                        ? (unlimitedLabel ?? `${used} ${unit ?? ''}`.trim())
                        : (unitOfLimitLabel ?? `${used} / ${limit}${unit ? ` ${unit}` : ''}`)}
                </p>
            </div>

            {!unlimited && (
                <div
                    className={trackClass}
                    role="progressbar"
                    aria-label={label}
                    aria-valuenow={Math.round(percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    tabIndex={0}
                >
                    <div
                        className={cn('h-full transition-all', fillToneClass[tone])}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}
        </div>
    );
}
