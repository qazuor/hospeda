/**
 * @file DateRangeFilter.tsx
 * @description Date-range filter for the FilterSidebar. Renders as a compact
 * trigger button (label-like) that opens a floating popover via React portal —
 * the calendar never expands the sidebar's width. Backed by react-day-picker
 * in `mode="range"`. Stores ISO `YYYY-MM-DD` strings (local-day, no TZ shift).
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { enUS as enLocale, es as esLocale, ptBR as ptLocale } from 'react-day-picker/locale';
import { createPortal } from 'react-dom';
import 'react-day-picker/style.css';
import { CalendarDotsIcon } from '@repo/icons';
import styles from './DateRangeFilter.module.css';

/** Configuration for the date-range filter group. */
export interface DateRangeFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'date-range';
    /** Placeholder shown when no check-in is selected. */
    readonly checkInPlaceholder?: string;
    /** Placeholder shown when no check-out is selected. */
    readonly checkOutPlaceholder?: string;
}

interface DateRangeFilterProps {
    readonly config: DateRangeFilterConfig;
    /** Current value as ISO `YYYY-MM-DD` strings (empty when unset). */
    readonly value: { readonly from: string; readonly to: string };
    readonly onChange: (next: { readonly from: string; readonly to: string }) => void;
    readonly locale: SupportedLocale;
}

/** Format a Date as ISO `YYYY-MM-DD` in local time (no TZ shift). */
function toIsoDay(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Parse an ISO `YYYY-MM-DD` into a local-time Date (noon to dodge DST). */
function fromIsoDay(iso: string): Date | undefined {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d, 12);
}

/** Short DD/MM display used in the trigger label. */
function fmtShort(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${d}/${m}`;
}

const CALENDAR_LOCALE_MAP = { es: esLocale, en: enLocale, pt: ptLocale } as const;

/**
 * Date-range picker presented as a thin trigger that opens a floating popover.
 * The popover is rendered to `document.body` via portal so the surrounding
 * sidebar's `overflow` never clips it, and uses fixed positioning anchored to
 * the trigger's bounding rect.
 */
export function DateRangeFilter({ config, value, onChange, locale }: DateRangeFilterProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 320
    });

    const fromDate = value.from ? fromIsoDay(value.from) : undefined;
    const toDate = value.to ? fromIsoDay(value.to) : undefined;
    const range: DateRange | undefined =
        fromDate || toDate ? { from: fromDate, to: toDate } : undefined;

    // Anchor the popover under the trigger; clamp horizontally inside viewport.
    useEffect(() => {
        if (!isOpen || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const POPOVER_WIDTH = 320;
        const margin = 8;
        let left = rect.left;
        const viewportWidth = window.innerWidth;
        if (left + POPOVER_WIDTH + margin > viewportWidth) {
            left = Math.max(margin, viewportWidth - POPOVER_WIDTH - margin);
        }
        setPopoverPos({
            top: rect.bottom + 6,
            left,
            width: POPOVER_WIDTH
        });
    }, [isOpen]);

    // Close on outside click or ESC.
    useEffect(() => {
        if (!isOpen) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (
                triggerRef.current?.contains(e.target as Node) ||
                popoverRef.current?.contains(e.target as Node)
            ) {
                return;
            }
            setIsOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleSelect = useCallback(
        (next: DateRange | undefined) => {
            onChange({
                from: next?.from ? toIsoDay(next.from) : '',
                to: next?.to ? toIsoDay(next.to) : ''
            });
        },
        [onChange]
    );

    const handleClear = useCallback(() => {
        onChange({ from: '', to: '' });
    }, [onChange]);

    const calendarLocale = CALENDAR_LOCALE_MAP[locale] ?? esLocale;
    const defaultClassNames = getDefaultClassNames();
    const today = new Date();

    const triggerLabel = (() => {
        if (fromDate && toDate) return `${fmtShort(fromDate)} – ${fmtShort(toDate)}`;
        if (fromDate) return `${fmtShort(fromDate)} – ${t('ui.filter.dateRange.choose', 'elegir')}`;
        return (
            config.checkInPlaceholder ?? t('ui.filter.dateRange.placeholder', 'Elegí tus fechas')
        );
    })();

    const hasValue = Boolean(fromDate || toDate);

    return (
        <div className={styles.root}>
            <button
                type="button"
                ref={triggerRef}
                className={cn(styles.trigger, hasValue && styles.triggerActive)}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={config.label}
            >
                <span
                    className={styles.triggerIcon}
                    aria-hidden="true"
                >
                    <CalendarDotsIcon
                        size={16}
                        weight="regular"
                    />
                </span>
                <span className={styles.triggerText}>{triggerLabel}</span>
            </button>

            {hasValue && (
                <button
                    type="button"
                    className={styles.clearButton}
                    onClick={handleClear}
                    aria-label={t('ui.filter.dateRange.clear', 'Limpiar fechas')}
                >
                    {t('ui.filter.dateRange.clear', 'Limpiar')}
                </button>
            )}

            {isOpen &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className={styles.popover}
                        // biome-ignore lint/a11y/useSemanticElements: native <dialog> requires open/close lifecycle management incompatible with conditional render
                        role="dialog"
                        aria-label={config.label}
                        style={{
                            top: `${popoverPos.top}px`,
                            left: `${popoverPos.left}px`,
                            width: `${popoverPos.width}px`
                        }}
                    >
                        <DayPicker
                            mode="range"
                            locale={calendarLocale}
                            selected={range}
                            onSelect={handleSelect}
                            numberOfMonths={1}
                            disabled={{ before: today }}
                            defaultMonth={fromDate ?? today}
                            classNames={{
                                root: `${defaultClassNames.root} ${styles.calendarRoot}`,
                                month_caption: `${defaultClassNames.month_caption} ${styles.calendarCaption}`,
                                weekday: `${defaultClassNames.weekday} ${styles.calendarWeekday}`,
                                nav: `${defaultClassNames.nav} ${styles.calendarNav}`,
                                day_button: `${defaultClassNames.day_button} ${styles.calendarDayButton}`,
                                today: `${defaultClassNames.today} ${styles.calendarToday}`,
                                disabled: `${defaultClassNames.disabled} ${styles.calendarDisabled}`
                            }}
                        />
                    </div>,
                    document.body
                )}
        </div>
    );
}
