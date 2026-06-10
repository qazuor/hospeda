/**
 * @file IntentChips.tsx
 * @description Removable filter chips derived from AI-extracted search intent.
 *
 * On mount, reads `sessionStorage.ai_search_chips` (a JSON string of
 * `Partial<AccommodationSearchHttp>`) and renders one chip per structured
 * filter key that has a meaningful display label. Chips for the `q` (raw
 * keyword) key are never rendered.
 *
 * On chip removal:
 *  1. Remove that key from the active params.
 *  2. Update `sessionStorage.ai_search_chips` with the remaining params.
 *  3. Navigate to `/[lang]/alojamientos/` with the updated params via
 *     `window.location.replace` (replaces history entry without full reload).
 *
 * SSR-safe: all `sessionStorage` access is guarded with both a
 * `typeof sessionStorage === 'undefined'` check and a try/catch block
 * (private mode throws SecurityError on access).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CloseIcon } from '@repo/icons';
import type { AccommodationSearchHttp } from '@repo/schemas';
import { useEffect, useState } from 'react';
import styles from './IntentChips.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** sessionStorage key that persists the last AI-extracted params. */
const SESSION_KEY = 'ai_search_chips';

/**
 * Keys from `AccommodationSearchHttp` that can appear as chips.
 * `q` is excluded — it is a raw keyword, not a structured filter.
 *
 * Order here determines render order.
 */
const CHIP_KEYS = [
    'type',
    'minGuests',
    'maxGuests',
    'minPrice',
    'maxPrice',
    'city',
    'destinationId',
    'hasPool',
    'hasWifi',
    'allowsPets',
    'hasParking',
    'amenities',
    'features',
    'checkIn',
    'checkOut',
    'minRating',
    'maxRating',
    'minBedrooms',
    'maxBedrooms',
    'minBathrooms',
    'maxBathrooms'
] as const;

type ChipKey = (typeof CHIP_KEYS)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single rendered chip derived from a structured filter key.
 */
interface ChipDef {
    /** The param key in `AccommodationSearchHttp`. */
    readonly key: ChipKey;
    /** Localised display label, already interpolated with the value. */
    readonly label: string;
}

/**
 * Props for the IntentChips component.
 */
interface IntentChipsProps {
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
    /**
     * URL locale segment used to build the navigation target.
     * Typically the same as `locale` but kept as a separate prop so the
     * caller can pass the raw URL segment without string-type widening.
     */
    readonly lang: string;
}

// ─── sessionStorage helpers ───────────────────────────────────────────────────

/**
 * Read a raw string from sessionStorage safely.
 * Returns `null` when running in SSR context or when access is denied
 * (e.g. private browsing mode).
 */
function readSession(key: string): string | null {
    if (typeof sessionStorage === 'undefined') {
        return null;
    }
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Write a value to sessionStorage safely.
 * Silently no-ops on SSR or when access is denied.
 */
function writeSession(key: string, value: string): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Ignore — private mode or storage quota exceeded.
    }
}

/**
 * Remove a key from sessionStorage safely.
 * Silently no-ops on SSR or when access is denied.
 */
function removeSession(key: string): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    try {
        sessionStorage.removeItem(key);
    } catch {
        // Ignore.
    }
}

// ─── Chip label helpers ───────────────────────────────────────────────────────

type TranslateFn = (fullKey: string, fallback?: string, params?: Record<string, unknown>) => string;

/**
 * Format a date value for chip display (YYYY-MM-DD string or Date object).
 * Returns a short locale-aware date string, falling back to ISO format.
 */
function formatDateValue(value: unknown): string {
    if (!value) {
        return String(value);
    }
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Derive a human-readable label for a chip key and its raw value.
 * Returns `null` when the key should be suppressed (falsy boolean flags,
 * empty arrays, or missing values).
 */
function buildChipLabel({
    key,
    value,
    t
}: {
    readonly key: ChipKey;
    readonly value: unknown;
    readonly t: TranslateFn;
}): string | null {
    // Boolean shortcut amenities: only render when truthy
    const booleanKeys: ReadonlyArray<ChipKey> = ['hasPool', 'hasWifi', 'allowsPets', 'hasParking'];
    if (booleanKeys.includes(key)) {
        const coerced = value === true || value === 'true' || value === '1';
        if (!coerced) {
            return null;
        }
        return t(`aiSearch.chips.${key}`);
    }

    // Array keys: only render when non-empty
    const arrayKeys: ReadonlyArray<ChipKey> = ['amenities', 'features'];
    if (arrayKeys.includes(key)) {
        const arr = Array.isArray(value) ? value : [];
        if (arr.length === 0) {
            return null;
        }
        return t(`aiSearch.chips.${key}`);
    }

    // destinationId has a fixed label (no value interpolation)
    if (key === 'destinationId') {
        if (!value) {
            return null;
        }
        return t('aiSearch.chips.destinationId');
    }

    // Date keys
    if (key === 'checkIn' || key === 'checkOut') {
        if (!value) {
            return null;
        }
        return t(`aiSearch.chips.${key}`, undefined, { value: formatDateValue(value) });
    }

    // Numeric / string keys with {{value}} interpolation
    if (value === null || value === undefined || value === '') {
        return null;
    }

    return t(`aiSearch.chips.${key}`, undefined, { value: String(value) });
}

// ─── Param serialisation ──────────────────────────────────────────────────────

/**
 * Serialise a `Partial<AccommodationSearchHttp>` to a URLSearchParams string.
 * Array values (amenities, features) are emitted as repeated params.
 * Date values are emitted as YYYY-MM-DD strings.
 */
function paramsToSearch(params: Partial<AccommodationSearchHttp>): string {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                usp.append(key, String(item));
            }
        } else if (value instanceof Date) {
            usp.set(key, value.toISOString().split('T')[0] ?? value.toISOString());
        } else {
            usp.set(key, String(value));
        }
    }
    return usp.toString();
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * IntentChips renders removable filter chips derived from an AI-extracted
 * search intent stored in `sessionStorage.ai_search_chips`.
 *
 * The component is purely client-side (reads sessionStorage on mount) and
 * renders nothing during SSR. It does NOT make any API calls.
 *
 * @example
 * ```astro
 * <IntentChips locale={locale} lang={lang} client:visible />
 * ```
 */
export function IntentChips({ locale, lang }: IntentChipsProps) {
    const { t } = createTranslations(locale);
    const [chips, setChips] = useState<ChipDef[]>([]);
    const [params, setParams] = useState<Partial<AccommodationSearchHttp>>({});

    // Read stored params on mount (client-only — no sessionStorage in SSR).
    // `t` is derived from `locale` (prop) and is referentially stable across
    // renders for the same locale — it is safe to include in the deps array
    // without causing infinite loops.
    useEffect(() => {
        const raw = readSession(SESSION_KEY);
        if (!raw) {
            return;
        }

        let parsed: Partial<AccommodationSearchHttp>;
        try {
            parsed = JSON.parse(raw) as Partial<AccommodationSearchHttp>;
        } catch {
            // Malformed JSON — clear stale data and bail
            removeSession(SESSION_KEY);
            return;
        }

        const derived: ChipDef[] = [];
        for (const key of CHIP_KEYS) {
            const value = parsed[key as keyof AccommodationSearchHttp];
            if (value === undefined) {
                continue;
            }
            const label = buildChipLabel({ key, value, t });
            if (label !== null) {
                derived.push({ key, label });
            }
        }

        setParams(parsed);
        setChips(derived);
    }, [t]);

    // Nothing to display
    if (chips.length === 0) {
        return null;
    }

    /**
     * Remove a chip: drop its key from params, persist to sessionStorage,
     * and navigate to the results page with the updated params.
     */
    function handleRemove(key: ChipKey): void {
        const next = { ...params };
        delete next[key as keyof AccommodationSearchHttp];

        const hasRemaining = CHIP_KEYS.some(
            (k) => next[k as keyof AccommodationSearchHttp] !== undefined
        );
        if (hasRemaining) {
            writeSession(SESSION_KEY, JSON.stringify(next));
        } else {
            removeSession(SESSION_KEY);
        }

        const search = paramsToSearch(next);
        const target = search ? `/${lang}/alojamientos/?${search}` : `/${lang}/alojamientos/`;

        window.location.replace(target);
    }

    return (
        <div
            className={styles.root}
            aria-label={t('aiSearch.chips.ariaLabel', 'Filtros aplicados')}
        >
            <ul className={styles.list}>
                {chips.map((chip) => (
                    <li
                        key={chip.key}
                        className={styles.chip}
                    >
                        <span className={styles.chipLabel}>{chip.label}</span>
                        <button
                            type="button"
                            className={styles.removeBtn}
                            aria-label={t(
                                'aiSearch.chips.removeAriaLabel',
                                'Eliminar filtro {{label}}',
                                { label: chip.label }
                            )}
                            onClick={() => handleRemove(chip.key)}
                        >
                            <CloseIcon
                                size={12}
                                aria-hidden="true"
                            />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
