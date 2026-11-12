/**
 * Prepares the venue `nightInfo` section for the AI-chat context (HOS-1864).
 *
 * The section is a `nightlife`-line fact and its availability was resolved
 * upstream from the section map, so this module never inspects business lines,
 * venue types or the vertical: it receives `available` and stops there
 * (G-FAC-03, G-FAC-05). Everything it returns is already resolved to the
 * visitor's locale, which keeps {@link buildVenueMarkdownContext} a pure text
 * renderer and makes the locale decisions unit-testable without a DB.
 *
 * The legal notice is the one text that must be repeated verbatim: it always
 * says 18 because it is the alcohol-sale law, not the venue's entry age, so a
 * `+16` matinée carries the same notice (DEC-FAC-036). It appears only when a
 * minimum age exists, exactly like the web `ageNotice` helper.
 *
 * The minimum-age scope (HOS-2098) is resolved with the SAME translation keys
 * the public ficha uses (`venue.detail.nightInfo.minAgeScope.*`), so the page
 * and the chat say the same thing. An unset or malformed scope reads as "all
 * day" — the conservative default the chat rules keep for it.
 *
 * @module apps/api/services/ai-context/venue-night-context
 */

import { type Locale, trans } from '@repo/i18n';
import { type I18nText, resolveVenueMinAgeScope, type VenuePolicies } from '@repo/schemas';

/**
 * One `nightInfo` row, already read from the venues table. The minimum age and
 * the dress code are house rules stored in `policies` since HOS-2060; they
 * still belong to this section and are gated with it.
 */
export interface VenueNightContextRow {
    readonly entryKind: string | null;
    readonly entryNoteI18n: I18nText | null;
    readonly entryPriceFrom: number | null;
    readonly policies: VenuePolicies | null;
}

/** The `nightInfo` values the context block renders, already resolved. */
export interface VenueNightContext {
    /** Lowest age that applies to entry, or `null` when not informed. */
    readonly minAge: number | null;
    /**
     * Where or when the minimum age applies, as the ficha prints it (HOS-2098);
     * `null` exactly when there is no minimum age.
     */
    readonly minAgeScope: VenueNightAgeScopeContext | null;
    /** Fixed legal text of the alcohol-sale law; `null` without a minimum age. */
    readonly legalNotice: string | null;
    /** Localized `entryKind` label, or `null`. */
    readonly entryLabel: string | null;
    /** Owner note about entry, resolved to the locale, or `null`. */
    readonly entryNote: string | null;
    /** Cover-charge floor in pesos, only while `entryKind` is `paid`. */
    readonly entryPriceFrom: number | null;
    /** Localized `dressCode` label, or `null`. */
    readonly dressCodeLabel: string | null;
    /** Owner note about the dress code, resolved to the locale, or `null`. */
    readonly dressCodeNote: string | null;
}

/**
 * The minimum-age scope as the context block renders it (HOS-2098).
 *
 * `label` is the localized ficha text with the owner's area replaced by
 * {@link AGE_SCOPE_AREA_SLOT}; `area` is that owner text (to be fenced), or
 * `null` for the two kinds that carry none.
 */
export interface VenueNightAgeScopeContext {
    /** `all_day` also covers an unset scope. */
    readonly kind: 'all_day' | 'from_time' | 'area';
    /** Localized label, e.g. "Rige desde las 00:00". */
    readonly label: string;
    /** Owner-authored sector or activity, resolved to the locale, or `null`. */
    readonly area: string | null;
    /**
     * `HH:mm` start of a `from_time` scope, otherwise `null`. The chat context
     * resolves it against the opening hours into explicit windows (HOS-2098).
     */
    readonly from: string | null;
}

/** Placeholder left in an `area` label where the fenced owner text goes. */
export const AGE_SCOPE_AREA_SLOT = '{{area}}';

/** Translation key prefix of the section. */
const NIGHT_INFO_KEY_PREFIX = 'venue.detail.nightInfo';

/**
 * Resolves one translation key for the visitor's locale, falling back to `es`
 * exactly as the API does elsewhere (`certificate-content.ts`).
 *
 * @param key - Flattened translation key.
 * @param locale - Visitor locale.
 * @returns The translated string, or `''` when neither locale has it.
 */
function translateNightKey(key: string, locale: Locale): string {
    return trans[locale]?.[key] ?? trans.es?.[key] ?? '';
}

/**
 * Resolves a localized owner note to the request locale, falling back to `es`.
 *
 * An empty or missing value collapses to `null` so the block never renders a
 * label over nothing.
 *
 * @param value - The JSONB `I18nText` value, possibly nullish.
 * @param locale - Visitor locale.
 * @returns The resolved, trimmed note, or `null`.
 */
function resolveNote(value: I18nText | null | undefined, locale: Locale): string | null {
    if (!value) return null;
    // An empty string means "not informed" in that locale, so it falls back to
    // `es` exactly as the web's `resolveI18nText` does.
    for (const candidate of [value[locale], value.es]) {
        const resolved = (candidate ?? '').trim();
        if (resolved.length > 0) return resolved;
    }
    return null;
}

/**
 * Resolves the minimum-age scope to the visitor's locale (HOS-2098).
 *
 * Resolution is `resolveVenueMinAgeScope` from `@repo/schemas`, the same
 * function the web ficha calls, and the labels are the same i18n keys: the
 * chat line can never be more permissive than the page.
 *
 * @param value - The stored `policies.minAgeScope`, of unknown shape.
 * @param locale - Visitor locale.
 * @returns The scope as the context block renders it.
 */
export function toVenueNightAgeScope(value: unknown, locale: Locale): VenueNightAgeScopeContext {
    const prefix = `${NIGHT_INFO_KEY_PREFIX}.minAgeScope`;
    // The SAME reader the public ficha uses: trim + locale → es → en → pt.
    const scope = resolveVenueMinAgeScope({ value, locale });
    if (scope.kind === 'from_time') {
        return {
            kind: 'from_time',
            label: translateNightKey(`${prefix}.fromTime`, locale)
                .split('{{time}}')
                .join(scope.from),
            area: null,
            from: scope.from
        };
    }
    if (scope.kind === 'area') {
        return {
            kind: 'area',
            label: translateNightKey(`${prefix}.area`, locale),
            area: scope.area,
            from: null
        };
    }
    return {
        kind: 'all_day',
        label: translateNightKey(`${prefix}.allDay`, locale),
        area: null,
        from: null
    };
}

/**
 * Maps the raw `nightInfo` columns into the context block's values.
 *
 * PURE and RO-RO. Returns `null` when the section is not `available`, or when
 * the section is available but carries no value at all, so an empty section
 * never produces an empty heading in the prompt.
 *
 * @param args.row - The venue columns of the `nightInfo` section.
 * @param args.available - Whether the section map resolved `nightInfo` as available.
 * @param args.locale - Visitor locale used for labels, notes and legal text.
 * @returns The resolved section values, or `null`.
 */
export function toVenueNightContext(args: {
    readonly row: VenueNightContextRow;
    readonly available: boolean;
    readonly locale: Locale;
}): VenueNightContext | null {
    const { row, available, locale } = args;
    if (!available) return null;

    const policies = row.policies ?? {};
    const minAge =
        typeof policies.minAge === 'number' && Number.isFinite(policies.minAge)
            ? policies.minAge
            : null;
    const dressCode = policies.dressCode ?? null;
    const legalNotice =
        minAge === null ? null : translateNightKey(`${NIGHT_INFO_KEY_PREFIX}.legalAge`, locale);
    // HOS-2098: a scope means nothing without an age.
    const minAgeScope = minAge === null ? null : toVenueNightAgeScope(policies.minAgeScope, locale);
    const entryLabel =
        row.entryKind === null
            ? null
            : translateNightKey(`${NIGHT_INFO_KEY_PREFIX}.entryKind.${row.entryKind}`, locale) ||
              null;
    const dressCodeLabel =
        dressCode === null
            ? null
            : translateNightKey(`${NIGHT_INFO_KEY_PREFIX}.dressCode.${dressCode}`, locale) || null;
    const entryNote = resolveNote(row.entryNoteI18n, locale);
    const dressCodeNote = resolveNote(policies.dressCodeNote ?? null, locale);
    // The price is a `paid` fact only (DEC-FAC-058): a stale value next to a
    // different `entryKind` is never rendered.
    const entryPriceFrom =
        row.entryKind === 'paid' && row.entryPriceFrom !== null
            ? Math.round(row.entryPriceFrom / 100)
            : null;

    const hasAnyValue =
        minAge !== null ||
        legalNotice !== null ||
        entryLabel !== null ||
        entryNote !== null ||
        entryPriceFrom !== null ||
        dressCodeLabel !== null ||
        dressCodeNote !== null;

    if (!hasAnyValue) return null;

    return {
        minAge,
        minAgeScope,
        legalNotice,
        entryLabel,
        entryNote,
        entryPriceFrom,
        dressCodeLabel,
        dressCodeNote
    };
}
