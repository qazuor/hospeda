/**
 * Applies the account's saved admin-panel language to the panel's copy (HOS-992).
 *
 * The preferences page has always persisted `settings.languageAdmin`, but nothing
 * ever read it back: `useTranslations()` fell back to Spanish everywhere. This
 * provider is the reader. It derives the active locale from two sources, in order:
 *
 * 1. the live user profile (`useUserProfile`) - so saving a new language on the
 *    preferences page re-renders the panel at once (the settings mutation writes
 *    the updated profile into the query cache), and a reload after a save is never
 *    stale even though the session cookie cache can lag by minutes;
 * 2. the value the server read off the session (`initialLanguage`) - used until the
 *    profile arrives, which is what lets the server render already be in the right
 *    language instead of flashing Spanish first.
 *
 * With no saved preference the panel stays on the configured default locale, the
 * same value the preferences page shows as selected.
 *
 * @module admin-locale-context
 */

import { LocaleProvider, resolveDisplayLocale } from '@repo/i18n';
import type { UserSettings } from '@repo/schemas';
import { type ReactNode, useEffect } from 'react';
import { env } from '@/env';
import { useUserProfile } from '@/hooks/use-user-profile';
import { getSupportedLocales } from '@/lib/locale';

/**
 * Arguments for {@link resolveAdminLocale}.
 */
export interface ResolveAdminLocaleArgs {
    /** Settings of the live user profile, when it has loaded. */
    readonly profileSettings?: Pick<UserSettings, 'languageAdmin' | 'language'> | null;
    /** Admin language the server read off the session, used until the profile loads. */
    readonly initialLanguage?: string | null;
    readonly supportedLocales: readonly string[];
    readonly defaultLocale: string;
}

/**
 * Resolves the locale the admin panel should render in.
 *
 * A stored value that is not a supported locale is ignored (falls to the default)
 * rather than producing a partly-untranslated panel.
 *
 * @param args - {@link ResolveAdminLocaleArgs}
 * @returns The locale code to render the panel in.
 */
export const resolveAdminLocale = ({
    profileSettings,
    initialLanguage,
    supportedLocales,
    defaultLocale
}: ResolveAdminLocaleArgs): string => {
    const fromProfile = profileSettings
        ? (profileSettings.languageAdmin ?? profileSettings.language)
        : null;
    const { locale } = resolveDisplayLocale({
        accountLocale: fromProfile ?? initialLanguage ?? null,
        supportedLocales,
        defaultLocale
    });
    return locale;
};

/**
 * Props for {@link AdminLocaleProvider}.
 */
export interface AdminLocaleProviderProps {
    /** The signed-in user's id, used to read the live profile. */
    readonly userId: string | undefined;
    /** Admin language read off the session on the server, if any. */
    readonly initialLanguage: string | null;
    readonly children: ReactNode;
}

/**
 * Makes every argument-less `useTranslations()` below it follow the account's
 * saved admin-panel language.
 *
 * @param props - {@link AdminLocaleProviderProps}
 * @returns The children wrapped in the locale provider.
 */
export function AdminLocaleProvider({
    userId,
    initialLanguage,
    children
}: AdminLocaleProviderProps) {
    const { data: profile } = useUserProfile({ userId });
    const locale = resolveAdminLocale({
        profileSettings: profile?.settings,
        initialLanguage,
        supportedLocales: getSupportedLocales(),
        defaultLocale: env.VITE_DEFAULT_LOCALE
    });

    // The root route renders <html lang> from the default locale, so once the
    // panel speaks another language the document must say so too (screen readers,
    // hyphenation, browser translate prompts).
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}
