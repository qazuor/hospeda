/**
 * @file night-info.ts
 * @description Pure mapping for the venue `nightInfo` section (HOS-1849 / 4.5).
 *
 * The public API already applies every gate this page must honour: a section
 * that is not `available` reaches the web with none of its seven fields (the
 * projector removes them; since HOS-2060 three of them — `minAge`, `dressCode`,
 * `dressCodeNote` — travel inside `policies`), and `multiLine` is resolved on the server by
 * `resolveListingSections`. This helper does NOT inspect business lines and
 * never decides whether the section is visible — it only turns the fields that
 * arrived into renderer-ready values.
 *
 * Everything here is RO-RO and side-effect free so the decisions that matter
 * (price only with `paid`, the updated date only with a price, the fixed legal
 * text only with a badge) are unit-testable without rendering Astro.
 */

import { LISTING_SECTIONS, VenueMinAgeScopeSchema } from '@repo/schemas';
import { type I18nTextLike, resolveI18nText } from '../resolve-i18n-text';

/** How a venue charges for entry (`VenueEntryKindEnum`). */
export type VenueNightEntryKind = 'free' | 'paid' | 'varies';

/**
 * Where or when the minimum age applies (HOS-2098), with the area already
 * resolved to the page locale. `all_day` also stands for "the owner never set
 * a scope": that is the default of every venue saved before HOS-2098.
 */
export type VenueNightAgeScope =
    | { readonly kind: 'all_day' }
    | { readonly kind: 'from_time'; readonly from: string }
    | { readonly kind: 'area'; readonly area: string };

/** Closed dress-code list (`VenueDressCodeEnum`). */
export type VenueNightDressCode = 'casual' | 'smart_casual' | 'elegant' | 'no_restrictions';

/**
 * The `nightInfo` section as the public detail page consumes it.
 *
 * A `null` field means "not published": either the owner never filled it or
 * the section is not `available` and the API removed it. The page cannot tell
 * those apart and does not need to.
 */
export interface VenueNightInfoData {
    /** Entry charge model, or `null` when not informed. */
    readonly entryKind: VenueNightEntryKind | null;
    /** Short localized note about the entry, resolved to the page locale. */
    readonly entryNote: string | null;
    /** Cover-charge floor in cents, only while {@link entryKind} is `paid`. */
    readonly entryPriceFromCents: number | null;
    /** When the price last changed, only while a price is shown. */
    readonly entryPriceUpdatedAt: string | null;
    /** Lowest age that applies to entry, or `null` when not informed. */
    readonly minAge: number | null;
    /**
     * Where or when {@link minAge} applies, or `null` exactly when there is no
     * age: a scope means nothing on its own (HOS-2098).
     */
    readonly minAgeScope: VenueNightAgeScope | null;
    /** Dress code label source, or `null` when not informed. */
    readonly dressCode: VenueNightDressCode | null;
    /** Short localized note about the dress code, resolved to the page locale. */
    readonly dressCodeNote: string | null;
    /** Server-resolved fact: more than one business line owns a non-absent section. */
    readonly multiLine: boolean;
}

/**
 * Translation keys are assembled from segments instead of written as dotted
 * literals on purpose. This module is reachable from the browser graph through
 * `transforms.ts`, and the client-i18n guard treats any `venue.…` literal there
 * as proof the `venue.detail` namespace must ship to every visitor. The keys
 * are only resolved by the server-rendered `.astro` component, whose own
 * literals ARE checked by `check:i18n-keys`.
 */
const NIGHT_INFO_KEY_SEGMENTS = ['venue', 'detail', 'nightInfo'] as const;

/** The fixed legal text every `minAge` badge must carry (DEC-FAC-068). */
export const NIGHT_INFO_LEGAL_TEXT_KEY = [...NIGHT_INFO_KEY_SEGMENTS, 'legalAge'].join('.');

/** Prefix of the three minimum-age scope labels (HOS-2098). */
const NIGHT_INFO_AGE_SCOPE_KEY_PREFIX = [...NIGHT_INFO_KEY_SEGMENTS, 'minAgeScope'].join('.');

/** Heading used when the section is the only one of its lines (`multiLine: false`). */
export const NIGHT_INFO_DEFAULT_HEADING_KEY = [...NIGHT_INFO_KEY_SEGMENTS, 'heading'].join('.');

/**
 * Reads one of the three closed `entryKind` values.
 *
 * @param value - Raw payload value, of unknown shape.
 * @returns The value when it is one of the declared kinds, `null` otherwise.
 */
function readEntryKind(value: unknown): VenueNightEntryKind | null {
    return value === 'free' || value === 'paid' || value === 'varies' ? value : null;
}

/**
 * Reads one of the four closed `dressCode` values.
 *
 * @param value - Raw payload value, of unknown shape.
 * @returns The value when it is one of the declared codes, `null` otherwise.
 */
function readDressCode(value: unknown): VenueNightDressCode | null {
    return value === 'casual' ||
        value === 'smart_casual' ||
        value === 'elegant' ||
        value === 'no_restrictions'
        ? value
        : null;
}

/**
 * Reads a finite number from the payload.
 *
 * @param value - Raw payload value, of unknown shape.
 * @returns The number, or `null` when absent or not finite.
 */
function readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/**
 * Reads a timestamp as an ISO-compatible string.
 *
 * @param value - Raw payload value (`Date` after schema parsing, or a string).
 * @returns The timestamp, or `null` when absent.
 */
function readTimestamp(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === 'string' && value.trim() !== '') return value;
    return null;
}

/**
 * Resolves a localized note to the page locale, falling back to `es`.
 *
 * An empty string means "not informed" and is collapsed to `null` so a note
 * element is never rendered over nothing.
 *
 * @param value - Raw `*I18n` value.
 * @param locale - Active page locale.
 * @returns The resolved, trimmed note, or `null`.
 */
function readNote(value: unknown, locale: string): string | null {
    const resolved = resolveI18nText(
        value as I18nTextLike | string | null | undefined,
        locale
    ).trim();
    return resolved.length > 0 ? resolved : null;
}

/**
 * Reads the minimum-age scope (HOS-2098) and resolves its area to the locale.
 *
 * Everything that is not a valid `from_time` or `area` scope — absent, `all_day`,
 * malformed, or an area blank in every locale — reads as `all_day`, the
 * conservative default.
 *
 * @param value - Raw `policies.minAgeScope`, of unknown shape.
 * @param locale - Active page locale.
 * @returns The scope as the page renders it.
 */
function readAgeScope(value: unknown, locale: string): VenueNightAgeScope {
    const parsed = VenueMinAgeScopeSchema.safeParse(value);
    if (!parsed.success) return { kind: 'all_day' };
    const scope = parsed.data;
    if (scope.kind === 'from_time') return { kind: 'from_time', from: scope.from };
    if (scope.kind === 'area') {
        const area = readNote(scope.area, locale);
        return area === null ? { kind: 'all_day' } : { kind: 'area', area };
    }
    return { kind: 'all_day' };
}

/**
 * Maps a raw venue detail payload into {@link VenueNightInfoData}.
 *
 * @param args.item - Raw API venue payload.
 * @param args.locale - Active page locale, used to resolve the two notes.
 * @returns The renderer-ready section data.
 */
export function toVenueNightInfo({
    item,
    locale
}: {
    readonly item: Record<string, unknown>;
    readonly locale: string;
}): VenueNightInfoData {
    const entryKind = readEntryKind(item.entryKind);
    // HOS-2060: age and dress code are venue policies now, still owned by the
    // nightInfo section — the API strips them from `policies` together with
    // the other nightInfo fields when the section is not `available`.
    const policies =
        typeof item.policies === 'object' && item.policies !== null
            ? (item.policies as Record<string, unknown>)
            : {};
    const rawPrice = readNumber(item.entryPriceFrom);
    // The price is a `paid` fact only (DEC-FAC-058). A stale value next to a
    // different `entryKind` is never rendered, and without a price the update
    // date says nothing either.
    const entryPriceFromCents = entryKind === 'paid' ? rawPrice : null;
    const entryPriceUpdatedAt =
        entryPriceFromCents === null ? null : readTimestamp(item.entryPriceUpdatedAt);

    const minAge = readNumber(policies.minAge);

    return {
        entryKind,
        entryNote: readNote(item.entryNoteI18n, locale),
        entryPriceFromCents,
        entryPriceUpdatedAt,
        minAge,
        minAgeScope: minAge === null ? null : readAgeScope(policies.minAgeScope, locale),
        dressCode: readDressCode(policies.dressCode),
        dressCodeNote: readNote(policies.dressCodeNote, locale),
        multiLine: item.multiLine === true
    };
}

/**
 * Whether the section has anything to render.
 *
 * The section is only published when at least one of its fields is non-null;
 * an unavailable section arrives with every field removed, so this also covers
 * "not `available`" without asking about business lines.
 *
 * @param data - The mapped section data.
 * @returns True when at least one `nightInfo` field is present.
 */
export function hasNightInfoContent(data: VenueNightInfoData): boolean {
    return (
        data.entryKind !== null ||
        data.entryNote !== null ||
        data.entryPriceFromCents !== null ||
        data.entryPriceUpdatedAt !== null ||
        data.minAge !== null ||
        data.dressCode !== null ||
        data.dressCodeNote !== null
    );
}

/** The fixed badge plus the legal text that must accompany it. */
export interface VenueAgeNotice {
    /** Visible badge label, e.g. `+18`. */
    readonly badge: string;
    /** Translation key of the fixed legal text; never interpolated with the age. */
    readonly legalTextKey: string;
    /** Translation key of the scope label shown next to the badge (HOS-2098). */
    readonly scopeTextKey: string;
    /** Placeholder values of {@link scopeTextKey} (`time` or `area`). */
    readonly scopeParams: Readonly<Record<string, string>>;
}

/**
 * Translation key and placeholder values of a scope label (HOS-2098). The API
 * chat context resolves the SAME keys, so the ficha and the chat say the same.
 *
 * @param args.scope - The scope, or `null`/absent for "not set" (all day).
 * @returns The key and its placeholder values.
 */
export function ageScopeLabel({ scope }: { readonly scope?: VenueNightAgeScope | null }): {
    readonly key: string;
    readonly params: Readonly<Record<string, string>>;
} {
    if (scope?.kind === 'from_time') {
        return { key: `${NIGHT_INFO_AGE_SCOPE_KEY_PREFIX}.fromTime`, params: { time: scope.from } };
    }
    if (scope?.kind === 'area') {
        return { key: `${NIGHT_INFO_AGE_SCOPE_KEY_PREFIX}.area`, params: { area: scope.area } };
    }
    return { key: `${NIGHT_INFO_AGE_SCOPE_KEY_PREFIX}.allDay`, params: {} };
}

/**
 * Replaces each `{{name}}` placeholder of a translated label.
 *
 * @param args.text - The translated label.
 * @param args.params - Placeholder values.
 * @returns The label with every known placeholder filled.
 */
export function fillLabel({
    text,
    params
}: {
    readonly text: string;
    readonly params: Readonly<Record<string, string>>;
}): string {
    return Object.entries(params).reduce(
        (label, [name, value]) => label.split(`{{${name}}}`).join(value),
        text
    );
}

/**
 * Builds the age badge and its fixed legal notice.
 *
 * The legal text always says 18 because it is the alcohol-sale law, not the
 * venue's entry age: a `+16` matinée badge carries the same notice
 * (DEC-FAC-036). `null` means "not informed" and renders neither the badge nor
 * the notice.
 *
 * The scope label (HOS-2098) rides with the badge and never replaces the legal
 * text: an unset scope reads "applies all day".
 *
 * @param args.minAge - The lowest age that applies, or `null`.
 * @param args.scope - Where or when it applies; `null`/absent means all day.
 * @returns The badge, its scope label and its legal-text key, or `null` when
 *   no age is set.
 */
export function ageNotice({
    minAge,
    scope
}: {
    readonly minAge: number | null;
    readonly scope?: VenueNightAgeScope | null;
}): VenueAgeNotice | null {
    if (minAge === null || !Number.isFinite(minAge)) return null;
    const label = ageScopeLabel({ scope });
    return {
        badge: `+${minAge}`,
        legalTextKey: NIGHT_INFO_LEGAL_TEXT_KEY,
        scopeTextKey: label.key,
        scopeParams: label.params
    };
}

/**
 * Chooses the section heading.
 *
 * `multiLine` is a server fact (DEC-FAC-050): when more than one business line
 * owns a non-absent section, the section is titled with the catalog's
 * `headingWhenMultiLineKey`. Otherwise it keeps its own default heading. The
 * catalog is read here, not duplicated as a literal.
 *
 * @param args.multiLine - The server-resolved `multiLine` fact.
 * @returns The translation key of the heading to render.
 */
export function nightInfoHeadingKey({ multiLine }: { readonly multiLine: boolean }): string {
    if (!multiLine) return NIGHT_INFO_DEFAULT_HEADING_KEY;
    const section = LISTING_SECTIONS.venue.find((entry) => entry.id === 'nightInfo');
    if (section && 'headingWhenMultiLineKey' in section) {
        return section.headingWhenMultiLineKey;
    }
    return NIGHT_INFO_DEFAULT_HEADING_KEY;
}
