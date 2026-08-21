/**
 * Add-on checkout copy localization (HOS-606).
 *
 * `AddonDefinition.name` / `.description` (the static catalog in
 * `@repo/billing`'s `addons.config.ts`) are English config literals by
 * convention — see `packages/billing/CLAUDE.md`: "Config names and
 * descriptions always in English (UI localization handled by i18n)". The web
 * app never renders these raw strings: it resolves the buyer-facing copy by
 * slug via `account.addons.catalog.<slug>.name` / `.description` in
 * `@repo/i18n` (see `apps/web/src/lib/addon-labels.ts`).
 *
 * `createAddonCheckout` (`addon.checkout.ts`) sent the raw English config
 * values straight through as the MercadoPago checkout line item `title` /
 * `description` instead of going through that same lookup, so a buyer on the
 * Spanish site saw the add-on's name in ENGLISH on the final MercadoPago
 * payment screen — invisible from inside the product, since the site itself
 * never shows that raw value (HOS-606, smoke finding F-84).
 *
 * This resolves the SAME i18n keys server-side — there is no React context
 * available in `apps/api`, so `useTranslations()` cannot be used here — via
 * `@repo/i18n`'s flat `trans` lookup table (the same data
 * `useTranslations()`/`createTranslations()` read from), falling back to the
 * raw config string when a translation is missing so a newly-added addon
 * never breaks checkout before its keys are translated.
 *
 * MercadoPago is known to truncate at least one checkout-adjacent text field
 * (the preapproval `reason`, at 60 characters — see
 * `docs/billing/...`/engram `project_mp_reason_60_chars_breaks_discount_checkout`).
 * Every locale's translated add-on name is verified to stay within that same
 * conservative budget by the guard test in
 * `test/services/addon-checkout-locale.test.ts`.
 *
 * @module services/addon-checkout-locale
 */

import { type Locale, trans } from '@repo/i18n';

/** Supported buyer locale for checkout copy (mirrors `ReturnUrlLocale`). */
export type AddonCheckoutLocale = Locale;

/** Fallback locale when the caller does not know the buyer's preference. */
const DEFAULT_ADDON_CHECKOUT_LOCALE: AddonCheckoutLocale = 'es';

/**
 * Resolves a single addon i18n key against `@repo/i18n`'s flat translation
 * table, falling back to the raw config string when no translation exists.
 */
const resolveAddonCopy = ({
    locale,
    key,
    fallback
}: {
    readonly locale: AddonCheckoutLocale | undefined;
    readonly key: string;
    readonly fallback: string;
}): string => {
    const resolvedLocale = locale ?? DEFAULT_ADDON_CHECKOUT_LOCALE;
    return trans[resolvedLocale]?.[key] ?? fallback;
};

/**
 * Resolves the buyer-facing add-on NAME for a MercadoPago checkout line item,
 * translated to the buyer's locale.
 *
 * @param params.locale - Buyer's preferred locale; falls back to `'es'` when
 *   absent (matches the existing `successUrl`/`cancelUrl` fallback convention
 *   in `PurchaseAddonInput`).
 * @param params.slug - Add-on slug, e.g. `visibility-boost-7d`.
 * @param params.fallback - The addon's raw English config `name`, used when
 *   no `account.addons.catalog.<slug>.name` translation exists.
 * @returns The localized name, or `fallback`.
 *
 * @example
 * resolveAddonCheckoutName({ locale: 'es', slug: 'visibility-boost-7d', fallback: 'Visibility Boost (7 days)' });
 * // => 'Impulso de visibilidad (7 días)'
 */
export function resolveAddonCheckoutName({
    locale,
    slug,
    fallback
}: {
    readonly locale: AddonCheckoutLocale | undefined;
    readonly slug: string;
    readonly fallback: string;
}): string {
    return resolveAddonCopy({ locale, key: `account.addons.catalog.${slug}.name`, fallback });
}

/**
 * Resolves the buyer-facing add-on DESCRIPTION for a MercadoPago checkout
 * line item. Same resolution rule as {@link resolveAddonCheckoutName}.
 *
 * @param params.locale - Buyer's preferred locale; falls back to `'es'`.
 * @param params.slug - Add-on slug, e.g. `visibility-boost-7d`.
 * @param params.fallback - The addon's raw English config `description`.
 * @returns The localized description, or `fallback`.
 */
export function resolveAddonCheckoutDescription({
    locale,
    slug,
    fallback
}: {
    readonly locale: AddonCheckoutLocale | undefined;
    readonly slug: string;
    readonly fallback: string;
}): string {
    return resolveAddonCopy({
        locale,
        key: `account.addons.catalog.${slug}.description`,
        fallback
    });
}
