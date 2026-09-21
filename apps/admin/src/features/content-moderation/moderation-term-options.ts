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
 * three locales and is read by other moderation screens, which is a separate
 * question for the owner — either the enum is missing `SELF_HARM` or those
 * screens are offering a value nothing accepts. This form takes no position:
 * it offers what the schema accepts and nothing else.
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
