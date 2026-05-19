/**
 * @file BetaSearch.client.tsx
 * @description Fuzzy search island for the beta docs site.
 *
 * Lazy-loads `/beta/search-index.json` on first user interaction, then uses
 * Fuse.js to score matches across title, description, section and body.
 * Keyboard-friendly: Ctrl/Cmd-K to open, arrow keys to move, Enter to navigate,
 * Esc to close.
 */

import Fuse from 'fuse.js';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './BetaSearch.module.css';

interface SearchEntry {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly role: string;
    readonly section: string;
    readonly url: string;
    readonly body: string;
}

interface BetaSearchProps {
    readonly placeholder?: string;
}

const FUSE_OPTIONS: ConstructorParameters<typeof Fuse<SearchEntry>>[1] = {
    keys: [
        { name: 'title', weight: 0.5 },
        { name: 'description', weight: 0.3 },
        { name: 'section', weight: 0.1 },
        { name: 'body', weight: 0.1 }
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2
};

export function BetaSearch({ placeholder = 'Buscar en la documentación…' }: BetaSearchProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [entries, setEntries] = useState<SearchEntry[]>([]);
    const [loaded, setLoaded] = useState(false);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const resultsRef = useRef<HTMLDivElement | null>(null);

    const fuse = useMemo(() => new Fuse(entries, FUSE_OPTIONS), [entries]);

    const loadIndex = useCallback(async () => {
        if (loaded) return;
        try {
            const response = await fetch('/beta/search-index.json');
            if (!response.ok) return;
            const data = (await response.json()) as SearchEntry[];
            setEntries(data);
            setLoaded(true);
        } catch {
            // Search degrades to "no results" rather than crashing the page.
        }
    }, [loaded]);

    const openDialog = useCallback(() => {
        setOpen(true);
        void loadIndex();
    }, [loadIndex]);

    const closeDialog = useCallback(() => {
        setOpen(false);
        setQuery('');
        setActive(0);
    }, []);

    useEffect(() => {
        function onKeyDown(event: globalThis.KeyboardEvent) {
            const isModK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
            if (isModK) {
                event.preventDefault();
                openDialog();
            } else if (event.key === 'Escape' && open) {
                closeDialog();
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, openDialog, closeDialog]);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    const results = useMemo(() => {
        if (!query.trim()) {
            return entries.slice(0, 8);
        }
        return fuse.search(query, { limit: 12 }).map((match) => match.item);
    }, [query, fuse, entries]);

    function onQueryChange(event: ChangeEvent<HTMLInputElement>) {
        setQuery(event.target.value);
        setActive(0);
    }

    function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((prev) => Math.min(prev + 1, results.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((prev) => Math.max(prev - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const target = results[active];
            if (target) {
                window.location.href = target.url;
            }
        }
    }

    function onOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            closeDialog();
        }
    }

    return (
        <div className={styles.root}>
            <button
                type="button"
                className={styles.trigger}
                onClick={openDialog}
                aria-label="Abrir búsqueda"
            >
                <svg
                    className={styles.triggerIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                >
                    <circle
                        cx="11"
                        cy="11"
                        r="7"
                    />
                    <path d="M21 21l-4.3-4.3" />
                </svg>
                <span className={styles.triggerLabel}>Buscar…</span>
                <kbd className={styles.triggerKbd}>⌘K</kbd>
            </button>

            {open && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled globally via window keydown; backdrop click is a mouse-only convenience
                <div
                    className={styles.overlay}
                    onClick={onOverlayClick}
                >
                    <dialog
                        open
                        className={styles.dialog}
                        aria-modal="true"
                        aria-label="Buscar en la documentación"
                    >
                        <input
                            ref={inputRef}
                            type="search"
                            value={query}
                            onChange={onQueryChange}
                            onKeyDown={onInputKeyDown}
                            placeholder={placeholder}
                            className={styles.input}
                            autoComplete="off"
                            spellCheck={false}
                        />

                        <div
                            className={styles.results}
                            ref={resultsRef}
                        >
                            {results.length === 0 && (
                                <p className={styles.empty}>
                                    {loaded
                                        ? `Nada encontró para “${query}”. Probá con otra palabra.`
                                        : 'Cargando índice…'}
                                </p>
                            )}
                            {results.map((entry, index) => {
                                const isFaq = entry.role === 'faq';
                                return (
                                    <a
                                        key={entry.id}
                                        href={entry.url}
                                        className={`${styles.result} ${
                                            index === active ? styles.resultActive : ''
                                        }`}
                                        onMouseEnter={() => setActive(index)}
                                    >
                                        <div className={styles.resultHeader}>
                                            <span className={styles.resultTitle}>
                                                {entry.title}
                                            </span>
                                            <span
                                                className={`${styles.resultBadge} ${
                                                    isFaq ? styles.resultBadgeFaq : ''
                                                }`}
                                            >
                                                {entry.role}
                                            </span>
                                        </div>
                                        {entry.description && (
                                            <span className={styles.resultDescription}>
                                                {entry.description}
                                            </span>
                                        )}
                                    </a>
                                );
                            })}
                        </div>

                        <div className={styles.footer}>
                            <span>
                                <kbd className={styles.footerKbd}>↑↓</kbd> moverte
                            </span>
                            <span>
                                <kbd className={styles.footerKbd}>↵</kbd> abrir
                            </span>
                            <span>
                                <kbd className={styles.footerKbd}>Esc</kbd> cerrar
                            </span>
                        </div>
                    </dialog>
                </div>
            )}
        </div>
    );
}
