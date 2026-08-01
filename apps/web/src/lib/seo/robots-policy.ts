/**
 * @file robots-policy.ts
 * @description RFC 9309 `robots.txt` group parser and root-rule conflict
 * detector (HOS-369 WA-4 / AC-A3).
 *
 * Why this exists: production's `robots.txt` is NOT the file this app emits. A
 * Cloudflare **managed content block** is concatenated ahead of the app's
 * output, and it sets `Disallow: /` for several of the very user-agents the app
 * then grants `Allow: /`. Per RFC 9309 a crawler MERGES every group matching its
 * token, and on an equally-specific conflict the least restrictive rule wins —
 * so the app's `Allow: /` silently defeats the managed `Disallow: /`. The
 * operator believes access was revoked; the crawler reads it as granted.
 * Measured consequence: GPTBot crawled 136,990 times despite the managed block
 * (spec §5.10).
 *
 * Neither source is readable as "the policy" on its own, which is exactly what
 * owner decision D-3 forbids: `robots.txt` must express exactly ONE policy.
 *
 * This module is the mechanical half of that guarantee. It takes any
 * `robots.txt` body — the app's own output, or the real concatenated production
 * file — and reports every user-agent that ends up with contradictory
 * root-path rules. It is deliberately body-in/report-out so it can be pointed at
 * a live fetch of `https://hospeda.com.ar/robots.txt` in an ops check, not only
 * at the app's generated string in a unit test.
 */

/** One directive line inside a group (e.g. `Disallow: /api/`). */
export interface RobotsRule {
    /** Lower-cased field name — `allow`, `disallow`, or `crawl-delay`. */
    readonly directive: string;
    /** The raw value, trimmed (e.g. `/api/`). */
    readonly value: string;
}

/** One RFC 9309 group: consecutive `User-agent` lines plus the rules that follow. */
export interface RobotsGroup {
    /** Lower-cased user-agent tokens this group applies to (`*` included). */
    readonly userAgents: readonly string[];
    /** The group's rules, in file order. */
    readonly rules: readonly RobotsRule[];
}

/** A user-agent granted AND denied the site root across the merged groups. */
export interface RobotsRootConflict {
    /** The lower-cased user-agent token (e.g. `gptbot`). */
    readonly userAgent: string;
    /** How many groups gave this agent `Allow: /`. */
    readonly allowRootCount: number;
    /** How many groups gave this agent `Disallow: /`. */
    readonly disallowRootCount: number;
}

/** Fields that constitute a group's rules. Everything else is ignorable. */
const GROUP_RULE_FIELDS = new Set(['allow', 'disallow', 'crawl-delay']);

interface ParsedLine {
    readonly field: string;
    readonly value: string;
}

/**
 * Parse one physical line into a `field: value` pair, dropping comments and
 * blank lines. Field names are lower-cased (RFC 9309: case-insensitive).
 */
function parseLine(line: string): ParsedLine | undefined {
    const withoutComment = line.split('#')[0] ?? '';
    const trimmed = withoutComment.trim();
    if (trimmed.length === 0) return undefined;

    const colon = trimmed.indexOf(':');
    if (colon === -1) return undefined;

    return {
        field: trimmed.slice(0, colon).trim().toLowerCase(),
        value: trimmed.slice(colon + 1).trim()
    };
}

/**
 * Parse a `robots.txt` body into its RFC 9309 groups.
 *
 * Grouping rule: consecutive `User-agent` lines form one group header and share
 * the rules that follow. Any other field closes the header, so the next
 * `User-agent` line starts a NEW group — this is what keeps Cloudflare's
 * `User-agent: *` + `Content-Signal:` preamble from being merged into the
 * per-bot `Disallow: /` groups that follow it.
 *
 * Unrecognized fields (`Content-Signal`, `Sitemap`, `Host`, ...) are ignored
 * rather than recorded, per RFC 9309's instruction that crawlers ignore lines
 * they do not understand.
 *
 * @param params.body - The full `robots.txt` text.
 * @returns Every group found, in file order. Groups with no rules are kept —
 *   an empty group is meaningful when reasoning about what a file declares.
 */
export function parseRobotsGroups({ body }: { readonly body: string }): readonly RobotsGroup[] {
    const groups: RobotsGroup[] = [];
    let userAgents: string[] = [];
    let rules: RobotsRule[] = [];
    let inHeader = false;

    const flush = (): void => {
        if (userAgents.length > 0) {
            groups.push({ userAgents, rules });
        }
        userAgents = [];
        rules = [];
    };

    for (const rawLine of body.split('\n')) {
        const parsed = parseLine(rawLine);
        if (!parsed) continue;

        if (parsed.field === 'user-agent') {
            // A user-agent line after a rule line starts a fresh group.
            if (!inHeader) flush();
            inHeader = true;
            userAgents.push(parsed.value.toLowerCase());
            continue;
        }

        inHeader = false;
        if (userAgents.length === 0) continue; // stray rule before any group
        if (GROUP_RULE_FIELDS.has(parsed.field)) {
            rules.push({ directive: parsed.field, value: parsed.value });
        }
    }

    flush();
    return groups;
}

/**
 * Find every user-agent that is both granted and denied the site root across
 * all the groups that match it.
 *
 * Only the exact root path `/` counts. A scoped rule such as
 * `Disallow: /*?*categories=` narrows access and never contradicts `Allow: /` —
 * treating it as a conflict would make the check fire on the normal, correct
 * shape of this file and train everyone to ignore it.
 *
 * @param params.body - The full `robots.txt` text — ideally the REAL served
 *   file, including any edge-injected managed block, since that is where the
 *   contradiction actually lives.
 * @returns One entry per conflicted user-agent, sorted by token. Empty means
 *   the file expresses exactly one root-level policy per agent (D-3 satisfied).
 */
export function findConflictingRootRules({
    body
}: {
    readonly body: string;
}): readonly RobotsRootConflict[] {
    const tally = new Map<string, { allow: number; disallow: number }>();

    for (const group of parseRobotsGroups({ body })) {
        const allowsRoot = group.rules.some(
            (rule) => rule.directive === 'allow' && rule.value === '/'
        );
        const disallowsRoot = group.rules.some(
            (rule) => rule.directive === 'disallow' && rule.value === '/'
        );
        if (!allowsRoot && !disallowsRoot) continue;

        for (const agent of group.userAgents) {
            const entry = tally.get(agent) ?? { allow: 0, disallow: 0 };
            if (allowsRoot) entry.allow += 1;
            if (disallowsRoot) entry.disallow += 1;
            tally.set(agent, entry);
        }
    }

    return [...tally.entries()]
        .filter(([, counts]) => counts.allow > 0 && counts.disallow > 0)
        .map(([userAgent, counts]) => ({
            userAgent,
            allowRootCount: counts.allow,
            disallowRootCount: counts.disallow
        }))
        .sort((a, b) => a.userAgent.localeCompare(b.userAgent));
}
