/**
 * @file DateRangeFilter.tsx
 * @description Date-range filter for the FilterSidebar. Two layout modes:
 *
 * - `mode='range'` (default): one trigger button that opens a single popover
 *   with react-day-picker in range mode. Best for cohesive ranges like
 *   check-in/check-out.
 * - `mode='bounds'`: two side-by-side triggers, each with its own single-mode
 *   popover. Lets the user fill only "desde", only "hasta", both, or none —
 *   used by listings where partial bounds are meaningful (e.g. events).
 *
 * Stores ISO `YYYY-MM-DD` strings (local-day, no TZ shift).
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
    /**
     * URL param name for the start of the range. Defaults to `'checkIn'`
     * (used by accommodations). Set to e.g. `'startDateAfter'` for events.
     */
    readonly fromParam?: string;
    /**
     * URL param name for the end of the range. Defaults to `'checkOut'`
     * (used by accommodations). Set to e.g. `'startDateBefore'` for events.
     */
    readonly toParam?: string;
    /**
     * Picker layout.
     *
     * - `'range'` (default): single popover with DayPicker in range mode. Best
     *   for cohesive ranges (e.g. check-in/check-out).
     * - `'bounds'`: two side-by-side triggers, each with its own single-mode
     *   DayPicker. Lets users pick only "desde", only "hasta", both, or none.
     */
    readonly mode?: 'range' | 'bounds';
    /**
     * Whether to allow selecting past dates. Defaults to `false` (only today
     * and future). Set to `true` for listings where past dates are meaningful
     * (e.g. event history).
     */
    readonly allowPastDates?: boolean;
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
 * Anchored popover positioning shared between range and bounds modes.
 * Re-anchors on scroll / window resize so the popover follows the trigger.
 */
function usePopoverPosition(
    isOpen: boolean,
    triggerRef: React.RefObject<HTMLButtonElement | null>
) {
    const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 320
    });
    useEffect(() => {
        if (!isOpen || !triggerRef.current) return;

        const update = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const rect = trigger.getBoundingClientRect();
            const POPOVER_WIDTH = 320;
            const margin = 8;
            let left = rect.left;
            const viewportWidth = window.innerWidth;
            if (left + POPOVER_WIDTH + margin > viewportWidth) {
                left = Math.max(margin, viewportWidth - POPOVER_WIDTH - margin);
            }
            setPos({ top: rect.bottom + 6, left, width: POPOVER_WIDTH });
        };

        update();
        // Use capture phase so we catch scroll on ANY ancestor scroll container
        // (the sidebar body, the page <html>, etc), not just the document.
        window.addEventListener('scroll', update, { capture: true, passive: true });
        window.addEventListener('resize', update, { passive: true });
        return () => {
            window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
            window.removeEventListener('resize', update);
        };
    }, [isOpen, triggerRef]);
    return pos;
}

/** Closes the popover on outside click or ESC. */
function useDismiss(
    isOpen: boolean,
    onClose: () => void,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
    popoverRef: React.RefObject<HTMLDivElement | null>
) {
    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (
                triggerRef.current?.contains(e.target as Node) ||
                popoverRef.current?.contains(e.target as Node)
            ) {
                return;
            }
            onClose();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose, triggerRef, popoverRef]);
}

/** Calendar classNames shared by both render modes. */
function useCalendarClassNames() {
    const defaults = getDefaultClassNames();
    return {
        root: `${defaults.root} ${styles.calendarRoot}`,
        month_caption: `${defaults.month_caption} ${styles.calendarCaption}`,
        weekday: `${defaults.weekday} ${styles.calendarWeekday}`,
        nav: `${defaults.nav} ${styles.calendarNav}`,
        day_button: `${defaults.day_button} ${styles.calendarDayButton}`,
        today: `${defaults.today} ${styles.calendarToday}`,
        disabled: `${defaults.disabled} ${styles.calendarDisabled}`
    };
}

interface SingleBoundProps {
    readonly label: string;
    readonly placeholder: string;
    readonly selected?: Date;
    readonly onSelect: (date: Date | undefined) => void;
    readonly locale: SupportedLocale;
    readonly disabledMatcher?: import('react-day-picker').Matcher;
    readonly defaultMonth?: Date;
    /** Label shown on the "clear" button inside the popover. */
    readonly clearLabel: string;
}

/**
 * Single-date trigger button + popover. Used inside `mode='bounds'` to render
 * two independent date pickers (Desde + Hasta) side by side.
 */
function SingleBoundPicker({
    label,
    placeholder,
    selected,
    onSelect,
    locale,
    disabledMatcher,
    defaultMonth,
    clearLabel
}: SingleBoundProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const pos = usePopoverPosition(isOpen, triggerRef);
    useDismiss(isOpen, () => setIsOpen(false), triggerRef, popoverRef);

    const calendarLocale = CALENDAR_LOCALE_MAP[locale] ?? esLocale;
    const classNames = useCalendarClassNames();

    const triggerLabel = selected ? fmtShort(selected) : placeholder;
    const hasValue = !!selected;

    const handlePick = useCallback(
        (date: Date | undefined) => {
            onSelect(date);
            // Close immediately when a date is picked (or cleared).
            setIsOpen(false);
        },
        [onSelect]
    );

    return (
        <div className={styles.boundCol}>
            <button
                type="button"
                ref={triggerRef}
                className={cn(
                    styles.trigger,
                    styles.triggerBound,
                    hasValue && styles.triggerActive
                )}
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={label}
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
            {isOpen &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className={styles.popover}
                        // biome-ignore lint/a11y/useSemanticElements: native <dialog> requires open/close lifecycle management incompatible with conditional render
                        role="dialog"
                        aria-label={label}
                        style={{
                            top: `${pos.top}px`,
                            left: `${pos.left}px`,
                            width: `${pos.width}px`
                        }}
                    >
                        <DayPicker
                            mode="single"
                            locale={calendarLocale}
                            selected={selected}
                            onSelect={handlePick}
                            numberOfMonths={1}
                            disabled={disabledMatcher}
                            defaultMonth={defaultMonth ?? selected ?? new Date()}
                            classNames={classNames}
                        />
                        {hasValue && (
                            <div className={styles.popoverFooter}>
                                <button
                                    type="button"
                                    className={styles.popoverClearBtn}
                                    onClick={() => handlePick(undefined)}
                                >
                                    {clearLabel}
                                </button>
                            </div>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
}

/**
 * Date-range / date-bounds picker. Branches on `config.mode`.
 */
export function DateRangeFilter({ config, value, onChange, locale }: DateRangeFilterProps) {
    const { t } = createTranslations(locale);
    const mode = config.mode ?? 'range';

    const fromDate = value.from ? fromIsoDay(value.from) : undefined;
    const toDate = value.to ? fromIsoDay(value.to) : undefined;

    const today = new Date();
    const beforeToday = config.allowPastDates ? undefined : { before: today };

    // ----- Bounds mode: two independent triggers + popovers ---------------
    if (mode === 'bounds') {
        const fromPickerDisabled = (() => {
            // "Desde" cannot be after "Hasta" if both are set.
            if (toDate) {
                return { after: toDate };
            }
            return beforeToday;
        })();
        const toPickerDisabled = (() => {
            // "Hasta" cannot be before "Desde" if both are set.
            if (fromDate) {
                return { before: fromDate };
            }
            return beforeToday;
        })();

        const fromPlaceholder = config.checkInPlaceholder ?? t('ui.filter.dateRange.from', 'Desde');
        const toPlaceholder = config.checkOutPlaceholder ?? t('ui.filter.dateRange.to', 'Hasta');
        return (
            <div className={styles.boundsRoot}>
                <SingleBoundPicker
                    label={`${config.label} desde`}
                    placeholder={fromPlaceholder}
                    selected={fromDate}
                    onSelect={(date) =>
                        onChange({
                            from: date ? toIsoDay(date) : '',
                            to: value.to
                        })
                    }
                    locale={locale}
                    disabledMatcher={fromPickerDisabled}
                    defaultMonth={fromDate ?? toDate ?? today}
                    clearLabel={t('ui.filter.dateRange.clearFrom', `Limpiar "${fromPlaceholder}"`)}
                />
                <SingleBoundPicker
                    label={`${config.label} hasta`}
                    placeholder={toPlaceholder}
                    selected={toDate}
                    onSelect={(date) =>
                        onChange({
                            from: value.from,
                            to: date ? toIsoDay(date) : ''
                        })
                    }
                    locale={locale}
                    disabledMatcher={toPickerDisabled}
                    defaultMonth={toDate ?? fromDate ?? today}
                    clearLabel={t('ui.filter.dateRange.clearTo', `Limpiar "${toPlaceholder}"`)}
                />
            </div>
        );
    }

    // ----- Range mode (default): single trigger with DayPicker range -----
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const pos = usePopoverPosition(isOpen, triggerRef);
    useDismiss(isOpen, () => setIsOpen(false), triggerRef, popoverRef);
    const classNames = useCalendarClassNames();
    const calendarLocale = CALENDAR_LOCALE_MAP[locale] ?? esLocale;

    const range: DateRange | undefined =
        fromDate || toDate ? { from: fromDate, to: toDate } : undefined;

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

    const triggerLabel = (() => {
        if (fromDate && toDate) return `${fmtShort(fromDate)} – ${fmtShort(toDate)}`;
        if (fromDate) return `${fmtShort(fromDate)} – ${t('ui.filter.dateRange.choose', 'elegir')}`;
        if (toDate) return `${t('ui.filter.dateRange.choose', 'elegir')} – ${fmtShort(toDate)}`;
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
                            top: `${pos.top}px`,
                            left: `${pos.left}px`,
                            width: `${pos.width}px`
                        }}
                    >
                        <DayPicker
                            mode="range"
                            locale={calendarLocale}
                            selected={range}
                            onSelect={handleSelect}
                            numberOfMonths={1}
                            disabled={beforeToday}
                            defaultMonth={fromDate ?? today}
                            classNames={classNames}
                        />
                    </div>,
                    document.body
                )}
        </div>
    );
}
