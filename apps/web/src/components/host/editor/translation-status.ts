/**
 * @file translation-status.ts
 * @description Pure state logic behind the host TranslationPanel (HOS-317).
 *
 * Kept apart from the component so the rules that decide what is missing, what
 * was attempted and what failed can be tested directly — the panel itself is
 * markup around these answers.
 *
 * @module components/host/editor/translation-status
 */

import type { AccommodationTranslationData, TranslatableFieldStatus } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Re-exported from `@/lib/i18n` rather than redeclared.
 *
 * A second literal would not fail typecheck when the two diverge — the derived
 * types stay assignable — so adding a fourth locale to the app would leave this
 * panel silently checking three, never detecting the new one as missing and never
 * rendering a badge for it.
 */
export { SUPPORTED_LOCALES };

/** The four translatable fields, in display order. */
export const TRANSLATABLE_FIELDS = ['name', 'summary', 'description', 'richDescription'] as const;

/** Key of a translatable accommodation field. */
export type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One (field × locale) translation outcome, as returned by
 * `POST /api/v1/protected/ai/translate`.
 *
 * Typed structurally rather than imported from the API package: this is a wire
 * shape crossing an HTTP boundary, and the fields are read defensively below.
 */
export interface TranslationResultItem {
    readonly fieldType: string;
    readonly locale: string;
    readonly success: boolean;
    readonly error?: string;
    /**
     * The text the provider produced for this pair.
     *
     * Optional because it crosses an HTTP boundary and because the panel must
     * keep working without it — see {@link PRESENCE_ONLY_MARKER}. The route has
     * always returned it (`TranslateResult.translatedText`); HOS-797 is the first
     * reader.
     */
    readonly translatedText?: string;
}

/** What happened to one field during a generation run. */
export type FieldOutcomeStatus =
    /** Requested, and the response has not come back yet. */
    | 'pending'
    /** Every locale the backend attempted for this field succeeded. */
    | 'translated'
    /** At least one locale failed. */
    | 'failed'
    /** The backend attempted nothing for this field. */
    | 'untouched';

/** Per-field outcome of a generation run. */
export interface FieldOutcome {
    readonly status: FieldOutcomeStatus;
    /** Locales that came back unsuccessful. Empty unless `status` is `failed`. */
    readonly failedLocales: readonly SupportedLocale[];
}

/** Outcome map covering every field a run touched. */
export type GenerationOutcomes = Partial<Record<TranslatableField, FieldOutcome>>;

/**
 * Stand-in written into a locale a run reported as succeeded WITHOUT text.
 *
 * Since HOS-797 the panel RENDERS the translated text, so the fold writes the
 * real `translatedText` whenever the response carries one, and this marker is the
 * fallback for when it does not. It exists because presence and text are separate
 * obligations: the badge, `missingLocalesFor` and the generate button all depend
 * on the locale reading as FILLED, and dropping a reported success on the floor
 * for want of a string would revive BETA-199's loop — a row noted "Traducido"
 * under a live button whose next run comes back empty.
 *
 * NUL rather than a visible glyph (it used to be a check mark). Every reader
 * decides presence by trimming, and `String.prototype.trim` does not strip NUL,
 * so presence still holds — but no provider output can collide with it, which
 * is what lets {@link localeDisplaysFor} tell "filled, text unknown" apart from
 * real content instead of guessing. A visible marker would have been rendered AS
 * the translation the moment this panel started showing text.
 */
const PRESENCE_ONLY_MARKER = '\u0000';

/** Whether any requested field came back with a failed locale. */
export function anyFieldFailed(outcomes: GenerationOutcomes): boolean {
    return Object.values(outcomes).some((outcome) => outcome.status === 'failed');
}

/**
 * Whether the backend skipped a field the panel asked about.
 *
 * It skips only what is already filled — its check trims, the same way this
 * module does — so a skip means someone populated that field after the page was
 * rendered, and the panel is showing a state the DB has moved past.
 */
export function anyFieldUntouched(outcomes: GenerationOutcomes): boolean {
    return Object.values(outcomes).some((outcome) => outcome.status === 'untouched');
}

/**
 * The value one succeeded (field, locale) pair contributes to the fold.
 *
 * Three branches, in this order:
 *
 *  1. **Stored content wins.** See {@link applyRunToTranslations} — a success is
 *     the provider's, not the database's, so replacing real stored text with the
 *     run's is how AI text that was never persisted would reach the screen.
 *  2. **Otherwise the run's text**, which is what HOS-797 puts on screen without
 *     forcing the reload that discards an unsaved draft.
 *  3. **Otherwise the presence marker.** The pair succeeded, so the locale MUST
 *     read as filled even when no text came with it.
 *
 * `isFilled`, NOT `??`, at both steps. Every reader of this data decides presence
 * by trimming (the badges, `missingLocalesFor`, `hasSourceContent`) while
 * `extractI18nField` does not trim — it only maps `''` to null. A stored `'   '`
 * is therefore non-null AND absent, so a null-check would keep it, leaving the
 * badge on a dash under a note reading "Traducido", with the button never
 * retiring and the next run coming back empty. That is the bug the fold exists to
 * close, and it survived once already for exactly this data shape.
 *
 * @param stored - What the panel currently holds for that locale.
 * @param result - The succeeded result for that pair.
 * @returns The value to write. Never blank, so presence always holds.
 */
function foldedValueFor({
    stored,
    result
}: {
    readonly stored: string | null | undefined;
    readonly result: TranslationResultItem;
}): string {
    if (isFilled(stored)) return stored as string;
    if (isFilled(result.translatedText)) return result.translatedText as string;
    return PRESENCE_ONLY_MARKER;
}

/**
 * Folds a finished run back into the field status the panel renders.
 *
 * `translations` is frozen at SSR and never refetched, so without this the panel
 * keeps rendering the state the page was built with. That used to be hidden by
 * the automatic reload; once the reload was removed (it discarded unsaved editor
 * edits) the staleness became visible in the worst possible way — a row whose
 * note reads "Traducido" while its badges still show dashes, under a button that
 * happily offers to generate what was just generated. Clicking it returns an
 * empty run and an error-styled "there were no pending translations", which is
 * BETA-199's symptom arriving on the success path.
 *
 * Only successes are folded in. A failed locale is left exactly as it was, so the
 * badges keep showing the real gap the failure left behind.
 *
 * What gets written is decided by {@link foldedValueFor}, and the order of its
 * three branches is the whole design. Presence is decided by {@link isFilled}
 * everywhere it is read; an earlier revision of this comment named a
 * `Boolean(...)` badge that had already been replaced by a trimming one, and
 * writing to match that stale citation is precisely how the whitespace case got
 * missed.
 *
 * A reported success is the PROVIDER's, not the database's: `persistTranslations`
 * skips a locale flagged `autoTranslated: false` while the route still returns it
 * as successful. That is why stored content WINS over the run's text (HOS-797):
 * overwriting a real value the DB kept with AI text it rejected would put words
 * on screen that are never going to be published — in the one panel whose job is
 * letting the host catch exactly that. Filling a BLANK locale from the run has no
 * such downside, and it is what makes the generated text readable without the
 * reload that costs an unsaved draft. Where the two can still diverge, the refresh
 * is offered; the alternative (trusting nothing) is the stale-dash bug, which
 * fired on every clean run instead of on a degenerate admin action.
 *
 * @param translations - The per-field status the panel was rendered with.
 * @param results - The endpoint's per-pair results.
 * @returns A new status map with every succeeded (field, locale) whose stored
 *   value is blank filled from the run. A locale that already holds real content
 *   keeps it; a field the plan withheld (`null`) stays withheld.
 */
export function applyRunToTranslations({
    translations,
    results
}: {
    readonly translations: AccommodationTranslationData;
    readonly results: readonly TranslationResultItem[];
}): AccommodationTranslationData {
    const succeeded = results.filter((result) => result.success);
    if (succeeded.length === 0) return translations;

    const next = { ...translations };

    for (const field of TRANSLATABLE_FIELDS) {
        const status = next[field];
        if (status === null || status === undefined) continue;

        const own = succeeded.filter((result) => result.fieldType === field);
        if (own.length === 0) continue;

        const merged = { ...status.locales };
        let folded = false;
        for (const result of own) {
            // `locale` crosses an HTTP boundary; one this client cannot name is
            // dropped rather than written under a key nothing reads.
            if (!isSupportedLocale(result.locale)) continue;
            merged[result.locale] = foldedValueFor({
                stored: status.locales[result.locale],
                result
            });
            folded = true;
        }
        if (!folded) continue;
        next[field] = { ...status, locales: merged };
    }

    return next;
}

// ---------------------------------------------------------------------------
// Source content
// ---------------------------------------------------------------------------

/** True when `value` carries at least one non-whitespace character. */
function isFilled(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Whether a field has source content the backend could actually translate FROM.
 *
 * Mirrors `loadTranslatableFields` in `apps/api/src/services/ai-translate.service.ts`,
 * which is what decides whether a field participates in a run at all:
 *
 * - source `es` → ONLY the plain column. The service reads `data[field]` and falls
 *   back to the `es` key of the i18n column solely when that read is `undefined` —
 *   which, as its own comment says, happens only for `pointOfInterest.name`, the
 *   one entity with no plain column. For an accommodation an empty plain column is
 *   `null`, so the field is dropped from the run outright.
 * - any other source locale → only that locale's i18n value can be the source.
 *
 * An earlier revision accepted `plain || locales.es` here, reading the service's
 * fallback as general. That over-promise is not harmless: clear a `richDescription`
 * (an admin PATCH, an import overwrite) and its `richDescriptionI18n.es` survives,
 * because nothing clears it. The panel would then offer to translate a field the
 * backend silently skips — and if it were the only gap, the run returns nothing,
 * the host reads "there were no pending translations", and the button never goes
 * away. That is BETA-199's exact symptom, walked back in through a side door.
 *
 * The plain-column half is load-bearing in the other direction, and it is why the
 * panel cannot simply look at `locales[sourceLocale]`. A never-translated
 * accommodation has empty i18n columns across the board while its Spanish text sits
 * in the plain column, so the i18n-only check would declare every field of it
 * unsourced — the heuristic BETA-199 rules out, because it would hide the panel
 * precisely for the accommodations that most need translating.
 *
 * @param status - The field's i18n values plus its plain column.
 * @param sourceLocale - Locale the content is authored in.
 * @returns Whether a generation run could translate this field.
 */
export function hasSourceContent({
    status,
    sourceLocale
}: {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
}): boolean {
    return sourceTextFor({ status, sourceLocale }) !== null;
}

/**
 * The source text itself, or `null` when the field has none.
 *
 * Same rule as {@link hasSourceContent} — which is now expressed THROUGH this
 * function, so the panel cannot display one thing while the run logic decides
 * another. Two copies of "where the source lives" is how the `plain || locales.es`
 * over-promise walked back in once already.
 *
 * @param status - The field's i18n values plus its plain column.
 * @param sourceLocale - Locale the content is authored in.
 * @returns The trimmed-non-empty source text, or `null`.
 */
export function sourceTextFor({
    status,
    sourceLocale
}: {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
}): string | null {
    const value = sourceLocale === 'es' ? status.plain : status.locales[sourceLocale];
    return isFilled(value) ? (value as string) : null;
}

/**
 * Target locales this field is still missing — i.e. what a run would try to fill.
 *
 * Returns nothing for a field with no source content: with nothing to translate
 * from, its empty locales are not "missing", they are unreachable.
 *
 * @param status - The field's i18n values plus its plain column.
 * @param sourceLocale - Locale the host is editing in (never a target).
 * @returns The locales lacking content, in `SUPPORTED_LOCALES` order.
 */
export function missingLocalesFor({
    status,
    sourceLocale
}: {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
}): readonly SupportedLocale[] {
    if (!hasSourceContent({ status, sourceLocale })) return [];
    return SUPPORTED_LOCALES.filter(
        (locale) => locale !== sourceLocale && !isFilled(status.locales[locale])
    );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** What one locale of one field is, from the reader's point of view. */
export type LocaleDisplayRole =
    /** The locale the content is authored in. */
    | 'source'
    /** Holds content that was translated out of the source. */
    | 'translated'
    /** Holds nothing. */
    | 'missing';

/** One locale of one field, ready to render (HOS-797). */
export interface LocaleDisplay {
    readonly locale: SupportedLocale;
    readonly role: LocaleDisplayRole;
    /** The text to show, or `null` when there is none to show. */
    readonly text: string | null;
    /**
     * The locale is filled but its text is not knowable here.
     *
     * Only reachable through {@link PRESENCE_ONLY_MARKER}: a run reported the pair
     * as succeeded without returning the text. `role` is still `translated` — it
     * IS translated — and `text` is `null`, so the panel says so instead of
     * printing a control character or, worse, a dash that contradicts its own
     * badge.
     */
    readonly presenceOnly: boolean;
}

/**
 * Every locale of one field, in `SUPPORTED_LOCALES` order, ready to render.
 *
 * The single answer behind BOTH halves of a field card — the badges and the text
 * beneath them. Before HOS-797 the badge decided presence with its own inline
 * `.trim()` while `missingLocalesFor` decided it here, and the two disagreeing on
 * a whitespace-only value is a bug this repo has already shipped once. Deriving
 * the badge from the same call that yields the text makes that disagreement
 * unrepresentable rather than merely tested-for.
 *
 * The source locale is `source` even when it is empty: an accommodation with no
 * Spanish text yet has nothing to translate FROM, which is a different thing to
 * say than "this translation is missing", and the panel says it differently.
 *
 * @param status - The field's i18n values plus its plain column.
 * @param sourceLocale - Locale the content is authored in.
 * @returns One entry per supported locale.
 */
export function localeDisplaysFor({
    status,
    sourceLocale
}: {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
}): readonly LocaleDisplay[] {
    return SUPPORTED_LOCALES.map((locale) => {
        if (locale === sourceLocale) {
            return {
                locale,
                role: 'source' as const,
                text: sourceTextFor({ status, sourceLocale }),
                presenceOnly: false
            };
        }

        const stored = status.locales[locale];
        if (!isFilled(stored)) {
            return { locale, role: 'missing' as const, text: null, presenceOnly: false };
        }

        const presenceOnly = stored === PRESENCE_ONLY_MARKER;
        return {
            locale,
            role: 'translated' as const,
            text: presenceOnly ? null : (stored as string),
            presenceOnly
        };
    });
}

/**
 * Fields a generation run would actually act on, in display order.
 *
 * A field is included only when it has source content AND at least one missing
 * target locale. `richDescription` is skipped entirely when it is `null` — the
 * API omits the premium pair for a host whose plan does not include it, and a row
 * that can never fill in must not keep the generate button alive forever
 * (BETA-199's visible symptom).
 *
 * @param translations - Per-field status from the protected GET.
 * @param sourceLocale - Locale the host is editing in.
 * @returns The fields with something to generate.
 */
export function fieldsWithMissingTranslations({
    translations,
    sourceLocale
}: {
    readonly translations: AccommodationTranslationData;
    readonly sourceLocale: SupportedLocale;
}): readonly TranslatableField[] {
    return TRANSLATABLE_FIELDS.filter((field) => {
        const status = translations[field];
        if (status === null) return false;
        return missingLocalesFor({ status, sourceLocale }).length > 0;
    });
}

// ---------------------------------------------------------------------------
// Run outcomes
// ---------------------------------------------------------------------------

/** Whether `value` is one of the three supported locales. */
function isSupportedLocale(value: string): value is SupportedLocale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Marks every requested field as in-flight, for the optimistic phase of a run.
 *
 * @param fields - Fields the run was started for.
 * @returns An outcome map with all of them `pending`.
 */
export function pendingOutcomes(fields: readonly TranslatableField[]): GenerationOutcomes {
    const outcomes: GenerationOutcomes = {};
    for (const field of fields) {
        outcomes[field] = { status: 'pending', failedLocales: [] };
    }
    return outcomes;
}

/**
 * Resolves the per-field outcome of a completed run.
 *
 * The endpoint answers with one entry per (field × locale) it attempted, each
 * carrying its own `success`. The panel used to discard all of it and branch on
 * the HTTP result alone, which is why a run where every single translation failed
 * still reported "translations generated" and reloaded the page onto unchanged
 * content.
 *
 * A requested field with no entries in the response is `untouched`, not
 * `translated`: the backend skips (field, locale) pairs that are already filled,
 * so an empty result set means nothing was attempted — reporting success there
 * would claim work that never happened.
 *
 * @param requested - Fields the run was started for.
 * @param results - The endpoint's per-pair results.
 * @returns Outcome per requested field.
 */
export function summarizeOutcomes({
    requested,
    results
}: {
    readonly requested: readonly TranslatableField[];
    readonly results: readonly TranslationResultItem[];
}): GenerationOutcomes {
    const outcomes: GenerationOutcomes = {};

    for (const field of requested) {
        const own = results.filter((result) => result.fieldType === field);

        if (own.length === 0) {
            outcomes[field] = { status: 'untouched', failedLocales: [] };
            continue;
        }

        // The STATUS comes from `success`; the locale list is only what the panel
        // can name. `locale` crosses an HTTP boundary, so an unrecognised value is
        // dropped from the list rather than rendered as `undefined` — but dropping
        // it must not also drop the failure, or an unnameable error would be
        // reported to the host as a successful translation.
        const failed = own.filter((result) => !result.success);
        const failedLocales = failed.map((result) => result.locale).filter(isSupportedLocale);

        outcomes[field] =
            failed.length > 0
                ? { status: 'failed', failedLocales }
                : { status: 'translated', failedLocales: [] };
    }

    return outcomes;
}

/**
 * Whether this run persisted at least one translation for a field the panel
 * actually asked for.
 *
 * This is what decides whether reloading the page would show the host anything
 * new. Reloading after a run that persisted nothing would just replay the same
 * screen with the failure detail wiped off it.
 *
 * The `requested` filter is load-bearing, not defensive. The request body carries
 * no field selection — the endpoint always walks every translatable field of the
 * entity — so a run started for `summary` alone also translates `richDescription`.
 * Counting those hidden successes told a non-entitled host "some translations were
 * generated" about a field their plan does not include and the panel does not
 * show, while offering no way to see any of it.
 *
 * @param results - The endpoint's per-pair results.
 * @param requested - Fields this run was started for.
 * @returns Whether anything the panel asked for succeeded.
 */
export function anyTranslationPersisted({
    results,
    requested
}: {
    readonly results: readonly TranslationResultItem[];
    readonly requested: readonly TranslatableField[];
}): boolean {
    const wanted = new Set<string>(requested);
    return results.some((result) => result.success && wanted.has(result.fieldType));
}
