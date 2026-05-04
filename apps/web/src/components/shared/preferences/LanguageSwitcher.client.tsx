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
 * Used in three contexts via the `variant` prop:
 *   - "navbar": condensed pill in the desktop navbar's right zone.
 *   - "menu": full-width row inside dropdown menus (UserMenu, SettingsDropdown).
 *   - "mobile": vertical stack inside the MobileMenu overlay.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import type { JSX } from 'react';
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
    targetLocale
}: {
    readonly currentPath: string;
    readonly targetLocale: LocaleOption;
}): string {
    const pathWithoutLocale = currentPath.replace(/^\/(es|en|pt)(\/|$)/, '/');
    return `/${targetLocale}${pathWithoutLocale}`;
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
                <a
                    key={loc}
                    href={buildLocaleUrl({ currentPath, targetLocale: loc })}
                    onClick={() => handleSelect(loc)}
                    className={cn(styles.option, loc === locale && styles.optionActive)}
                    aria-current={loc === locale ? 'true' : undefined}
                    aria-label={LOCALE_NAMES[loc]}
                    data-astro-prefetch
                >
                    {LOCALE_LABELS[loc]}
                </a>
            ))}
        </div>
    );
}
