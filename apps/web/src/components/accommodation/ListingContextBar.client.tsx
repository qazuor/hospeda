/**
 * @file ListingContextBar.client.tsx
 * @description Editable context bar shown ABOVE the accommodations grid that
 * surfaces the trip context (check-in, check-out, adults, children).
 *
 * These three fields used to live inside the FilterSidebar, but they don't
 * actually filter the listing — the app has no availability system so the
 * dates/guests context is forwarded to the contact form on the detail page.
 * Exposing them as filters misled users into thinking the result set was
 * narrowed by date / capacity. The context bar makes the role explicit
 * ("este es el contexto de tu viaje") and keeps the values one click away.
 *
 * On change, the component updates the URL (debounced, same UX as the
 * FilterSidebar) so the values survive navigations + are forwarded to the
 * accommodation detail link via `linkQuery`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CalendarIcon, UserIcon, UsersIcon, XCircleIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFilterDebounce } from '../shared/filters/hooks/useFilterDebounce';
import styles from './ListingContextBar.module.css';

interface ListingContextBarProps {
    readonly locale: SupportedLocale;
    /** ISO `yyyy-mm-dd`. Empty string = unset. */
    readonly initialCheckIn?: string;
    readonly initialCheckOut?: string;
    /** Default 2 / 0 if not provided. */
    readonly initialAdults?: number;
    readonly initialChildren?: number;
}

const ADULTS_MIN = 1;
const ADULTS_MAX = 10;
const CHILDREN_MIN = 0;
const CHILDREN_MAX = 6;

export function ListingContextBar({
    locale,
    initialCheckIn = '',
    initialCheckOut = '',
    initialAdults = 2,
    initialChildren = 0
}: ListingContextBarProps) {
    const { t } = createTranslations(locale);
    const { debouncedNavigate } = useFilterDebounce();
    const isInitialRender = useRef(true);

    const [checkIn, setCheckIn] = useState(initialCheckIn);
    const [checkOut, setCheckOut] = useState(initialCheckOut);
    const [adults, setAdults] = useState(initialAdults);
    const [childrenCount, setChildrenCount] = useState(initialChildren);

    // Debounced URL sync on any context field change. Skips the initial
    // mount so we don't immediately re-navigate to the same URL we just
    // arrived from. Reads the current URL so we don't accidentally drop
    // filter params from the sidebar.
    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }
        const params = new URLSearchParams(window.location.search);
        if (checkIn) params.set('checkIn', checkIn);
        else params.delete('checkIn');
        if (checkOut) params.set('checkOut', checkOut);
        else params.delete('checkOut');
        params.set('adults', String(adults));
        params.set('children', String(childrenCount));
        debouncedNavigate(params);
    }, [checkIn, checkOut, adults, childrenCount, debouncedNavigate]);

    const clearAll = useCallback(() => {
        setCheckIn('');
        setCheckOut('');
        setAdults(2);
        setChildrenCount(0);
    }, []);

    const hasContext = Boolean(checkIn || checkOut) || adults !== 2 || childrenCount !== 0;

    return (
        <fieldset
            className={styles.contextBar}
            aria-label={t('accommodations.contextBar.ariaLabel', 'Contexto de tu viaje')}
        >
            <div className={styles.field}>
                <CalendarIcon
                    size={16}
                    weight="duotone"
                    aria-hidden="true"
                />
                <label className={styles.fieldLabel}>
                    <span className={styles.fieldLabelText}>
                        {t('accommodations.contextBar.dates', 'Fechas')}
                    </span>
                    <input
                        type="date"
                        className={styles.dateInput}
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        placeholder={t('accommodations.contextBar.checkIn', 'Llegada')}
                        aria-label={t('accommodations.contextBar.checkIn', 'Llegada')}
                    />
                    <span
                        className={styles.dateSeparator}
                        aria-hidden="true"
                    >
                        →
                    </span>
                    <input
                        type="date"
                        className={styles.dateInput}
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || undefined}
                        placeholder={t('accommodations.contextBar.checkOut', 'Salida')}
                        aria-label={t('accommodations.contextBar.checkOut', 'Salida')}
                    />
                </label>
            </div>

            <StepperField
                icon={
                    <UserIcon
                        size={16}
                        weight="duotone"
                        aria-hidden="true"
                    />
                }
                label={t('accommodations.contextBar.adults', 'Adultos')}
                value={adults}
                min={ADULTS_MIN}
                max={ADULTS_MAX}
                onChange={setAdults}
            />

            <StepperField
                icon={
                    <UsersIcon
                        size={16}
                        weight="duotone"
                        aria-hidden="true"
                    />
                }
                label={t('accommodations.contextBar.children', 'Niños')}
                value={childrenCount}
                min={CHILDREN_MIN}
                max={CHILDREN_MAX}
                onChange={setChildrenCount}
            />

            {hasContext && (
                <button
                    type="button"
                    className={styles.clearButton}
                    onClick={clearAll}
                    aria-label={t('accommodations.contextBar.clear', 'Limpiar contexto')}
                >
                    <XCircleIcon
                        size={14}
                        weight="bold"
                        aria-hidden="true"
                    />
                    <span>{t('accommodations.contextBar.clear', 'Limpiar')}</span>
                </button>
            )}
        </fieldset>
    );
}

interface StepperFieldProps {
    readonly icon: React.ReactNode;
    readonly label: string;
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly onChange: (value: number) => void;
}

function StepperField({ icon, label, value, min, max, onChange }: StepperFieldProps) {
    const decrement = () => onChange(Math.max(min, value - 1));
    const increment = () => onChange(Math.min(max, value + 1));
    const canDecrement = value > min;
    const canIncrement = value < max;
    return (
        <div className={styles.field}>
            {icon}
            <span className={styles.fieldLabelText}>{label}</span>
            <div className={styles.stepper}>
                <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={decrement}
                    disabled={!canDecrement}
                    aria-label={`${label} −`}
                >
                    −
                </button>
                <span className={styles.stepperValue}>{value}</span>
                <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={increment}
                    disabled={!canIncrement}
                    aria-label={`${label} +`}
                >
                    +
                </button>
            </div>
        </div>
    );
}
