import { moderateTextInputSchema } from './types.js';
import type { ModerateTextInput, ModerationResult } from './types.js';

// ---------------------------------------------------------------------------
// Env-var blocklist — parsed ONCE at module load, never re-read per call.
// Same parsing semantics as MessageService.parseBlocklist.
// ---------------------------------------------------------------------------

/**
 * Parses a comma-separated env var into a frozen lowercase string array.
 * Empty strings and surrounding whitespace are filtered out.
 * A trailing comma is tolerated (produces no extra empty entry after filter).
 *
 * @param raw - Raw string value from process.env (or undefined if absent).
 * @returns Readonly frozen array of trimmed, lowercased, non-empty entries.
 */
function parseBlocklist(raw: string | undefined): readonly string[] {
    if (!raw) return Object.freeze([]);
    return Object.freeze(
        raw
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 0)
    );
}

/**
 * Blocked word substrings — mutable so tests can call {@link _testResetBlocklists}
 * to re-read env vars without a full module reload. In production code this value
 * is set once at module load and never touched again.
 *
 * @internal
 */
let _blockedWords: readonly string[] = parseBlocklist(process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS);

/**
 * Blocked domain hostnames — same mutability contract as {@link _blockedWords}.
 *
 * @internal
 */
let _blockedDomains: readonly string[] = parseBlocklist(
    process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS
);

/**
 * **Test-only escape hatch.** Re-parses the blocklist env vars from
 * `process.env` and updates the module-level arrays.
 *
 * Call this AFTER setting `process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS` /
 * `HOSPEDA_MESSAGING_BLOCKED_DOMAINS` (e.g. via `vi.stubEnv`) and BEFORE
 * invoking `moderateText` in each test case.
 *
 * This function is intentionally NOT exported from `src/index.ts` (the barrel)
 * so it is invisible to consumers; only test files that import directly from
 * `src/moderate-text.ts` or via `test/…` can access it.
 *
 * @example
 * ```ts
 * // In a test file:
 * import { moderateText, _testResetBlocklists } from '../src/moderate-text.js';
 *
 * vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'badword');
 * _testResetBlocklists();
 * const result = await moderateText({ text: 'contains badword' });
 * ```
 *
 * @internal Do NOT use outside of tests.
 */
export function _testResetBlocklists(): void {
    _blockedWords = parseBlocklist(process.env.HOSPEDA_MESSAGING_BLOCKED_WORDS);
    _blockedDomains = parseBlocklist(process.env.HOSPEDA_MESSAGING_BLOCKED_DOMAINS);
}

/**
 * URL pattern used to extract links from text for domain-level blocklist checks.
 * Matches `http://` or `https://` followed by non-whitespace characters.
 */
const URL_PATTERN = /https?:\/\/[^\s]+/gi;

/**
 * Evaluates text content against configured blocklists and returns a
 * structured moderation result.
 *
 * This is the v1 stub engine. It is backed by environment-variable word/domain
 * lists; the real scoring engine (graded categories, OpenAI Moderation API,
 * DB-backed editable lists) will land in SPEC-195 with **no consumer-facing
 * API changes**.
 *
 * ## Behavior
 *
 * - Blocked words are checked via case-insensitive substring scan of the full
 *   text (e.g. `"badword"` matches `"contains badword here"`).
 * - Blocked domains are checked by extracting all `http://` / `https://` URLs
 *   from the text and comparing their hostnames (including sub-domains) against
 *   the domain blocklist.
 * - **Any** match → `score: 1.0`, `categories.other: 1.0`, all other category
 *   scores are `0`, and `matchedTerms` lists every matched word or domain.
 * - No match → `score: 0`, all categories `0`, `matchedTerms: []`.
 * - The function is `async` even though internally synchronous so that
 *   consumers `await` it from day one and the call-site contract never needs to
 *   change when a real async engine replaces this stub in SPEC-195.
 * - Blocklists are parsed from `HOSPEDA_MESSAGING_BLOCKED_WORDS` and
 *   `HOSPEDA_MESSAGING_BLOCKED_DOMAINS` **once at module load**. Changes to
 *   these env vars after startup have no effect (use {@link _testResetBlocklists}
 *   in tests to force a re-read).
 *
 * ## Environment variables
 *
 * | Variable | Format | Example |
 * |---|---|---|
 * | `HOSPEDA_MESSAGING_BLOCKED_WORDS` | CSV of substrings | `"spam,badword,forbidden"` |
 * | `HOSPEDA_MESSAGING_BLOCKED_DOMAINS` | CSV of domain names | `"spam.com,evil.org"` |
 *
 * @param input - `{ text, context? }` — validated by {@link moderateTextInputSchema}.
 * @returns Promise resolving to a {@link ModerationResult}.
 * @throws {Error} If `input` fails Zod validation (e.g. empty text string).
 *
 * @example
 * ```ts
 * // Clean text — returns all zeros
 * const clean = await moderateText({ text: 'Great place to stay!', context: 'review' });
 * // clean.score === 0, clean.matchedTerms.length === 0
 *
 * // Blocked word present
 * const blocked = await moderateText({ text: 'Contains badword here', context: 'message' });
 * // blocked.score === 1.0, blocked.matchedTerms includes 'badword'
 *
 * // Blocked domain in a URL
 * const domain = await moderateText({ text: 'Visit https://spam.com for info' });
 * // domain.score === 1.0, domain.matchedTerms includes 'spam.com'
 * ```
 */
export async function moderateText(input: ModerateTextInput): Promise<ModerationResult> {
    // Validate input via Zod (RORO — repo validates inputs with Zod at service boundaries)
    moderateTextInputSchema.parse(input);

    const { text } = input;
    const matchedTerms: string[] = [];

    // Word-level blocklist: case-insensitive substring scan
    if (_blockedWords.length > 0) {
        const lowerText = text.toLowerCase();
        for (const word of _blockedWords) {
            if (lowerText.includes(word) && !matchedTerms.includes(word)) {
                matchedTerms.push(word);
            }
        }
    }

    // Domain-level blocklist: extract URLs, compare hostnames
    if (_blockedDomains.length > 0) {
        const urlMatches = text.match(URL_PATTERN) ?? [];
        for (const urlMatch of urlMatches) {
            try {
                const hostname = new URL(urlMatch).hostname.toLowerCase();
                for (const domain of _blockedDomains) {
                    if (
                        (hostname === domain || hostname.endsWith(`.${domain}`)) &&
                        !matchedTerms.includes(domain)
                    ) {
                        matchedTerms.push(domain);
                    }
                }
            } catch {
                // If the matched string is not a valid URL, skip — do not block on parse errors.
            }
        }
    }

    if (matchedTerms.length > 0) {
        return {
            score: 1.0,
            categories: Object.freeze({
                spam: 0,
                sexual: 0,
                violence: 0,
                hate: 0,
                harassment: 0,
                other: 1.0
            }),
            matchedTerms: Object.freeze(matchedTerms)
        };
    }

    return {
        score: 0,
        categories: Object.freeze({
            spam: 0,
            sexual: 0,
            violence: 0,
            hate: 0,
            harassment: 0,
            other: 0
        }),
        matchedTerms: Object.freeze([])
    };
}
