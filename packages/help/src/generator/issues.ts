/**
 * @file issues.ts
 * @description What the generator and guard (a) report (HOS-2410
 * `docs/guards.md` §2). Each issue names its predicate and the article.
 */

/**
 * Predicate ids. `a1`–`a9` are guard (a)'s; `IL-1`–`IL-5` are the interlinking
 * rules of `docs/data-model.md` §3.1, which guard (a) also enforces (D-H9).
 */
export type HelpCatalogPredicate =
    | 'a1'
    | 'a2'
    | 'a3'
    | 'a4'
    | 'a5'
    | 'a6'
    | 'a7'
    | 'a8'
    | 'a9'
    | 'IL-1'
    | 'IL-2'
    | 'IL-3'
    | 'IL-4'
    | 'IL-5';

/** One problem in the catalog. */
export interface HelpCatalogIssue {
    /** Which rule failed. */
    readonly predicate: HelpCatalogPredicate;
    /** Content path relative to the content dir (`es/common/photos.md`), when known. */
    readonly file?: string;
    /** The article id, when known. */
    readonly articleId?: string;
    /** Human-readable detail. */
    readonly detail: string;
}

/**
 * Builds an issue, leaving out the location fields that are unknown.
 *
 * @param args - The predicate, the detail and the optional location
 * @returns The issue
 */
export function helpIssue({
    predicate,
    detail,
    file,
    articleId
}: {
    readonly predicate: HelpCatalogPredicate;
    readonly detail: string;
    readonly file?: string | undefined;
    readonly articleId?: string | undefined;
}): HelpCatalogIssue {
    return {
        predicate,
        detail,
        ...(file === undefined ? {} : { file }),
        ...(articleId === undefined ? {} : { articleId })
    };
}
