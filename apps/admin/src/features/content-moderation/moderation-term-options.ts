/**
 * Select options for the moderation-term form, derived from the schema that
 * validates the submission (HOS-1068).
 *
 * These lists used to be written out by hand in the route. While they sat under
 * the misspelled `config` key nothing read them, so nobody noticed that one of
 * the seven categories on offer — `self_harm` — is not a member of
 * `ModerationCategoryEnum` at all. Fixing the key made the list live and the
 * defect reachable: an operator picking "Autolesión", fifth of seven and
 * translated in all three locales, would have been refused by the handler's own
 * `safeParse` over a value the form had just offered them.
 *
 * So the options are no longer declared. They come from
 * `createContentModerationTermSchema.shape.<field>.options` — the very object
 * the handler validates against — which makes "the form offers a value the
 * schema rejects" unrepresentable rather than merely untested. `satisfies`
 * checks the SHAPE of a field config; nothing was checking its VALUES.
 *
 * The labels stay declared, because an i18n key is not derivable from a value,
 * but each map is a total `Record` over its value type: adding a member to
 * `ModerationCategoryEnum` without a label fails `pnpm typecheck` here.
 */
import type { TranslationKey } from '@repo/i18n';
import {
    type CreateContentModerationTerm,
    createContentModerationTermSchema,
    ModerationCategoryEnum
} from '@repo/schemas';

/** The two kinds of term the schema accepts (`z.enum(['word', 'domain'])`). */
export type ModerationTermKind = CreateContentModerationTerm['kind'];

/** A value/label pair for a `SELECT` field's `typeConfig.options`. */
export type ModerationTermSelectOption = {
    readonly value: string;
    readonly label: string;
};

/**
 * A value/key pair for the entity-list filter bar, which resolves its own copy
 * instead of receiving translated text.
 */
export type ModerationTermFilterOption = {
    readonly value: string;
    readonly labelKey: TranslationKey;
};

/**
 * Label key per term kind. Total by type — a third kind in the schema fails
 * typecheck here rather than rendering an unlabelled option.
 */
export const MODERATION_TERM_KIND_LABEL_KEYS: Record<ModerationTermKind, TranslationKey> = {
    word: 'content-moderation.terms.kinds.word',
    domain: 'content-moderation.terms.kinds.domain'
};

/**
 * Label key per moderation category. Total by type over
 * {@link ModerationCategoryEnum}.
 *
 * Note there is no `self_harm` entry: the enum has no such member. A
 * `content-moderation.categories.self_harm` string does still exist in all
 * three locales, and `moderation-terms.columns.tsx` still maps it to a badge
 * colour — dead code that renders for no row, since no row can hold the value.
 *
 * Whether the enum should GAIN `SELF_HARM` is an owner decision. What is not a
 * decision, and is not contained by one: while the enum is as it is today,
 * every surface offering that value is broken, so the create form, the edit
 * form and the listing filter all derive from here instead. If the owner adds
 * the member, all three gain the option with no further edit; if they do not,
 * none of them can offer it.
 */
export const MODERATION_CATEGORY_LABEL_KEYS: Record<ModerationCategoryEnum, TranslationKey> = {
    [ModerationCategoryEnum.SPAM]: 'content-moderation.categories.spam',
    [ModerationCategoryEnum.SEXUAL]: 'content-moderation.categories.sexual',
    [ModerationCategoryEnum.VIOLENCE]: 'content-moderation.categories.violence',
    [ModerationCategoryEnum.HATE]: 'content-moderation.categories.hate',
    [ModerationCategoryEnum.HARASSMENT]: 'content-moderation.categories.harassment',
    [ModerationCategoryEnum.OTHER]: 'content-moderation.categories.other'
};

/**
 * Builds the "Tipo" select options from the schema's own `kind` enum.
 *
 * @param params - Receives the active translator.
 * @param params.t - Resolves a {@link TranslationKey} to display text.
 * @returns `{ options }` in the schema's declaration order; every value is one
 *   `createContentModerationTermSchema` accepts.
 */
export const buildModerationTermKindOptions = ({
    t
}: {
    t: (key: TranslationKey) => string;
}): { options: ModerationTermSelectOption[] } => ({
    options: createContentModerationTermSchema.shape.kind.options.map((value) => ({
        value,
        label: t(MODERATION_TERM_KIND_LABEL_KEYS[value])
    }))
});

/**
 * Builds the "Categoría" select options from the schema's own category enum.
 *
 * @param params - Receives the active translator.
 * @param params.t - Resolves a {@link TranslationKey} to display text.
 * @returns `{ options }` in the enum's declaration order; every value is one
 *   `createContentModerationTermSchema` accepts.
 */
export const buildModerationCategoryOptions = ({
    t
}: {
    t: (key: TranslationKey) => string;
}): { options: ModerationTermSelectOption[] } => ({
    options: createContentModerationTermSchema.shape.category.options.map((value) => ({
        value,
        label: t(MODERATION_CATEGORY_LABEL_KEYS[value])
    }))
});

/**
 * Builds the listing filter's category options from the same schema.
 *
 * The filter bar resolves its own copy, so these carry the key rather than the
 * text. Derived for the same reason as the form's: a filter value no row can
 * ever hold returns an empty list that reads as "no results" instead of "not a
 * thing" — and `self_harm`, which the badge still renders, is exactly the one
 * an operator would reach for.
 *
 * @returns `{ options }` in the enum's declaration order.
 */
export const buildModerationCategoryFilterOptions = (): {
    options: ModerationTermFilterOption[];
} => ({
    options: createContentModerationTermSchema.shape.category.options.map((value) => ({
        value,
        labelKey: MODERATION_CATEGORY_LABEL_KEYS[value]
    }))
});

/**
 * Builds the listing filter's term-kind options from the same schema.
 *
 * @returns `{ options }` in the schema's declaration order.
 */
export const buildModerationTermKindFilterOptions = (): {
    options: ModerationTermFilterOption[];
} => ({
    options: createContentModerationTermSchema.shape.kind.options.map((value) => ({
        value,
        labelKey: MODERATION_TERM_KIND_LABEL_KEYS[value]
    }))
});
