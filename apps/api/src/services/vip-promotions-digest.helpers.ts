/**
 * Pure helpers of the weekly VIP promotions digest (HOS-2589 §7.7).
 *
 * No database, no clock: the job passes `now` and the rows, so every rule here is
 * unit-tested deterministically.
 *
 * @module apps/api/services/vip-promotions-digest.helpers
 */
import { OwnerPromotionDiscountTypeEnum, OwnerPromotionEntityTypeEnum } from '@repo/schemas';

/** Locales the digest is written in. */
export type VipDigestLocale = 'es' | 'en' | 'pt';

/** At most this many promotions are listed; the rest are counted («y X más»). */
export const VIP_DIGEST_MAX_LISTED = 10;

/** Argentina has no DST: ART is UTC-3 all year. */
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/**
 * The previous ART week of `now`: `[Monday 00:00, next Monday 00:00)` ART, in UTC.
 *
 * @param input - `now`.
 * @returns `{ from, to }`.
 */
export function previousArtWeek(input: { readonly now: Date }): {
    readonly from: Date;
    readonly to: Date;
} {
    const local = new Date(input.now.getTime() - ART_OFFSET_MS);
    const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const isoWeekday = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    const thisMondayLocal = midnightLocal - (isoWeekday - 1) * DAY_MS;
    const to = new Date(thisMondayLocal + ART_OFFSET_MS);
    return { from: new Date(to.getTime() - 7 * DAY_MS), to };
}

/**
 * Whether a recipient accepts the digest: `settings.vipPromotionsDigest !== false`
 * and `settings.notifications.allowEmails !== false` (AC-16).
 *
 * @param input - The stored `settings`.
 * @returns `{ accepts }`.
 */
export function acceptsVipDigest(input: { readonly settings: unknown }): {
    readonly accepts: boolean;
} {
    if (input.settings === null || typeof input.settings !== 'object') return { accepts: true };
    const settings = input.settings as {
        readonly vipPromotionsDigest?: unknown;
        readonly notifications?: { readonly allowEmails?: unknown } | null;
    };
    if (settings.vipPromotionsDigest === false) return { accepts: false };
    if (settings.notifications?.allowEmails === false) return { accepts: false };
    return { accepts: true };
}

/** Copy of the benefit line, per locale. */
const BENEFIT_COPY = {
    es: { off: 'de descuento', freeNight: 'Noche gratis', starts: 'Desde el' },
    en: { off: 'off', freeNight: 'Free night', starts: 'From' },
    pt: { off: 'de desconto', freeNight: 'Noite grátis', starts: 'A partir de' }
} as const;

const BCP47: Record<VipDigestLocale, string> = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' };

/**
 * The benefit line of a promotion, mirroring the web's `formatPromotionBenefit`.
 *
 * @param input - The promotion fields and the locale.
 * @returns The localised benefit (a special offer is its own text).
 */
export function formatDigestBenefit(input: {
    readonly discountType: string;
    readonly discountValue: number;
    readonly description: string | null;
    readonly title: string;
    readonly locale: VipDigestLocale;
}): string {
    const copy = BENEFIT_COPY[input.locale];
    switch (input.discountType) {
        case OwnerPromotionDiscountTypeEnum.PERCENTAGE:
            return `${input.discountValue}% ${copy.off}`;
        case OwnerPromotionDiscountTypeEnum.FIXED: {
            const amount = new Intl.NumberFormat(BCP47[input.locale], {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(input.discountValue);
            return `${amount} ${copy.off}`;
        }
        case OwnerPromotionDiscountTypeEnum.FREE_NIGHT:
            return copy.freeNight;
        default:
            return input.description ?? input.title;
    }
}

/**
 * «Desde …» for a promotion that starts after `now`, else `null`.
 *
 * @param input - `validFrom`, `now` and the locale.
 * @returns The label or `null`.
 */
export function formatStartsLabel(input: {
    readonly validFrom: Date;
    readonly now: Date;
    readonly locale: VipDigestLocale;
}): string | null {
    if (input.validFrom.getTime() <= input.now.getTime()) return null;
    const date = new Intl.DateTimeFormat(BCP47[input.locale], {
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).format(input.validFrom);
    return `${BENEFIT_COPY[input.locale].starts} ${date}`;
}

/**
 * Absolute link to a place's public page.
 *
 * @param input - Site URL, locale, the place's type and slug.
 * @returns `{ url }`.
 */
export function buildPlaceUrl(input: {
    readonly siteUrl: string;
    readonly locale: VipDigestLocale;
    readonly entityType: string;
    readonly slug: string;
}): { readonly url: string } {
    const base = input.siteUrl.replace(/\/+$/, '');
    const section =
        input.entityType === OwnerPromotionEntityTypeEnum.VENUE ? 'comer-y-salir' : 'alojamientos';
    return { url: `${base}/${input.locale}/${section}/${input.slug}/` };
}
