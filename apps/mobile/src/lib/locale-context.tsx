/**
 * @file locale-context.tsx
 * @description React context for runtime locale switching (SPEC-243 T-052).
 *
 * Persists the selected locale to `expo-secure-store` under the key
 * `'hospeda_locale'`. On mount the stored value is read and applied; if
 * absent, the context falls back to `appDefaultLocale` ('es').
 *
 * ## Why SecureStore?
 * The auth client already stores session data in SecureStore (same prefix
 * 'hospeda'). Reusing the same storage layer avoids adding AsyncStorage as
 * a dependency and keeps persisted state in one place.
 *
 * @module lib/locale-context
 */

import type { Locale } from '@repo/i18n';
import * as SecureStore from 'expo-secure-store';
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { appDefaultLocale, supportedLocales } from './i18n';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

/** SecureStore key for the persisted locale preference. */
const LOCALE_STORAGE_KEY = 'hospeda_locale';

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

/**
 * Value provided by `LocaleContext`.
 *
 * @property locale    - Currently active locale code ('es' | 'en' | 'pt').
 * @property setLocale - Persist and apply a new locale immediately.
 */
export interface LocaleContextValue {
    readonly locale: Locale;
    readonly setLocale: (locale: Locale) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Props for `LocaleProvider`. */
interface LocaleProviderProps {
    readonly children: ReactNode;
}

/**
 * Provides the runtime locale to the entire component tree.
 *
 * On mount, reads the persisted locale from SecureStore. When `setLocale` is
 * called it persists the value and triggers a re-render — all components that
 * call `useLocale()` re-render with the new locale immediately.
 *
 * @param children - The subtree to wrap (typically the entire app).
 *
 * @example
 * ```tsx
 * // app/_layout.tsx
 * <LocaleProvider>
 *   <QueryClientProvider client={queryClient}>
 *     <Stack />
 *   </QueryClientProvider>
 * </LocaleProvider>
 * ```
 */
export function LocaleProvider({ children }: LocaleProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(appDefaultLocale);

    // Read persisted locale on mount
    useEffect(() => {
        void (async () => {
            try {
                const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
                if (stored && (supportedLocales as readonly string[]).includes(stored)) {
                    setLocaleState(stored as Locale);
                }
            } catch {
                // Ignore SecureStore errors — fall back to default locale
            }
        })();
    }, []);

    /**
     * Persists the new locale to SecureStore and updates React state.
     * The state update triggers a re-render of all `useLocale()` consumers.
     */
    const setLocale = (newLocale: Locale): void => {
        setLocaleState(newLocale);
        void SecureStore.setItemAsync(LOCALE_STORAGE_KEY, newLocale).catch(() => {
            // Ignore persist errors — in-memory state is still updated
        });
    };

    return (
        <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current locale and the setter from the nearest `LocaleProvider`.
 *
 * Must be called inside `LocaleProvider` — throws if used outside it.
 *
 * @returns `{ locale, setLocale }` from the context.
 *
 * @example
 * ```tsx
 * const { locale, setLocale } = useLocale();
 * const t = (key: string) => getTranslation(key, locale);
 * ```
 */
export function useLocale(): LocaleContextValue {
    const ctx = useContext(LocaleContext);
    if (!ctx) {
        throw new Error('useLocale must be used within a LocaleProvider');
    }
    return ctx;
}
