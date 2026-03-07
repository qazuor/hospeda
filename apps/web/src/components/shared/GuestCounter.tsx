import { DEFAULT_LOCALE, createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
/**
 * @file GuestCounter.tsx
 * @description Stepper control for incrementing/decrementing guest counts.
 * Used within the HeroSearchForm guests popover for adults and children fields.
 * Includes accessible aria-labels and disabled state at min/max bounds.
 */
import { AddIcon, MinusIcon } from '@repo/icons';

/**
 * Props for the GuestCounter component.
 * @property label - Primary label text (e.g. "Adults", "Children")
 * @property sublabel - Secondary description text (e.g. "13 years or older")
 * @property value - Current counter value
 * @property onIncrement - Callback fired when the + button is clicked
 * @property onDecrement - Callback fired when the - button is clicked
 * @property min - Minimum allowed value (decrement button disables at this value)
 * @property locale - Current locale for translating button aria-labels
 */
interface GuestCounterProps {
    /** Primary label text (e.g. "Adults") */
    readonly label: string;
    /** Secondary description text (e.g. "13 years or older") */
    readonly sublabel: string;
    /** Current counter value */
    readonly value: number;
    /** Callback when increment button is clicked */
    readonly onIncrement: () => void;
    /** Callback when decrement button is clicked */
    readonly onDecrement: () => void;
    /** Minimum allowed value (decrement disables at this bound) */
    readonly min?: number;
    /** Current locale for button aria-labels */
    readonly locale?: SupportedLocale;
}

/**
 * Stepper control for selecting guest count with accessible aria-labels.
 * Renders a label/sublabel pair with -/+ buttons and a live count display.
 *
 * @param props - GuestCounter props
 * @returns JSX element with stepper controls
 */
export function GuestCounter({
    label,
    sublabel,
    value,
    onIncrement,
    onDecrement,
    min = 0,
    locale = DEFAULT_LOCALE
}: GuestCounterProps) {
    const t = createT(locale);
    return (
        <div className="flex items-center justify-between py-2">
            <div>
                <p className="font-medium text-foreground text-sm">{label}</p>
                <p className="text-muted-foreground text-xs">{sublabel}</p>
            </div>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onDecrement}
                    disabled={value <= min}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`${t('home.searchBar.decrease', 'Reducir')} ${label}`}
                >
                    <MinusIcon size={14} />
                </button>
                <output
                    className="w-6 text-center font-medium text-foreground text-sm"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {value}
                </output>
                <button
                    type="button"
                    onClick={onIncrement}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
                    aria-label={`${t('home.searchBar.increase', 'Agregar')} ${label}`}
                >
                    <AddIcon size={14} />
                </button>
            </div>
        </div>
    );
}
