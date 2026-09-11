/** Conventional-commit types a branch can carry. */
export const BRANCH_TYPES = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test'] as const;

/** One of the accepted branch types. */
export type BranchType = (typeof BRANCH_TYPES)[number];

/** Longest slug tail kept after the issue number. */
const MAX_TITLE_SLUG = 40;

/**
 * Normalises whatever the user typed into a Linear issue identifier.
 *
 * Accepts `273`, `hos-273`, `HOS-273` and `#273` because those are what people
 * actually paste out of a browser tab or a chat message.
 *
 * @param input.raw - The raw first argument.
 * @returns The canonical `HOS-273` form, or `null` when it holds no number.
 *
 * @example
 * ```ts
 * normalizeIssueId({ raw: '#273' }); // 'HOS-273'
 * ```
 */
export function normalizeIssueId({ raw }: { readonly raw: string }): string | null {
    const match = /^\s*#?(?:([a-zA-Z]+)-)?(\d+)\s*$/.exec(raw);
    const number = match?.[2];
    if (number === undefined) return null;
    const team = (match?.[1] ?? 'HOS').toUpperCase();
    return `${team}-${number}`;
}

/**
 * Picks the conventional-commit type from the issue's labels.
 *
 * Mirrors the `/startIssue` command's rule so a worktree created from the
 * terminal and one created from a Claude session get the same branch name.
 *
 * @param input.labels - Label names on the issue.
 * @returns The branch type, defaulting to `feat`.
 */
export function deriveBranchType({ labels }: { readonly labels: readonly string[] }): BranchType {
    const lower = labels.map((label) => label.toLowerCase());
    if (lower.some((label) => label === 'bug' || label.startsWith('type-bug'))) return 'fix';
    if (lower.some((label) => label === 'improvement' || label.startsWith('type-improvement'))) {
        return 'refactor';
    }
    return 'feat';
}

/**
 * Converts a title into the ASCII kebab-case tail of a branch name.
 *
 * Accents are folded rather than dropped, so «Café» becomes `cafe` and not
 * `caf`: a Spanish title otherwise loses whole words to the filter.
 *
 * Truncation stops at a word boundary. A blind `slice` produced branch names
 * ending mid-word (`...no-tiene-pantall`), which read as corruption rather than
 * as a shortened title.
 *
 * @param input.title - The issue title.
 * @returns A kebab-case slug, possibly empty when the title has no ASCII left.
 */
export function slugifyTitle({ title }: { readonly title: string }): string {
    const full = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (full.length <= MAX_TITLE_SLUG) return full;

    const cut = full.slice(0, MAX_TITLE_SLUG);
    const lastDash = cut.lastIndexOf('-');
    // A single word longer than the budget has no boundary to fall back to, so
    // it is kept truncated rather than dropped entirely.
    return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

/**
 * Builds the worktree slug for an issue.
 *
 * The issue number leads so that `git worktree list` stays sortable and
 * greppable by issue, which is how every other tool here finds a worktree.
 *
 * @param input.issueId - Canonical identifier, e.g. `HOS-273`.
 * @param input.title   - The issue title; may be empty.
 * @returns The slug, e.g. `hos-273-improve-search-filters`.
 */
export function buildSlug({
    issueId,
    title
}: {
    readonly issueId: string;
    readonly title: string;
}): string {
    const prefix = issueId.toLowerCase();
    const tail = slugifyTitle({ title });
    return tail.length > 0 ? `${prefix}-${tail}` : prefix;
}

/**
 * Extracts the worktree path from `wt-create.sh` output.
 *
 * The script speaks two dialects: a fresh create ends with `DONE → <path>`,
 * while a reuse prints `EXISTS:` and then `git worktree list` output whose
 * first field is the path. Guessing the path instead of reading it is how you
 * end up operating on a directory the script never created.
 *
 * @param input.output - Everything the script wrote to stdout/stderr.
 * @returns The absolute path, or `null` when neither form is present.
 */
export function extractWorktreePath({ output }: { readonly output: string }): string | null {
    const lines = output.split('\n').map((line) => line.trim());

    for (const line of lines) {
        const done = /^DONE\s*(?:→|->)\s*(\/.+)$/.exec(line);
        if (done?.[1] !== undefined) return done[1].trim();
    }

    const existsIndex = lines.findIndex((line) => line.startsWith('EXISTS:'));
    if (existsIndex >= 0) {
        for (const line of lines.slice(existsIndex + 1)) {
            const first = line.split(/\s+/)[0];
            if (first !== undefined && first.startsWith('/')) return first;
        }
    }
    return null;
}
