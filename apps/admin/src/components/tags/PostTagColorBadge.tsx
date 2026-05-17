import type { TagColorEnum } from '@repo/schemas';

/** Maps TagColorEnum values to Tailwind background colors. */
const COLOR_CLASS_MAP: Readonly<Record<string, string>> = {
    RED: 'bg-red-500',
    BLUE: 'bg-blue-500',
    GREEN: 'bg-green-500',
    YELLOW: 'bg-yellow-400',
    ORANGE: 'bg-orange-500',
    PURPLE: 'bg-purple-500',
    PINK: 'bg-pink-500',
    GREY: 'bg-gray-400',
    CYAN: 'bg-cyan-500',
    LIGHT_BLUE: 'bg-sky-300',
    LIGHT_GREEN: 'bg-emerald-300'
} as const;

interface PostTagColorBadgeProps {
    /** TagColorEnum value (e.g. "RED", "BLUE"). */
    readonly color: string | typeof TagColorEnum;
    /** Optional label text shown next to the swatch. */
    readonly label?: string;
    /** Additional CSS classes for the wrapper. */
    readonly className?: string;
}

/**
 * Renders a visual color swatch circle for a PostTag color value.
 * Optionally renders a label beside the swatch.
 *
 * Used in:
 * - PostTag list table (color column)
 * - PostTagForm color picker preview
 *
 * @param color - TagColorEnum string value
 * @param label - Optional text label beside the swatch
 * @param className - Optional extra CSS classes on the wrapper
 */
export function PostTagColorBadge({ color, label, className = '' }: PostTagColorBadgeProps) {
    const colorClass = COLOR_CLASS_MAP[color as string] ?? 'bg-gray-300';

    return (
        <span
            // role="img" is required so aria-label is permitted on a span (axe
            // aria-prohibited-attr otherwise flags it). The decorative swatch
            // below stays aria-hidden so screen readers only announce the label.
            role="img"
            className={`inline-flex items-center gap-1.5 ${className}`}
            aria-label={label ? `Color: ${label}` : `Color: ${color}`}
        >
            <span
                className={`inline-block h-4 w-4 rounded-full ${colorClass} flex-shrink-0 border border-black/10`}
                aria-hidden="true"
            />
            {label && <span className="text-muted-foreground text-sm">{label}</span>}
        </span>
    );
}
