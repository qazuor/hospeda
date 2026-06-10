interface WeightBarCellProps {
    /** Numeric weight value (expected range 0-100). */
    readonly value: number | null | undefined;
    /** Track width in pixels. Default 56. */
    readonly trackWidthPx?: number;
}

/**
 * Inline horizontal progress bar for a 0-100 weight value. Bar color shifts
 * `danger` (0-33) → `warning` (34-66) → `success` (67-100) so high-weight rows
 * pop visually while low-weight rows fade. The numeric value is shown right
 * of the track with tabular nums so digits align across rows.
 *
 * Reusable across catalog lists (amenities, features, anything else with a
 * displayWeight-like 0-100 field).
 */
export const WeightBarCell = ({ value, trackWidthPx = 56 }: WeightBarCellProps) => {
    if (value == null || Number.isNaN(value)) {
        return <span className="text-muted-foreground">—</span>;
    }

    const clamped = Math.max(0, Math.min(100, value));
    const colorToken =
        clamped < 34
            ? 'palette-danger-500'
            : clamped < 67
              ? 'palette-warning-500'
              : 'palette-success-500';

    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                className="inline-block h-2.5 overflow-hidden rounded-full bg-muted"
                style={{ width: `${trackWidthPx}px` }}
                aria-hidden="true"
            >
                <span
                    className="block h-full rounded-full transition-all"
                    style={{
                        width: `${clamped}%`,
                        backgroundColor: `var(--${colorToken})`
                    }}
                />
            </span>
            <span className="font-medium text-muted-foreground text-xs tabular-nums">
                {clamped}
            </span>
        </span>
    );
};
