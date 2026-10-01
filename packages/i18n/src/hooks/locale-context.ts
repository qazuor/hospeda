/**
 * Ambient locale for `useTranslations()`.
 *
 * `useTranslations(locale?)` used to fall back to the hard-coded default locale
 * whenever a caller did not pass one, which is what almost every admin
 * component does. Rather than threading a `locale` argument through hundreds of
 * call sites, an app can mount a {@link LocaleProvider} once and every
 * argument-less `useTranslations()` below it follows the provided locale
 * (HOS-992). An explicit argument still wins, and with no provider mounted (the
 * web app, tests, scripts) behaviour is unchanged.
 */

import { createContext, createElement, type ReactElement, type ReactNode, useContext } from 'react';

const LocaleContext = createContext<string | undefined>(undefined);

/**
 * Props for {@link LocaleProvider}.
 */
export interface LocaleProviderProps {
    /** The locale every argument-less `useTranslations()` below this provider should use. */
    readonly locale: string;
    readonly children?: ReactNode;
}

/**
 * Provides the active locale to `useTranslations()` consumers below it.
 *
 * @param props - {@link LocaleProviderProps}
 * @returns The provider element wrapping `children`.
 */
export const LocaleProvider = ({ locale, children }: LocaleProviderProps): ReactElement =>
    createElement(LocaleContext.Provider, { value: locale }, children);

/**
 * Reads the locale provided by the nearest {@link LocaleProvider}.
 *
 * @returns The provided locale, or `undefined` when no provider is mounted.
 */
export const useProvidedLocale = (): string | undefined => useContext(LocaleContext);
