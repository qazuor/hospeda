/**
 * @file extract-inline-scripts.ts
 * @description Pure extraction of the inline `<script>` blocks a compiled Astro
 * component can emit, from the template literals of its compiled module
 * (HOS-807).
 *
 * The Astro compiler turns a component's markup into tagged template literals
 * (`renderTemplate`\`…\``). Every `<script is:inline>` the component contains is
 * therefore spelled out, byte for byte, in the COOKED value of those literals —
 * the exact text Astro later writes into the response. A script whose body the
 * compiler had to split around a `${…}` expression (`set:html`, `define:vars`)
 * has content that is only known at render time, so it cannot be pre-hashed.
 *
 * This module only reads strings. Walking the AST lives in
 * `collect-template-quasis.ts`; hashing and wiring live in the integration.
 */

/**
 * Sentinel standing in for each `${…}` expression when the cooked parts of one
 * template literal are joined back together. It contains neither `<` nor `>`,
 * so it can never be mistaken for markup by the tag scan below.
 */
export const EXPRESSION_SENTINEL = '\u0000HOSPEDA_EXPR\u0000';

/**
 * `type` values browsers execute as script. Anything else (`application/ld+json`,
 * `application/json`, `text/template`…) is a data block: it never runs, so it is
 * never subject to `script-src` and needs no hash.
 */
const EXECUTABLE_SCRIPT_TYPES: ReadonlySet<string> = new Set([
    '',
    'module',
    'text/javascript',
    'application/javascript',
    'application/ecmascript',
    'text/ecmascript'
]);

const SCRIPT_BLOCK_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SRC_ATTRIBUTE_PATTERN = /(?:^|\s)src\s*=/i;
const TYPE_ATTRIBUTE_PATTERN = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** An executable inline script whose body depends on render-time data. */
export interface DynamicInlineScript {
    /** The attributes of the opening tag, with expressions shown as `«expr»`. */
    readonly openingTagAttributes: string;
    /** The first 120 characters of the body, with expressions shown as `«expr»`. */
    readonly bodyPreview: string;
}

interface ExtractInlineScriptsArgs {
    /**
     * One entry per template literal: its COOKED quasis in source order. A
     * literal with N expressions has N + 1 quasis.
     */
    readonly templates: readonly (readonly string[])[];
}

interface ExtractInlineScriptsResult {
    /** Byte-exact bodies of executable inline scripts with no expression inside. */
    readonly staticBodies: readonly string[];
    /** Executable inline scripts whose body contains a render-time expression. */
    readonly dynamicScripts: readonly DynamicInlineScript[];
}

/**
 * Finds every executable inline `<script>` spelled out in a set of template
 * literals and splits them into pre-hashable (static) and render-time
 * (dynamic) ones.
 *
 * Skipped, because `script-src` hashes do not apply to them:
 * - `<script src="…">` (external, covered by `'self'`);
 * - non-executable `type`s such as `application/ld+json`;
 * - empty bodies (the CSP collector skips them too).
 *
 * A `type` whose value is itself an expression is treated as executable: the
 * conservative reading, since it may well resolve to `module`.
 *
 * @param args - templates: cooked quasis per template literal.
 * @returns The static bodies (in first-seen order, deduplicated) and the
 *   dynamic scripts.
 */
export function extractInlineScripts({
    templates
}: ExtractInlineScriptsArgs): ExtractInlineScriptsResult {
    const staticBodies = new Set<string>();
    const dynamicScripts: DynamicInlineScript[] = [];

    for (const quasis of templates) {
        const joined = quasis.join(EXPRESSION_SENTINEL);
        if (!joined.includes('<script')) {
            continue;
        }

        for (const match of joined.matchAll(SCRIPT_BLOCK_PATTERN)) {
            const attributes = match[1] ?? '';
            const body = match[2] ?? '';

            if (!isExecutableInline(attributes) || body.length === 0) {
                continue;
            }

            if (body.includes(EXPRESSION_SENTINEL)) {
                dynamicScripts.push({
                    openingTagAttributes: showExpressions(attributes).trim(),
                    bodyPreview: showExpressions(body).trim().slice(0, 120)
                });
                continue;
            }

            staticBodies.add(body);
        }
    }

    return { staticBodies: [...staticBodies], dynamicScripts };
}

function isExecutableInline(attributes: string): boolean {
    if (SRC_ATTRIBUTE_PATTERN.test(attributes)) {
        return false;
    }
    const typeMatch = TYPE_ATTRIBUTE_PATTERN.exec(attributes);
    if (!typeMatch) {
        return true;
    }
    const typeValue = (typeMatch[1] ?? typeMatch[2] ?? typeMatch[3] ?? '').trim().toLowerCase();
    if (typeValue.includes(EXPRESSION_SENTINEL.toLowerCase())) {
        return true;
    }
    return EXECUTABLE_SCRIPT_TYPES.has(typeValue);
}

function showExpressions(text: string): string {
    return text.split(EXPRESSION_SENTINEL).join('«expr»');
}
