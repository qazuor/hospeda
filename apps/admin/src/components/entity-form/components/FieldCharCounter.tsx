import { cn } from '@/lib/utils';

/**
 * Props for FieldCharCounter component.
 */
export interface FieldCharCounterProps {
    /** Current character count */
    current: number;
    /** Maximum allowed characters. Counter is not rendered if undefined. */
    max?: number;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Displays an inline character counter in `actual / max` format.
 *
 * Rendered as a small muted label aligned to the right of its container.
 * Turns destructive color when the current count equals or exceeds the max.
 *
 * Per spec §4.2: metadata = signal, not decoration. Only rendered when `max`
 * is provided (extracted from typeConfig.maxLength, not hardcoded per field).
 *
 * @example
 * ```tsx
 * <FieldCharCounter current={value.length} max={300} />
 * // renders: "178 / 300"
 * ```
 */
export function FieldCharCounter({ current, max, className }: FieldCharCounterProps) {
    if (max === undefined || max === null) {
        return null;
    }

    const isOverLimit = current >= max;

    return (
        <span
            className={cn(
                'block text-right text-xs',
                isOverLimit ? 'text-destructive' : 'text-muted-foreground',
                className
            )}
            aria-live="polite"
            aria-label={`${current} de ${max} caracteres`}
        >
            {current} / {max}
        </span>
    );
}
