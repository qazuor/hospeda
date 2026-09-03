/**
 * The copy a certificate prints, resolved for one locale (HOS-1057).
 *
 * ---
 * WHY THE CONTENT IS SEPARATE FROM THE LAYOUT
 *
 * Same split `commerce-brochure` uses and for the same reason: what a
 * certificate SAYS is translated, auditable copy, and where it sits on the page
 * is typography. Keeping them apart means a test can assert the sentence
 * without rendering a PDF, and the renderer can be swapped without touching a
 * single translated string.
 *
 * ## What a certificate may claim
 *
 * The platform did not witness the outing — the provider did. So every line
 * here is phrased as the PROVIDER certifying, never as Hospeda verifying: the
 * name on the sheet was typed by a person whose reputation travels with it,
 * and saying otherwise would be a claim nothing in the system backs.
 *
 * ## What names the provider, since there is no separate issuer line
 *
 * The experience's own NAME, printed as the subject, plus the QR back to its
 * public ficha and the footer sentence. There is deliberately no "issued by
 * <business>" line: the protected projection this is built from carries a
 * `destinationId` and no destination NAME, and the honest options were to
 * resolve a second row for one line of decoration or to leave the line out.
 * Leaving it out costs nothing the issue asked for — the provider's identity
 * still travels with every copy, through the listing name and the QR.
 *
 * @module services/experience-certificate/certificate-content
 */

import type { Locale } from '@repo/i18n';
import { trans } from '@repo/i18n';

/** Public path segment of an experience ficha, in every locale. */
const EXPERIENCE_PATH_SEGMENT = 'experiencias';

/** Order in which a missing localized value is looked for. */
const LOCALE_FALLBACK: readonly Locale[] = ['es', 'en', 'pt'];

/** Everything the certificate page draws. */
export interface CertificateContent {
    /** The heading — "Certificado". */
    readonly title: string;
    /** The line above the name — "El presente certifica que". */
    readonly preamble: string;
    /** Who it was issued to, verbatim as the provider typed it. */
    readonly recipientName: string;
    /** The line between the name and the experience — "realizó la experiencia". */
    readonly connector: string;
    /** The experience's own name. */
    readonly experienceName: string;
    /** The date line — "el 14 de marzo de 2026". */
    readonly dateLine: string;
    /** The sentence under the QR. */
    readonly qrHint: string;
    /** The closing line. */
    readonly footer: string;
    /** Absolute URL the QR points at — the experience's PUBLIC ficha. */
    readonly publicUrl: string;
}

/**
 * Looks a key up, falling back to Spanish and then to a caller-supplied
 * default.
 *
 * A certificate must never print `[MISSING: …]` on paper — this is the one
 * document a person frames — so an absent key degrades to the Spanish string
 * and, failing that, to whatever the call site can offer.
 */
function t(input: { locale: Locale; key: string; fallback?: string }): string {
    const { locale, key } = input;
    return trans[locale]?.[key] ?? trans.es?.[key] ?? input.fallback ?? '';
}

/** Resolves an `{ es, en, pt }` object for a locale; empty string when absent. */
function i18nText(input: {
    value: { es?: string | null; en?: string | null; pt?: string | null } | null | undefined;
    locale: Locale;
}): string {
    const { value, locale } = input;
    if (!value) return '';
    const direct = value[locale];
    if (direct) return direct;
    for (const fallback of LOCALE_FALLBACK) {
        const candidate = value[fallback];
        if (candidate) return candidate;
    }
    return '';
}

/**
 * Absolute URL of the experience's public ficha.
 *
 * Mirrors `buildPublicListingUrl` in `commerce-brochure`, deliberately not
 * imported from it: the two modules answer to different features and a shared
 * helper would tie the certificate's QR to whatever the brochure's URL shape
 * becomes. The segment is asserted literally by this module's test, which is
 * what actually keeps them from drifting into a 404.
 */
export function buildExperiencePublicUrl(input: {
    slug: string;
    locale: Locale;
    siteUrl: string;
}): string {
    const base = input.siteUrl.replace(/\/$/, '');
    return `${base}/${input.locale}/${EXPERIENCE_PATH_SEGMENT}/${encodeURIComponent(input.slug)}/`;
}

/**
 * Formats the completion day for print.
 *
 * The stored value is a plain `YYYY-MM-DD` — a DAY, with no instant and no zone.
 * The parts are pulled out with a regex and reassembled through `Date.UTC`, and
 * the formatter is pinned to UTC, so no zone is ever introduced. Handing the
 * string to `new Date()` and formatting the result in the server's local zone is
 * exactly how a certificate for the 1st gets printed as the 31st of the month
 * before — the shift `feedback_toisostring_shifts_date_windows_a_day` describes,
 * here on the one field the recipient checks against their own memory.
 *
 * A value that is not `YYYY-MM-DD` is printed verbatim rather than dropped: the
 * schema forbids it, so if one ever arrives the honest thing on paper is the raw
 * string, not a blank line.
 *
 * @param input.completedAt - The day, as `YYYY-MM-DD`.
 * @param input.locale - Locale whose month names are used.
 * @returns A human date, or the raw value if it is not the expected shape.
 */
export function formatCertificateDate(input: { completedAt: string; locale: Locale }): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.completedAt);
    if (!match) {
        return input.completedAt;
    }
    const [, year, month, day] = match;
    const utcDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (Number.isNaN(utcDay.getTime())) {
        return input.completedAt;
    }
    return new Intl.DateTimeFormat(input.locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(utcDay);
}

/**
 * Builds everything a certificate prints.
 *
 * @param input.certificate - The issued row: who and when.
 * @param input.experience - The listing it attests to, already established as
 *   the caller's by the route.
 * @param input.locale - Locale to print in.
 * @param input.siteUrl - Public base URL of the web app.
 * @returns The printable content.
 */
export function buildCertificateContent(input: {
    certificate: { recipientName: string; completedAt: string };
    experience: {
        slug: string;
        name: string;
        nameI18n?: { es?: string | null; en?: string | null; pt?: string | null } | null;
    };
    locale: Locale;
    siteUrl: string;
}): CertificateContent {
    const { locale, experience, certificate } = input;

    const experienceName = i18nText({ value: experience.nameI18n, locale }) || experience.name;

    return {
        title: t({ locale, key: 'commerce.certificate.title', fallback: 'Certificado' }),
        preamble: t({
            locale,
            key: 'commerce.certificate.preamble',
            fallback: 'El presente certifica que'
        }),
        recipientName: certificate.recipientName,
        connector: t({
            locale,
            key: 'commerce.certificate.connector',
            fallback: 'realizó la experiencia'
        }),
        experienceName,
        dateLine: formatCertificateDate({ completedAt: certificate.completedAt, locale }),
        qrHint: t({
            locale,
            key: 'commerce.certificate.qrHint',
            fallback: 'Escaneá el código para conocer la experiencia.'
        }),
        footer: t({
            locale,
            key: 'commerce.certificate.footer',
            fallback: 'hospeda.com.ar'
        }),
        publicUrl: buildExperiencePublicUrl({
            slug: experience.slug,
            locale,
            siteUrl: input.siteUrl
        })
    };
}
