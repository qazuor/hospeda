/**
 * @file author-indexable.ts
 * @description Single source of truth for the "is this author page indexable?"
 * predicate. The author page (`/autores/<slug>/`) and the dynamic sitemap must
 * BOTH decide with this function — never with an ad-hoc inline check that could
 * drift apart and leave a `noindex` page listed in the sitemap (or the reverse).
 *
 * HOS-375 §6.5 (G-3).
 */

/**
 * Why an author page is not indexable, or `null` when it is.
 *
 * Returned rather than inferred by the caller so a page can log/annotate the
 * decision, and so the table-driven tests can assert WHICH condition failed
 * instead of just that something did.
 */
export type AuthorNotIndexableReason =
    | 'system-account'
    | 'no-published-items'
    | 'missing-bio'
    | 'missing-avatar'
    | 'paginated';

/**
 * Everything the predicate needs. Every field is tolerated as `null`/`undefined`
 * so the same input shape works from the author page (which has the full author
 * payload) and from the sitemap (which has a leaner list item).
 *
 * Absent values are treated as FAILING their condition — an author whose bio
 * did not come back in the payload is not indexable. The one exception is
 * {@link AuthorIndexabilityInput.page}: see its docs.
 */
export interface AuthorIndexabilityInput {
    /**
     * `users.is_system_account`. `true` for accounts that represent the platform
     * rather than a person.
     *
     * This is a **content-curation rule, not an authorization check**: there is
     * no permission that means "deserves a public author profile", so the repo's
     * "never check roles directly, always use `PermissionEnum`" convention does
     * NOT apply here. Do not "fix" this into a permission check.
     *
     * It is also deliberately not a ROLE check. Roles are mutable and this
     * property is not: evaluating `SUPER_ADMIN`/`ADMIN` live would mean promoting
     * a real editor silently unpublishes their author page and drops it from the
     * sitemap, and demoting a staff account publishes it — an indexed URL
     * appearing or vanishing as a side effect of a permissions change nobody
     * connected to SEO. Role decided this flag's value exactly once, at backfill
     * time (`0034-system-account-flag-staff`). See HOS-375 §6.10.1.
     *
     * A missing value is treated as `false` (a person), matching the column
     * default — an author page is not withheld because a payload omitted the
     * field.
     */
    readonly isSystemAccount?: boolean | null;

    /** Count of the author's published posts. */
    readonly publishedPostsCount?: number | null;

    /** Count of the author's published events. */
    readonly publishedEventsCount?: number | null;

    /** `profile.bio`. Whitespace-only counts as empty. */
    readonly bio?: string | null;

    /** `profile.avatar`. Whitespace-only counts as empty. */
    readonly avatar?: string | null;

    /**
     * 1-based page number. Paginated pages (2+) are always `noindex`.
     *
     * Omitting it means page 1. That default exists for the sitemap, which only
     * ever emits page-1 URLs and has no page to pass. The author page always has
     * one from its route, so it should always pass it explicitly.
     */
    readonly page?: number | null;
}

/** Outcome of {@link evaluateAuthorIndexability}. */
export interface AuthorIndexabilityResult {
    /** `true` iff every condition in HOS-375 §6.5 holds. */
    readonly isIndexable: boolean;

    /** The FIRST condition that failed, or `null` when indexable. */
    readonly reason: AuthorNotIndexableReason | null;
}

/** Whether a string field carries actual content. */
function isNonEmpty(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Decide whether an author page may be indexed and listed in the sitemap.
 *
 * All five conditions of HOS-375 §6.5 must hold: not a system account, at least
 * one published post or event, a non-empty bio, a non-empty avatar, and page 1.
 * Conditions are evaluated in that order and the first failure is reported.
 *
 * @param input - {@link AuthorIndexabilityInput} from whichever source the caller has.
 * @returns {@link AuthorIndexabilityResult}.
 *
 * @example
 * evaluateAuthorIndexability({
 *   isSystemAccount: false,
 *   publishedPostsCount: 22,
 *   publishedEventsCount: 52,
 *   bio: 'Equipo editorial de Hospeda',
 *   avatar: 'https://cdn.example/avatar.jpg',
 *   page: 1
 * }); // { isIndexable: true, reason: null }
 *
 * @example
 * evaluateAuthorIndexability({ isSystemAccount: true, ... });
 * // { isIndexable: false, reason: 'system-account' }
 */
export function evaluateAuthorIndexability(
    input: AuthorIndexabilityInput
): AuthorIndexabilityResult {
    if (input.isSystemAccount === true) {
        return { isIndexable: false, reason: 'system-account' };
    }

    const publishedItems = (input.publishedPostsCount ?? 0) + (input.publishedEventsCount ?? 0);
    if (publishedItems < 1) {
        return { isIndexable: false, reason: 'no-published-items' };
    }

    if (!isNonEmpty(input.bio)) {
        return { isIndexable: false, reason: 'missing-bio' };
    }

    if (!isNonEmpty(input.avatar)) {
        return { isIndexable: false, reason: 'missing-avatar' };
    }

    if ((input.page ?? 1) !== 1) {
        return { isIndexable: false, reason: 'paginated' };
    }

    return { isIndexable: true, reason: null };
}
