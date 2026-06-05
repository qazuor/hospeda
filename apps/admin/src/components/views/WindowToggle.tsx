/**
 * WindowToggle — compact two-button toggle for selecting a time-window filter.
 *
 * Follows the same visual pattern as DataTableToolbar's table/grid toggle:
 * an `inline-flex overflow-hidden rounded-md border` wrapper with two
 * adjacent <button> elements styled via Tailwind and cn(). The active
 * item gets `bg-primary text-primary-foreground` and data-state="on".
 *
 * No Shadcn ToggleGroup is available in this admin app — this component
 * implements the equivalent pattern natively to stay consistent with the
 * existing codebase.
 */

import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';

/** Supported time-window values. */
export type TimeWindow = '7d' | '30d';

export interface WindowToggleProps {
    /** Currently selected time window. */
    readonly value: TimeWindow;
    /** Called when the user selects a different window. */
    readonly onChange: (window: TimeWindow) => void;
    /** When true both buttons are disabled and clicks are ignored. */
    readonly disabled?: boolean;
}

/**
 * Compact two-button segmented toggle for choosing a time-window filter.
 *
 * @example
 * ```tsx
 * const [window, setWindow] = useState<TimeWindow>('7d');
 * <WindowToggle value={window} onChange={setWindow} />
 * ```
 */
export function WindowToggle({ value, onChange, disabled = false }: WindowToggleProps) {
    const { t } = useTranslations();

    const handleClick = (next: TimeWindow) => {
        if (!disabled) {
            onChange(next);
        }
    };

    return (
        <fieldset
            aria-label={t('common.window.ariaLabel')}
            className="inline-flex overflow-hidden rounded-md border"
        >
            <button
                type="button"
                disabled={disabled}
                aria-pressed={value === '7d'}
                data-state={value === '7d' ? 'on' : 'off'}
                onClick={() => handleClick('7d')}
                className={cn(
                    'inline-flex items-center px-3 py-1.5 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    'disabled:pointer-events-none disabled:opacity-50',
                    value === '7d' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/40'
                )}
            >
                {t('common.window.7d')}
            </button>
            <button
                type="button"
                disabled={disabled}
                aria-pressed={value === '30d'}
                data-state={value === '30d' ? 'on' : 'off'}
                onClick={() => handleClick('30d')}
                className={cn(
                    'inline-flex items-center border-l px-3 py-1.5 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    'disabled:pointer-events-none disabled:opacity-50',
                    value === '30d' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/40'
                )}
            >
                {t('common.window.30d')}
            </button>
        </fieldset>
    );
}
