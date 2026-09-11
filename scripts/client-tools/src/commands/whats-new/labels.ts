/**
 * The two novelty-decision labels (HOS-1214 D-2).
 *
 * A PR carries at most one of these once evaluated. Both together is a
 * conflict (they are mutually exclusive by construction); neither is a
 * missing decision. Never a third label — the audit blocks on lack of
 * decision, never on lack of novelty.
 */
export const WHATS_NEW_NONE_LABEL = 'whats-new-none';
export const WHATS_NEW_DONE_LABEL = 'whats-new-done';

/**
 * PR authors whose PRs are exempt from the novelty decision (HOS-1214 §6.2).
 *
 * Mirrors `validate-pr-title.yml`'s bot exemption and its documented reason:
 * this keys on the PR's AUTHOR, never on `github.actor` / whoever is running
 * the audit. A human updating a dependabot PR's branch must not inherit a
 * novelty decision the bot cannot make.
 */
export const EXEMPT_BOT_AUTHORS: ReadonlySet<string> = new Set([
    'dependabot[bot]',
    'github-actions[bot]'
]);

/**
 * Whether a PR author is exempt from the novelty decision.
 *
 * @param input.author - The PR author's login, as reported by the GitHub API.
 * @returns `true` for a bot author in {@link EXEMPT_BOT_AUTHORS}.
 */
export function isBotAuthor({ author }: { readonly author: string }): boolean {
    return EXEMPT_BOT_AUTHORS.has(author);
}
