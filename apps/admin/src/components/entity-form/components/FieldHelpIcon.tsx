import { cn } from '@/lib/utils';

/**
 * Props for FieldHelpIcon component.
 */
export interface FieldHelpIconProps {
    /** The help text to show on hover */
    text: string;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Small inline help icon `(?)` that shows a tooltip on hover.
 *
 * Per spec §4.2 (ruido meta asimétrico): in EDIT mode the field description
 * is moved here instead of appearing as a full paragraph below the label.
 * Only rendered when `text` is non-empty.
 *
 * Uses native `title` attribute for accessibility. No extra JS/dependency needed.
 *
 * @example
 * ```tsx
 * <FieldHelpIcon text="Nombre descriptivo del alojamiento" />
 * ```
 */
export function FieldHelpIcon({ text, className }: FieldHelpIconProps) {
    if (!text) {
        return null;
    }

    return (
        <span
            className={cn(
                'inline-flex h-4 w-4 cursor-help items-center justify-center',
                'rounded-full border border-primary/30 bg-primary/5',
                'font-semibold text-[10px] text-primary/70',
                'align-middle leading-none',
                className
            )}
            title={text}
            aria-label={text}
            role="img"
        >
            ?
        </span>
    );
}
