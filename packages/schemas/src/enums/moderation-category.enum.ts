/**
 * Content moderation category identifiers (SPEC-195).
 *
 * Maps to the categories used by the OpenAI Moderation API plus `spam` and
 * `other` for the local word-list fallback path. Used as the `category`
 * column value in `content_moderation_terms` and as keys in
 * `ModerationResult.categories`.
 *
 * @see SPEC-195 design §3.1
 */
export enum ModerationCategoryEnum {
    SPAM = 'spam',
    SEXUAL = 'sexual',
    VIOLENCE = 'violence',
    HATE = 'hate',
    HARASSMENT = 'harassment',
    OTHER = 'other'
}
