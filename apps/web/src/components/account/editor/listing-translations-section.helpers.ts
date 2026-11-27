/**
 * @file listing-translations-section.helpers.ts
 * @description Pure display rules of the listing translations section (HOS-2658 §6.1).
 *
 * The pair state is computed by the API; these helpers only decide how each state
 * looks and which actions it allows. Type-only imports from `@repo/schemas` keep
 * server code out of the island bundle (R-10).
 */
import type {
    ListingTranslationField,
    ListingTranslationsResponse,
    ListingTranslationVertical
} from '@repo/schemas';
import type { StatusTone } from '@/components/account/ui/status-tone';
import { LISTING_SECTION_PRESENTATION } from '@/lib/editor/listing-section-presentation';

/** Display state of one `(field, locale)` pair, as answered by the API. */
export type ListingTranslationPairState =
    ListingTranslationsResponse['fields'][number]['locales']['en']['state'];

/** AI availability of the listing owner's plan, as answered by the API. */
export type ListingTranslationAiStatus = ListingTranslationsResponse['ai']['status'];

const KEY_PREFIX = 'account.editorTranslations';

const PILL_TONE: Readonly<Record<ListingTranslationPairState, StatusTone>> = {
    auto: 'success',
    manual: 'info',
    stale: 'warning',
    pending: 'neutral',
    noQuota: 'warning',
    noEntitlement: 'neutral',
    noSource: 'neutral'
};

/** Tone of the state pill. */
export function pillToneFor({ state }: { readonly state: ListingTranslationPairState }): {
    readonly tone: StatusTone;
} {
    return { tone: PILL_TONE[state] };
}

/** i18n key of the state pill; an empty manual pair says the Spanish text is shown. */
export function pillLabelKeyFor({
    state,
    value
}: {
    readonly state: ListingTranslationPairState;
    readonly value: string;
}): { readonly key: string } {
    if (state === 'manual' && value.trim() === '') {
        return { key: `${KEY_PREFIX}.state.manualEmpty` };
    }
    return { key: `${KEY_PREFIX}.state.${state}` };
}

/**
 * Whether "Traducir con IA" is enabled and, when it is not, the i18n key of the
 * visible reason. A missing Spanish source wins over the plan reasons.
 */
export function aiButtonStateFor({
    state,
    aiStatus
}: {
    readonly state: ListingTranslationPairState;
    readonly aiStatus: ListingTranslationAiStatus;
}): { readonly enabled: boolean; readonly reasonKey?: string } {
    if (state === 'noSource') {
        return { enabled: false, reasonKey: `${KEY_PREFIX}.action.translateAiDisabled.noSource` };
    }
    if (aiStatus === 'quota') {
        return { enabled: false, reasonKey: `${KEY_PREFIX}.action.translateAiDisabled.noQuota` };
    }
    if (aiStatus === 'entitlement') {
        return {
            enabled: false,
            reasonKey: `${KEY_PREFIX}.action.translateAiDisabled.noEntitlement`
        };
    }
    return { enabled: true };
}

/** "Guardar" is hidden when there is no Spanish source to translate. */
export function isSaveVisible({ state }: { readonly state: ListingTranslationPairState }): {
    readonly visible: boolean;
} {
    return { visible: state !== 'noSource' };
}

/**
 * "Guardar" is enabled when the draft differs from the stored value. A stale pair
 * can be saved unchanged: saving confirms the owner reviewed it (AC-12).
 */
export function isSaveEnabled({
    state,
    dirty
}: {
    readonly state: ListingTranslationPairState;
    readonly dirty: boolean;
}): { readonly enabled: boolean } {
    if (state === 'noSource') return { enabled: false };
    if (state === 'stale') return { enabled: true };
    return { enabled: dirty };
}

/** Pairs that call for the owner's attention; they feed the tab counts. */
export function needsReview({ state }: { readonly state: ListingTranslationPairState }): {
    readonly needsReview: boolean;
} {
    return {
        needsReview:
            state === 'stale' ||
            state === 'pending' ||
            state === 'noQuota' ||
            state === 'noEntitlement'
    };
}

/** Catalog section where each field's Spanish source is edited. */
const SOURCE_SECTION_ID: Readonly<Record<ListingTranslationField, string>> = {
    name: 'basicInfo',
    summary: 'basicInfo',
    description: 'basicInfo',
    richDescription: 'basicInfo',
    entryNote: 'nightInfo'
};

/**
 * i18n label keys of the editor sections that hold each field's Spanish source,
 * read from the editor presentation (one source of truth for section names).
 * A field whose section the vertical does not have is left out.
 */
export function sourceSectionLabelKeysFor({
    vertical
}: {
    readonly vertical: ListingTranslationVertical;
}): { readonly labelKeys: Readonly<Partial<Record<ListingTranslationField, string>>> } {
    const presentation = LISTING_SECTION_PRESENTATION[vertical];
    const labelKeys: Partial<Record<ListingTranslationField, string>> = {};
    for (const [field, sectionId] of Object.entries(SOURCE_SECTION_ID) as [
        ListingTranslationField,
        string
    ][]) {
        const labelKey = presentation[sectionId]?.labelKey;
        if (labelKey) labelKeys[field] = labelKey;
    }
    return { labelKeys };
}
