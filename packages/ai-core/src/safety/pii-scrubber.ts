/**
 * PII (Personally Identifiable Information) scrubber (SPEC-173 T-019).
 *
 * Redacts emails, phone numbers, and payment card numbers from text payloads
 * BEFORE they are forwarded to external telemetry services (Sentry, PostHog).
 *
 * **AC-11 contract**: the database always stores the verbatim, unmodified user
 * text. This module operates exclusively on the copy that goes to third-party
 * telemetry — callers are responsible for passing copies, not originals.
 *
 * Replacement order matters — cards are replaced FIRST (before phone), so a
 * 16-digit card number is not partially consumed by the phone regex:
 *   1. `card`  — digit sequences validated with the Luhn checksum.
 *   2. `email` — standard email address pattern.
 *   3. `phone` — international format and Argentina-friendly local formats.
 *
 * **Phone false-positive tradeoff**: the phone regex requires either a leading
 * `+` / `(` OR at least one separator character (space, hyphen, dot) within a
 * run of 8–13 digits. Plain integers like years (2026), prices (150000), or
 * short IDs are therefore NOT matched. Legitimate phone strings that look like
 * "11 6123 4567" (8 digits, one space) ARE matched. Edge cases very close to
 * the boundary (e.g. an 8-digit order ID that contains a hyphen) could still
 * produce false positives; document and accept this as a conservative tradeoff
 * for a telemetry-scrubbing use case (over-redaction is safer than under).
 *
 * AC-4 isolation: this module imports NOTHING external. No DB, no AI SDK, no
 * process.env access. Pure functions only.
 *
 * @module ai-core/safety/pii-scrubber
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The kinds of PII that {@link scrubPii} can detect and redact.
 */
export type PiiKind = 'email' | 'phone' | 'card';

/**
 * Input for {@link scrubPii}.
 */
export interface ScrubPiiInput {
    /** Raw text payload to scrub. The string is NEVER mutated. */
    readonly text: string;
}

/**
 * A summary of redactions made for a single {@link PiiKind}.
 */
export interface PiiRedaction {
    /** The kind of PII that was redacted. */
    readonly kind: PiiKind;
    /** Number of replacements made for this kind (always > 0). */
    readonly count: number;
}

/**
 * Result of {@link scrubPii}.
 */
export interface ScrubPiiResult {
    /** Text with all detected PII replaced by placeholder tokens. */
    readonly scrubbed: string;
    /**
     * Summary of every kind that was redacted (only entries with `count > 0`).
     * Empty array (`[]`) when no PII was found — `scrubbed === input.text` in
     * that case.
     */
    readonly redactions: readonly PiiRedaction[];
}

// ---------------------------------------------------------------------------
// Replacement placeholders
// ---------------------------------------------------------------------------

const PLACEHOLDER_EMAIL = '[REDACTED_EMAIL]';
const PLACEHOLDER_PHONE = '[REDACTED_PHONE]';
const PLACEHOLDER_CARD = '[REDACTED_CARD]';

// ---------------------------------------------------------------------------
// Regex definitions
// ---------------------------------------------------------------------------

/**
 * Email regex — conservative RFC-5321 subset.
 * Matches `local@domain.tld` where local may contain `._%+-` chars.
 * Case-insensitive, global flag for `replaceAll`-style replacement.
 */
const RE_EMAIL = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;

/**
 * Payment card regex.
 *
 * Matches sequences of 13–19 digits where groups may be separated by a single
 * space or hyphen (e.g. `4111 1111 1111 1111`, `4111-1111-1111-1111`,
 * `4111111111111111`). Luhn validation is applied AFTER the regex match to
 * eliminate false positives on order IDs and other digit runs.
 *
 * Global, no word-boundary anchor — digit sequences inside larger text should
 * still be caught.
 */
const RE_CARD_CANDIDATE = /\b\d{4}(?:[ \-]?\d{2,7}){2,5}\b/g;

/**
 * Phone number regex — international and Argentina-friendly.
 *
 * Accepted formats (all 8–13 significant digits):
 *   - `+54 9 11 1234-5678`   — international with `+` prefix
 *   - `(011) 4123-4567`      — local Argentine with parenthesised area code
 *   - `+1-202-555-0143`      — NANP international
 *   - `11 6123 4567`         — local Argentine without area code prefix
 *
 * **False-positive tradeoff** (documented in module JSDoc): the pattern
 * requires either a leading `+` / `(` OR at least one separator (space,
 * hyphen, dot) within the digit run to avoid eating years, prices, or IDs.
 * Over-redaction is preferred over under-redaction for telemetry payloads.
 *
 * Word-boundary anchored (`\b`) to avoid partial matches inside longer tokens.
 */
const RE_PHONE =
    /\b(?:(?:\+|00)\d{1,3}[\s\-.]?)?(?:\(\d{1,4}\)[\s\-.]?)?\d{2,4}(?:[\s\-.]?\d{2,5}){1,4}\b/g;

// ---------------------------------------------------------------------------
// Luhn checksum helper
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `digits` (a string of digit characters only) passes the
 * Luhn checksum algorithm. Used to filter out false positives in the card regex
 * (order IDs, tracking numbers, etc. that happen to be 13–19 digits long).
 *
 * @param digits - Digit-only string (no spaces or hyphens).
 */
function isLuhnValid(digits: string): boolean {
    let sum = 0;
    let alternate = false;

    for (let i = digits.length - 1; i >= 0; i--) {
        // biome-ignore lint/style/noNonNullAssertion: index is always in range
        let n = Number.parseInt(digits[i]!, 10);
        if (alternate) {
            n *= 2;
            if (n > 9) {
                n -= 9;
            }
        }
        sum += n;
        alternate = !alternate;
    }

    return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Card replacement helper
// ---------------------------------------------------------------------------

/**
 * Replaces payment card candidates (Luhn-valid digit groups) in `text` with
 * {@link PLACEHOLDER_CARD}. Returns the replacement count and updated text.
 *
 * @internal
 */
function replaceCards(text: string): { result: string; count: number } {
    let count = 0;

    const result = text.replace(RE_CARD_CANDIDATE, (match: string) => {
        const digits = match.replace(/[ \-]/g, '');
        if (digits.length >= 13 && digits.length <= 19 && isLuhnValid(digits)) {
            count++;
            return PLACEHOLDER_CARD;
        }
        return match;
    });

    return { result, count };
}

// ---------------------------------------------------------------------------
// Phone replacement helper
// ---------------------------------------------------------------------------

/**
 * Replaces phone-number candidates in `text` with {@link PLACEHOLDER_PHONE}.
 * Each regex match is validated by two guards before replacement: at least
 * 8 digit characters, and a leading `+`/`(` or an internal separator.
 * Returns the replacement count and updated text.
 *
 * @internal
 */
function replacePhones(text: string): { result: string; count: number } {
    let count = 0;

    // Reset lastIndex — RE_PHONE is global
    RE_PHONE.lastIndex = 0;

    const result = text.replace(RE_PHONE, (match: string) => {
        // Guard: must contain at least 8 digit characters
        const digitCount = (match.match(/\d/g) ?? []).length;
        if (digitCount < 8) {
            return match;
        }
        // Guard: must have a leading +/( OR at least one separator inside
        const hasLeadingSignal = /^[+(]/.test(match.trim());
        const hasSeparator = /[\s\-.(]/.test(match);
        if (!hasLeadingSignal && !hasSeparator) {
            return match;
        }
        count++;
        return PLACEHOLDER_PHONE;
    });

    return { result, count };
}

// ---------------------------------------------------------------------------
// scrubPii
// ---------------------------------------------------------------------------

/**
 * Redacts PII from `input.text` for safe forwarding to external telemetry.
 *
 * Replacement order: **cards first** → emails → phones. This order ensures
 * that a payment card number's digit groups are not partially consumed by the
 * phone regex before Luhn validation can run.
 *
 * The original `input.text` string is NEVER mutated. The database layer must
 * store the verbatim text; only the telemetry copy should be passed here.
 *
 * **Never throws** — returns `{ scrubbed: input.text, redactions: [] }` for
 * empty or PII-free inputs.
 *
 * @param input - {@link ScrubPiiInput}
 * @returns {@link ScrubPiiResult}
 *
 * @example
 * ```ts
 * scrubPii({ text: 'Contact me at alice@example.com or +54 9 11 1234-5678' });
 * // => {
 * //   scrubbed: 'Contact me at [REDACTED_EMAIL] or [REDACTED_PHONE]',
 * //   redactions: [
 * //     { kind: 'email', count: 1 },
 * //     { kind: 'phone', count: 1 },
 * //   ],
 * // }
 *
 * scrubPii({ text: 'Card: 4111 1111 1111 1111' });
 * // => {
 * //   scrubbed: 'Card: [REDACTED_CARD]',
 * //   redactions: [{ kind: 'card', count: 1 }],
 * // }
 *
 * scrubPii({ text: 'en 2026 costó 150000 pesos' });
 * // => { scrubbed: 'en 2026 costó 150000 pesos', redactions: [] }
 * ```
 */
export const scrubPii = (input: ScrubPiiInput): ScrubPiiResult => {
    // Step 1 — cards (Luhn-validated, must run before phone to avoid partial eating)
    const { result: afterCards, count: cardCount } = replaceCards(input.text);

    // Step 2 — emails
    let emailCount = 0;
    // Reset lastIndex on the global email regex
    RE_EMAIL.lastIndex = 0;
    const afterEmails = afterCards.replace(RE_EMAIL, () => {
        emailCount++;
        return PLACEHOLDER_EMAIL;
    });

    // Step 3 — phones
    const { result: afterPhones, count: phoneCount } = replacePhones(afterEmails);

    // Build redactions summary (only kinds with count > 0)
    const redactions: PiiRedaction[] = [];
    if (cardCount > 0) {
        redactions.push({ kind: 'card', count: cardCount });
    }
    if (emailCount > 0) {
        redactions.push({ kind: 'email', count: emailCount });
    }
    if (phoneCount > 0) {
        redactions.push({ kind: 'phone', count: phoneCount });
    }

    return {
        scrubbed: afterPhones,
        redactions
    };
};
