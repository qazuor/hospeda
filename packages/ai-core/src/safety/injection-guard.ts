/**
 * Prompt injection detection and input sanitisation (SPEC-173 T-019).
 *
 * Detects attempts to override LLM system instructions, reveal prompts, or
 * reassign the model's role via user-supplied text. The sanitiser strips
 * invisible characters and normalises whitespace BEFORE running detection so
 * that obfuscation attempts (e.g. zero-width chars inserted between words) are
 * handled transparently.
 *
 * **Detection-only contract**: this module performs SYNTACTIC sanitisation
 * (invisible chars, control chars, excess newlines, length) but NEVER censors
 * semantic content. Override phrases are reported via `matches` but left intact
 * in `sanitizedText` — the caller decides the enforcement policy.
 *
 * Legitimate text that happens to contain the word "instrucciones" in a benign
 * context (e.g. "leé las instrucciones del juego") is NOT flagged — rules match
 * full-phrase patterns, not isolated keywords.
 *
 * Language coverage: English + Spanish (primary locales for the Hospeda
 * platform — es/en). Portuguese patterns may be added in a future revision.
 *
 * AC-4 isolation: this module imports NOTHING external. No DB, no AI SDK, no
 * process.env access. Pure functions only.
 *
 * @module ai-core/safety/injection-guard
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default maximum allowed input length in characters.
 * Applied after all other sanitisation steps (trim, invisible-char strip,
 * newline collapse). Callers may override via
 * {@link GuardPromptInjectionInput.maxLength}.
 */
export const DEFAULT_MAX_INPUT_LENGTH = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link guardPromptInjection}.
 */
export interface GuardPromptInjectionInput {
    /** Raw user-supplied text to sanitise and analyse. */
    readonly text: string;
    /**
     * Maximum character length to allow after sanitisation.
     * Defaults to {@link DEFAULT_MAX_INPUT_LENGTH} (10 000 chars).
     * Truncation is the last step, applied after stripping invisible chars and
     * collapsing newline runs.
     */
    readonly maxLength?: number;
}

/**
 * Severity level for a detected injection signal.
 * - `'none'`  — no injection patterns found.
 * - `'low'`   — weak signals (role-play requests, jailbreak keywords).
 * - `'high'`  — direct instruction-override or prompt-exfiltration attempts.
 */
export type InjectionSeverity = 'none' | 'low' | 'high';

/**
 * A single matched injection rule.
 */
export interface InjectionMatch {
    /**
     * Stable identifier of the matched rule
     * (e.g. `'override-instructions-en'`).
     */
    readonly pattern: string;
    /** Severity of this individual match (never `'none'`). */
    readonly severity: Exclude<InjectionSeverity, 'none'>;
}

/**
 * Result of {@link guardPromptInjection}.
 */
export interface GuardPromptInjectionResult {
    /**
     * Text after sanitisation (leading/trailing whitespace trimmed,
     * zero-width / invisible chars removed, control chars stripped,
     * excess newlines collapsed, truncated to `maxLength`).
     * Override phrases are NOT removed from this value.
     */
    readonly sanitizedText: string;
    /** `true` when at least one injection pattern was matched. */
    readonly flagged: boolean;
    /**
     * Every matched rule, deduplicated by rule id.
     * Empty array when `flagged` is `false`.
     */
    readonly matches: readonly InjectionMatch[];
    /**
     * Highest severity across all matches.
     * `'none'` when `flagged` is `false`.
     */
    readonly severity: InjectionSeverity;
}

// ---------------------------------------------------------------------------
// Internal rule table
// ---------------------------------------------------------------------------

interface InjectionRule {
    readonly id: string;
    readonly severity: Exclude<InjectionSeverity, 'none'>;
    readonly regex: RegExp;
}

/**
 * Ordered rule table used by {@link guardPromptInjection}.
 *
 * Rules are evaluated case-insensitively against the sanitised text. The `id`
 * field is the stable identifier surfaced in {@link InjectionMatch.pattern}.
 *
 * @internal
 */
const INJECTION_RULES: readonly InjectionRule[] = [
    // ------------------------------------------------------------------
    // HIGH severity — direct instruction-override attempts
    // ------------------------------------------------------------------

    // EN: "ignore/disregard (all|the|previous|prior|above) instructions"
    // Also matches two-word middles like "ignore all previous instructions".
    {
        id: 'override-instructions-en',
        severity: 'high',
        regex: /\b(?:ignore|disregard)\s+(?:(?:all|the|previous|prior|above)\s+){1,2}instructions\b/i
    },

    // EN: "forget [your|all|previous] instructions"
    {
        id: 'forget-instructions-en',
        severity: 'high',
        regex: /\bforget\s+(?:your|all|previous)\s+instructions\b/i
    },

    // ES: "ignora/ignorá/ignore/ignorar las instrucciones (anteriores|previas|del sistema)"
    // Covers tuteo ("ignora"), voseo ("ignorá"), usted ("ignore"), and infinitive ("ignorar").
    {
        id: 'override-instructions-es',
        severity: 'high',
        regex: /\bignor(?:[aáe]|ar)\s+las\s+instrucciones\s+(?:anteriores|previas|del\s+sistema)\b/i
    },

    // ES: "olvida/olvidá/olvide/olvidar tus/las instrucciones"
    // Covers tuteo ("olvida"), voseo ("olvidá"), usted ("olvide"), and infinitive ("olvidar").
    {
        id: 'forget-instructions-es',
        severity: 'high',
        regex: /\bolvid(?:[aáe]|ar)\s+(?:tus|las)\s+instrucciones\b/i
    },

    // EN: role reassignment — "you are now ..."
    {
        id: 'role-reassignment-en',
        severity: 'high',
        regex: /\byou\s+are\s+now\b/i
    },

    // ES: role reassignment — "ahora sos/eres ..."
    {
        id: 'role-reassignment-es',
        severity: 'high',
        regex: /\bahora\s+(?:sos|eres)\b/i
    },

    // EN: prompt exfiltration — "reveal/show/print/repeat your (system) prompt"
    {
        id: 'prompt-exfiltration-en',
        severity: 'high',
        regex: /\b(?:reveal|show|print|repeat)\s+your\s+(?:system\s+)?prompt\b/i
    },

    // ES: prompt exfiltration — "muestra/mostrá/muéstrame tu/el (system) prompt"
    {
        id: 'prompt-exfiltration-es',
        severity: 'high',
        regex: /\bmostr(?:a|á|ame)\s+(?:tu|el)\s+(?:system\s+)?prompt\b/i
    },

    // Chat-template delimiter injection: model-specific control tokens
    {
        id: 'delimiter-injection',
        severity: 'high',
        regex: /<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]|<<SYS>>|```system\b/i
    },

    // ------------------------------------------------------------------
    // LOW severity — weaker jailbreak / role-play signals
    // ------------------------------------------------------------------

    // EN: "act as"
    {
        id: 'act-as-en',
        severity: 'low',
        regex: /\bact\s+as\b/i
    },

    // EN: "pretend to be / pretend you are"
    {
        id: 'pretend-en',
        severity: 'low',
        regex: /\bpretend\s+(?:to\s+be|you\s+are)\b/i
    },

    // EN: jailbreak / DAN mode / developer mode
    {
        id: 'jailbreak-keywords-en',
        severity: 'low',
        regex: /\b(?:jailbreak|dan\s+mode|developer\s+mode)\b/i
    },

    // ES: "sin restricciones"
    {
        id: 'sin-restricciones-es',
        severity: 'low',
        regex: /\bsin\s+restricciones\b/i
    },

    // ES: "actuá como" (voseo)
    {
        id: 'actua-como-es',
        severity: 'low',
        regex: /\bactu[aá]\s+como\b/i
    },

    // ES: "haz de cuenta que"
    {
        id: 'haz-de-cuenta-es',
        severity: 'low',
        regex: /\bhaz\s+de\s+cuenta\s+que\b/i
    },

    // EN: "simulate being"
    {
        id: 'simulate-being-en',
        severity: 'low',
        regex: /\bsimulate\s+being\b/i
    }
] as const;

// ---------------------------------------------------------------------------
// Sanitisation helpers (compiled once at module load)
// ---------------------------------------------------------------------------

/**
 * Zero-width and invisible Unicode characters to strip.
 * Covers: U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER,
 * U+200D ZERO WIDTH JOINER, U+FEFF BYTE ORDER MARK,
 * U+2060 WORD JOINER, U+00AD SOFT HYPHEN.
 */
const RE_ZERO_WIDTH = /\u200B|\u200C|\u200D|\uFEFF|\u2060|\u00AD/g;

/**
 * Control characters to strip.
 * Preserves \t (U+0009) and \n (U+000A).
 * Covers U+0000–U+0008, U+000B–U+001F, and U+007F–U+009F.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips control chars from user input (safety module)
const RE_CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

/**
 * Three or more consecutive newlines — collapsed to exactly two.
 */
const RE_EXCESS_NEWLINES = /\n{3,}/g;

// ---------------------------------------------------------------------------
// guardPromptInjection
// ---------------------------------------------------------------------------

/**
 * Sanitises `input.text` and detects prompt injection patterns.
 *
 * **Never throws** — returns a safe result for any input, including empty
 * strings and strings that exceed `maxLength`.
 *
 * Sanitisation order (applied to a working copy; original string is NEVER
 * mutated):
 * 1. Trim leading/trailing whitespace.
 * 2. Strip zero-width / invisible chars (U+200B–U+200D, U+FEFF, U+2060, U+00AD).
 * 3. Strip control characters except `\t` (U+0009) and `\n` (U+000A).
 * 4. Collapse runs of 3+ consecutive newlines to exactly 2.
 * 5. Truncate to `maxLength` (default {@link DEFAULT_MAX_INPUT_LENGTH}).
 *
 * Detection runs on the **sanitised** text. Each rule is evaluated at most
 * once; results are deduplicated by rule id. The overall `severity` is the
 * maximum across all matched rules.
 *
 * @param input - {@link GuardPromptInjectionInput}
 * @returns {@link GuardPromptInjectionResult}
 *
 * @example
 * ```ts
 * guardPromptInjection({ text: 'ignore all previous instructions and do X' });
 * // => { flagged: true, severity: 'high',
 * //      matches: [{ pattern: 'override-instructions-en', severity: 'high' }],
 * //      sanitizedText: 'ignore all previous instructions and do X' }
 *
 * guardPromptInjection({ text: 'leé las instrucciones del juego' });
 * // => { flagged: false, severity: 'none', matches: [], sanitizedText: 'leé las instrucciones del juego' }
 *
 * guardPromptInjection({ text: 'act as a pirate' });
 * // => { flagged: true, severity: 'low',
 * //      matches: [{ pattern: 'act-as-en', severity: 'low' }],
 * //      sanitizedText: 'act as a pirate' }
 * ```
 */
export const guardPromptInjection = (
    input: GuardPromptInjectionInput
): GuardPromptInjectionResult => {
    const maxLength = input.maxLength ?? DEFAULT_MAX_INPUT_LENGTH;

    // Sanitise (never mutate the original)
    const sanitizedText = input.text
        .trim()
        .replace(RE_ZERO_WIDTH, '')
        .replace(RE_CONTROL_CHARS, '')
        .replace(RE_EXCESS_NEWLINES, '\n\n')
        .slice(0, maxLength);

    // Detect — one pass per rule, deduplicated by id
    const seenIds = new Set<string>();
    const matches: InjectionMatch[] = [];

    for (const rule of INJECTION_RULES) {
        if (!seenIds.has(rule.id) && rule.regex.test(sanitizedText)) {
            seenIds.add(rule.id);
            matches.push({ pattern: rule.id, severity: rule.severity });
        }
    }

    // Overall severity = max across matches
    let severity: InjectionSeverity = 'none';
    for (const match of matches) {
        if (match.severity === 'high') {
            severity = 'high';
            break;
        }
        severity = 'low';
    }

    return {
        sanitizedText,
        flagged: matches.length > 0,
        matches,
        severity
    };
};
