/**
 * @file LanguageSwitcher.client.tsx
 * @description Segmented control for switching between supported locales.
 *
 * Renders three anchor links (ES / EN / PT) styled as a segmented switch.
 * Clicking a locale dispatches a `preferences:change` CustomEvent so the
 * guest nudge island can react before the navigation happens, then follows
 * the link to the locale-swapped URL. The browser handles the rest.
 *
 * Locale persistence lives in two places:
 *   1. The URL prefix (`/es/...`, authoritative for the request).
 *   2. `localStorage.preferredLocale` as a hint for cross-tab consistency.
 *
 * The query string of the current page is carried over to the target locale
 * (HOS-2559: `/es/mi-cuenta/comercio/?vertical=experience` must switch to
 * `/en/mi-cuenta/comercio/?vertical=experience`, not to the venue list). The
 * server renders the bare path (pages stay session-blind and cacheable); the
 * query is read from `window.location` after hydration and again at click
 * time, because some islands rewrite it with `history.replaceState`.
 *
 * Used in three contexts via the `variant` prop:
 *   - "navbar": condensed pill in the desktop navbar's right zone.
 *   - "menu": full-width row inside dropdown menus (UserMenu, SettingsDropdown).
 *   - "mobile": vertical stack inside the MobileMenu overlay.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './LanguageSwitcher.module.css';

const LOCALES = ['es', 'en', 'pt'] as const;
type LocaleOption = (typeof LOCALES)[number];

const LOCALE_LABELS: Record<LocaleOption, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT'
};

const LOCALE_NAMES: Record<LocaleOption, string> = {
    es: 'Español',
    en: 'English',
    pt: 'Português'
};

export interface LanguageSwitcherProps {
    /** Currently active locale. */
    readonly locale: SupportedLocale;
    /** Current pathname used to build locale-swap URLs (preserves the page). */
    readonly currentPath: string;
    /** Visual layout. Defaults to "navbar". */
    readonly variant?: 'navbar' | 'menu' | 'mobile';
    /** Optional extra classes appended to the root element. */
    readonly className?: string;
}

function buildLocaleUrl({
    currentPath,
    targetLocale,
    search
}: {
    readonly currentPath: string;
    readonly targetLocale: LocaleOption;
    readonly search: string;
}): string {
    const pathWithoutLocale = currentPath.replace(/^\/(es|en|pt)(\/|$)/, '/');
    return `/${targetLocale}${pathWithoutLocale}${search}`;
}

/** Reads the current query string, or `''` outside a browser. */
function readCurrentSearch(): string {
    return typeof window === 'undefined' ? '' : window.location.search;
}

/**
 * LanguageSwitcher - segmented locale control.
 *
 * @example
 * ```tsx
 * <LanguageSwitcher locale={locale} currentPath="/es/alojamientos/" variant="navbar" />
 * ```
 */
export function LanguageSwitcher({
    locale,
    currentPath,
    variant = 'navbar',
    className
}: LanguageSwitcherProps): JSX.Element {
    // Empty on the server and on the first client render so hydration matches.
    const [search, setSearch] = useState('');
    useEffect(() => {
        setSearch(readCurrentSearch());
    }, []);

    const handleSelect = (targetLocale: LocaleOption) => {
        if (targetLocale === locale) return;

        try {
            localStorage.setItem('preferredLocale', targetLocale);
        } catch {
            // Storage may be unavailable (private mode, quota). Ignore.
        }

        window.dispatchEvent(
            new CustomEvent('preferences:change', {
                detail: { kind: 'locale', value: targetLocale }
            })
        );
    };

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is for form controls; this is a group of navigation links rendered as a segmented switch
        <div
            role="group"
            aria-label="Cambiar idioma"
            className={cn(styles.root, styles[`root--${variant}`], className)}
        >
            {LOCALES.map((loc) => (
                /* data-astro-reload: a locale switch is the only navigation that
                   changes the client translation dictionary, which now arrives as
                   a per-locale <head> script (HOS-369 Wave D). A full page load
                   guarantees the destination locale's dictionary is in place
                   before anything hydrates. */
                <a
                    key={loc}
                    href={buildLocaleUrl({ currentPath, targetLocale: loc, search })}
                    onClick={(event) => {
                        // The leave-warning registry claims this click while it asks the
                        // host to confirm leaving. Persist the locale only once the
                        // confirmed click is replayed, so cancelling changes nothing.
                        if (event.defaultPrevented) return;
                        // The query may have been rewritten since mount; the browser
                        // follows the href it reads after the click handlers run.
                        event.currentTarget.setAttribute(
                            'href',
                            buildLocaleUrl({
                                currentPath,
                                targetLocale: loc,
                                search: readCurrentSearch()
                            })
                        );
                        handleSelect(loc);
                    }}
                    className={cn(styles.option, loc === locale && styles.optionActive)}
                    aria-current={loc === locale ? 'true' : undefined}
                    title={LOCALE_NAMES[loc]}
                    data-astro-prefetch
                    data-astro-reload
                >
                    {/* No aria-label: it would replace the visible "EN" with "English",
                        which breaks WCAG 2.5.3 (label in name) for voice-control users
                        who say what they see. The full name is appended as
                        screen-reader-only text instead, so the accessible name is
                        "EN English" and still starts with the visible label. */}
                    {LOCALE_LABELS[loc]}
                    <span
                        className="sr-only"
                        lang={loc}
                    >
                        {` ${LOCALE_NAMES[loc]}`}
                    </span>
                </a>
            ))}
        </div>
    );
}
