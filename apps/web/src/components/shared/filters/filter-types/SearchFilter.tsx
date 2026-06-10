/**
 * @file SearchFilter.tsx
 * @description Text search input for the FilterSidebar. Holds the typed value
 * in LOCAL state and only commits to the parent (which triggers the URL
 * navigation) on `blur` or `Enter`. This prevents the input from losing focus
 * mid-typing when the debounced navigation fires.
 *
 * If the parent's `value` changes externally (e.g. "Limpiar filtros" resets
 * search to ''), the local state syncs automatically.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import styles from './FilterGroupContent.module.css';

interface SearchFilterProps {
    /** Current committed search value (from the global reducer state). */
    readonly value: string;
    /** Called when the user commits the search (blur or Enter). */
    readonly onCommit: (value: string) => void;
    readonly placeholder?: string;
    readonly ariaLabel: string;
    readonly locale: SupportedLocale;
}

/**
 * Search input that defers committing the typed value until the user either
 * presses Enter or moves focus away. Keeps focus stable while typing.
 */
export function SearchFilter({
    value,
    onCommit,
    placeholder,
    ariaLabel,
    locale
}: SearchFilterProps) {
    const { t } = createTranslations(locale);
    const [local, setLocal] = useState(value);
    // Snapshot of the last value we committed upstream. Used to skip redundant
    // commits when blur fires without a real change (avoids loop with the
    // external-value sync effect below).
    const lastCommittedRef = useRef(value);

    // Sync external resets (e.g. CLEAR_ALL) into local state.
    useEffect(() => {
        if (value !== lastCommittedRef.current) {
            setLocal(value);
            lastCommittedRef.current = value;
        }
    }, [value]);

    const commit = () => {
        if (local === lastCommittedRef.current) return;
        lastCommittedRef.current = local;
        onCommit(local);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            // Esc: revert pending input back to last committed value.
            setLocal(lastCommittedRef.current);
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <input
            type="text"
            className={styles.searchInput}
            placeholder={placeholder ?? t('ui.filter.searchPlaceholder', 'Buscar...')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            aria-label={ariaLabel}
        />
    );
}
