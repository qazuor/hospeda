/**
 * @file format-issues.ts
 * @description Prints catalog issues one per line, predicate first, so a
 * failing run names the rule and the article (HOS-2410 `docs/guards.md` §1).
 */

import type { HelpCatalogIssue } from './issues';

/**
 * Formats issues for the terminal.
 *
 * @param args.issues - The issues
 * @returns One line per issue: `(<predicate>) <file or id>: <detail>`
 */
export function formatHelpIssues({
    issues
}: {
    readonly issues: readonly HelpCatalogIssue[];
}): string {
    return issues
        .map(
            (issue) =>
                `  - (${issue.predicate}) ${issue.file ?? issue.articleId ?? 'catalog'}: ${issue.detail}`
        )
        .join('\n');
}
