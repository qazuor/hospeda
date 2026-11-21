/**
 * @file tokens.ts
 * @description The token grammar of article bodies (HOS-2410
 * `docs/data-model.md` §5.1):
 *
 * ```text
 * token  = "{{" kind ":" args [ "|" label ] "}}"
 * kind   = "limit" | "link" | "article"
 * args   = arg *( ":" arg )
 * label  = 1*80 chars, no "{", "}", "|"
 * ```
 *
 * `arg` accepts upper-case letters too (`[A-Za-z0-9_.-]+`): the link target
 * table of §5.1 names camelCase targets (`providerDirectory`, `aiAssistants`),
 * which the lower-case-only `arg` of the written grammar would reject.
 *
 * Tokens stay unresolved in the index; each consumer resolves them. This
 * module only splits text into tokens and reports the ones that do not parse.
 * Whether a token's key, target or article exists is checked by the generator.
 */

/** Every token kind. */
export const HELP_TOKEN_KINDS = ['limit', 'link', 'article'] as const;

/** One token kind. */
export type HelpTokenKind = (typeof HELP_TOKEN_KINDS)[number];

/** Longest label a token may carry. */
export const HELP_TOKEN_LABEL_MAX = 80;

/** One argument of a token. */
const ARG = /^[A-Za-z0-9_.-]+$/;

/** A parsed token. */
export interface HelpToken {
    /** The token kind. */
    readonly kind: HelpTokenKind;
    /** The `:`-separated arguments after the kind, at least one. */
    readonly args: readonly string[];
    /** The text after `|`, when given. */
    readonly label?: string;
    /** The token as written, braces included. */
    readonly raw: string;
}

/** What {@link parseHelpTokens} found. */
export interface ParseHelpTokensResult {
    /** The well-formed tokens, in text order. */
    readonly tokens: readonly HelpToken[];
    /** One message per malformed token or stray brace pair, naming it. */
    readonly errors: readonly string[];
}

/** Parses the inside of one `{{…}}`, or explains why it does not parse. */
function parseOne({ raw }: { readonly raw: string }): HelpToken | string {
    const inner = raw.slice(2, -2);
    const bar = inner.indexOf('|');
    const head = bar === -1 ? inner : inner.slice(0, bar);
    const label = bar === -1 ? undefined : inner.slice(bar + 1);
    const [kindText, ...args] = head.split(':');
    const kind = HELP_TOKEN_KINDS.find((candidate) => candidate === kindText);
    if (kind === undefined) {
        return `unknown token kind in ${raw} (expected ${HELP_TOKEN_KINDS.join(', ')})`;
    }
    if (args.length === 0 || !args.every((arg) => ARG.test(arg))) {
        return `malformed arguments in ${raw}`;
    }
    if (label !== undefined) {
        if (label.length === 0 || label.length > HELP_TOKEN_LABEL_MAX || /[{}|]/.test(label)) {
            return `malformed label in ${raw} (1-${HELP_TOKEN_LABEL_MAX} chars, no braces or bars)`;
        }
        return { kind, args, label, raw };
    }
    return { kind, args, raw };
}

/**
 * Splits a text into its tokens.
 *
 * @param args.text - Markdown that may contain tokens
 * @returns The tokens and the errors (a malformed token, or a `{{`/`}}` that
 *   does not belong to a token)
 *
 * @example
 * ```ts
 * parseHelpTokens({ text: 'Mirá {{link:plans:venue|los planes}}.' }).tokens;
 * // [{ kind: 'link', args: ['plans', 'venue'], label: 'los planes', raw: '{{link:plans:venue|los planes}}' }]
 * ```
 */
export function parseHelpTokens({ text }: { readonly text: string }): ParseHelpTokensResult {
    const tokens: HelpToken[] = [];
    const errors: string[] = [];
    const pattern = /\{\{[^{}]*\}\}/g;
    for (const match of text.matchAll(pattern)) {
        const parsed = parseOne({ raw: match[0] });
        if (typeof parsed === 'string') {
            errors.push(parsed);
        } else {
            tokens.push(parsed);
        }
    }
    const rest = text.replace(pattern, '');
    if (rest.includes('{{') || rest.includes('}}')) {
        errors.push('a "{{" or "}}" that does not form a token');
    }
    return { tokens, errors };
}

/**
 * Replaces every well-formed token of a text.
 *
 * @param args.text - Markdown that may contain tokens
 * @param args.replace - What each token becomes
 * @returns The text with its tokens replaced; malformed ones are left as written
 */
export function replaceHelpTokens({
    text,
    replace
}: {
    readonly text: string;
    readonly replace: (token: HelpToken) => string;
}): string {
    return text.replace(/\{\{[^{}]*\}\}/g, (raw) => {
        const parsed = parseOne({ raw });
        return typeof parsed === 'string' ? raw : replace(parsed);
    });
}
