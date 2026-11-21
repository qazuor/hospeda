/**
 * @file parse-article.ts
 * @description Parses one article file (HOS-2410 `docs/data-model.md` §2–§3):
 * YAML frontmatter between `---` lines, validated by
 * {@link HelpArticleFrontmatterSchema}, then a body of exactly the five
 * authored `##` sections in their fixed order.
 *
 * Generator only: it imports `yaml` and `marked`, which the runtime never does
 * (AC-12).
 */

import { Lexer, type Token } from 'marked';
import { parse as parseYaml } from 'yaml';
import { type HelpArticleFrontmatter, HelpArticleFrontmatterSchema } from '../article.schema';
import {
    HELP_MAX_STEPS,
    HELP_RELATED_HEADINGS,
    HELP_SECTION_ANCHORS,
    HELP_SECTION_HEADINGS,
    HELP_SECTION_KEYS,
    type HelpLocale,
    type HelpSectionKey
} from '../constants';

/**
 * The Markdown constructs an article may use, block or inline: paragraphs,
 * `###`, lists, bold, italic and inline code (`docs/data-model.md` §3). Links,
 * images, raw HTML, tables, code blocks, quotes and rules are rejected: every
 * link is a token, so it goes through the route map.
 */
const ALLOWED_CONSTRUCTS: ReadonlySet<string> = new Set([
    'space',
    'heading',
    'paragraph',
    'list',
    'list_item',
    'text',
    'strong',
    'em',
    'codespan',
    'escape',
    'br'
]);

/** An explicit `### Heading {#id}` anchor. */
const EXPLICIT_ANCHOR = /\s*\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}\s*$/;

/** The body of one article, split into its sections. */
export interface ParsedHelpBody {
    /** Raw Markdown of each section, trimmed. `howTo` is split into steps and the rest. */
    readonly sections: {
        readonly canDo: string;
        readonly howTo: { readonly steps: readonly string[]; readonly after: string };
        readonly expect: string;
        readonly notExpect: string;
        readonly troubleshooting: string;
    };
    /** Every anchor id of the article: the five section anchors plus each `###` anchor. */
    readonly anchors: readonly string[];
}

/** Result of parsing one article file. */
export type ParseHelpArticleResult =
    | {
          readonly ok: true;
          readonly frontmatter: HelpArticleFrontmatter;
          readonly body: ParsedHelpBody;
      }
    | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Slugifies a `###` heading into its anchor id: lowercase, accents stripped,
 * every run of non-alphanumerics a single `-`, no edge hyphens.
 *
 * @param args.text - The heading text
 * @returns The anchor id
 *
 * @example
 * ```ts
 * slugifyHelpHeading({ text: 'Mis fotos no se ven' }); // 'mis-fotos-no-se-ven'
 * ```
 */
export function slugifyHelpHeading({ text }: { readonly text: string }): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** The child tokens of a token, when it has any. */
function childrenOf(token: Token): readonly Token[] {
    const children: Token[] = [];
    if ('tokens' in token && Array.isArray(token.tokens)) {
        children.push(...token.tokens);
    }
    if (token.type === 'list') {
        children.push(...token.items);
    }
    return children;
}

/** The Markdown constructs in a block, at any depth, that an article may not use. */
function forbiddenConstructs({ token }: { readonly token: Token }): readonly string[] {
    if (!ALLOWED_CONSTRUCTS.has(token.type)) {
        return [token.type];
    }
    return childrenOf(token).flatMap((child) => forbiddenConstructs({ token: child }));
}

/** Splits a file into its frontmatter text and body, or explains why it cannot. */
function splitFrontmatter({
    source
}: {
    readonly source: string;
}): { readonly yaml: string; readonly body: string } | string {
    if (!source.startsWith('---\n')) {
        return 'the file must start with a "---" frontmatter line';
    }
    const end = source.indexOf('\n---\n', 3);
    if (end === -1) {
        return 'the frontmatter has no closing "---" line';
    }
    return { yaml: source.slice(4, end + 1), body: source.slice(end + 5) };
}

/** Mutable state of the body walk. */
interface BodyState {
    sectionIndex: number;
    listSeen: boolean;
    readonly parts: Record<HelpSectionKey, string[]>;
    readonly after: string[];
    readonly steps: string[];
    readonly anchors: string[];
    readonly errors: string[];
}

/** Handles one `###` heading. */
function onSubHeading({ state, text }: { readonly state: BodyState; readonly text: string }) {
    const explicit = EXPLICIT_ANCHOR.exec(text);
    const anchor = explicit?.[1] ?? slugifyHelpHeading({ text });
    if (anchor === '') {
        state.errors.push(`"### ${text}" has no usable anchor id`);
    } else if (state.anchors.includes(anchor)) {
        state.errors.push(`duplicate anchor id "${anchor}" ("### ${text}")`);
    } else {
        state.anchors.push(anchor);
    }
}

/** Handles one block inside the «Cómo se hace» section. */
function onHowToBlock({ state, token }: { readonly state: BodyState; readonly token: Token }) {
    if (token.type === 'list' && token.ordered) {
        if (state.listSeen) {
            state.errors.push('«Cómo se hace» must hold exactly one ordered list');
            return;
        }
        state.listSeen = true;
        for (const item of token.items) {
            if (
                item.tokens.some((child: Token) => child.type !== 'text' && child.type !== 'space')
            ) {
                state.errors.push(
                    'a step of «Cómo se hace» must be plain text, with no nested block'
                );
            }
            state.steps.push(item.text.trim());
        }
        return;
    }
    if (!state.listSeen) {
        state.errors.push('«Cómo se hace» must start with its ordered list of steps');
        return;
    }
    state.after.push(token.raw);
}

/**
 * Parses and checks an article body.
 *
 * @param args.body - The Markdown after the frontmatter
 * @param args.locale - The file's locale, which fixes the heading texts
 * @returns The sections and anchors, or the errors
 */
export function parseHelpBody({
    body,
    locale
}: {
    readonly body: string;
    readonly locale: HelpLocale;
}): { readonly body: ParsedHelpBody } | { readonly errors: readonly string[] } {
    const headings = HELP_SECTION_HEADINGS[locale];
    if (headings === undefined) {
        return { errors: [`no section headings are defined for locale "${locale}"`] };
    }
    const state: BodyState = {
        sectionIndex: -1,
        listSeen: false,
        parts: { canDo: [], howTo: [], expect: [], notExpect: [], troubleshooting: [] },
        after: [],
        steps: [],
        anchors: HELP_SECTION_KEYS.map((key) => HELP_SECTION_ANCHORS[key]),
        errors: []
    };

    for (const token of Lexer.lex(body, { gfm: true })) {
        const key = HELP_SECTION_KEYS[state.sectionIndex];
        if (token.type === 'heading' && token.depth <= 2) {
            const text = token.text.trim();
            const expected = HELP_SECTION_KEYS[state.sectionIndex + 1];
            if (token.depth === 1) {
                state.errors.push(`"# ${text}": an article has no "#" heading`);
            } else if (text === HELP_RELATED_HEADINGS[locale]) {
                state.errors.push(
                    `"## ${text}" is generated from "related" and must not be written`
                );
            } else if (expected === undefined || text !== headings[expected]) {
                state.errors.push(
                    `"## ${text}" found where ${expected === undefined ? 'no more sections were expected' : `"## ${headings[expected]}" was expected`}`
                );
            } else {
                state.sectionIndex += 1;
            }
            continue;
        }
        if (key === undefined) {
            if (token.type !== 'space') {
                state.errors.push('text before the first "##" section');
            }
            continue;
        }
        if (token.type === 'space') {
            if (key === 'howTo') {
                state.after.push(token.raw);
            } else {
                state.parts[key].push(token.raw);
            }
            continue;
        }
        const forbidden = forbiddenConstructs({ token });
        if (forbidden.length > 0) {
            state.errors.push(`forbidden Markdown in «${headings[key]}»: ${forbidden.join(', ')}`);
            continue;
        }
        if (token.type === 'heading') {
            if (token.depth !== 3) {
                state.errors.push(
                    `"${'#'.repeat(token.depth)} ${token.text}": only "###" sub-headings are allowed`
                );
                continue;
            }
            onSubHeading({ state, text: token.text.trim() });
        }
        if (key === 'howTo') {
            onHowToBlock({ state, token });
        } else {
            state.parts[key].push(token.raw);
        }
    }

    if (state.sectionIndex < HELP_SECTION_KEYS.length - 1) {
        const missing = HELP_SECTION_KEYS.slice(state.sectionIndex + 1).map((key) => headings[key]);
        state.errors.push(
            `missing sections: ${missing.map((heading) => `"## ${heading}"`).join(', ')}`
        );
    }
    if (state.steps.length === 0 || state.steps.length > HELP_MAX_STEPS) {
        state.errors.push(
            `«Cómo se hace» must have between 1 and ${HELP_MAX_STEPS} steps (has ${state.steps.length})`
        );
    }
    const text = (key: Exclude<HelpSectionKey, 'howTo'>) => state.parts[key].join('').trim();
    for (const key of ['canDo', 'expect', 'notExpect', 'troubleshooting'] as const) {
        if (state.sectionIndex >= HELP_SECTION_KEYS.indexOf(key) && text(key) === '') {
            state.errors.push(`«${headings[key]}» is empty`);
        }
    }
    if (state.errors.length > 0) {
        return { errors: state.errors };
    }
    return {
        body: {
            sections: {
                canDo: text('canDo'),
                howTo: { steps: state.steps, after: state.after.join('').trim() },
                expect: text('expect'),
                notExpect: text('notExpect'),
                troubleshooting: text('troubleshooting')
            },
            anchors: state.anchors
        }
    };
}

/**
 * Parses one article file: frontmatter, schema and body.
 *
 * @param args.source - The file content (LF or CRLF)
 * @param args.locale - The file's locale
 * @returns The validated frontmatter and parsed body, or every error found
 */
export function parseHelpArticle({
    source,
    locale
}: {
    readonly source: string;
    readonly locale: HelpLocale;
}): ParseHelpArticleResult {
    const split = splitFrontmatter({ source: source.replace(/\r\n/g, '\n') });
    if (typeof split === 'string') {
        return { ok: false, errors: [split] };
    }
    let raw: unknown;
    try {
        raw = parseYaml(split.yaml);
    } catch (error) {
        return {
            ok: false,
            errors: [
                `the frontmatter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`
            ]
        };
    }
    const errors: string[] = [];
    const parsed = HelpArticleFrontmatterSchema.safeParse(raw);
    if (!parsed.success) {
        for (const issue of parsed.error.issues) {
            errors.push(`frontmatter ${issue.path.join('.') || '(root)'}: ${issue.message}`);
        }
    }
    const body = parseHelpBody({ body: split.body, locale });
    if ('errors' in body) {
        errors.push(...body.errors);
    }
    if (!parsed.success || 'errors' in body) {
        return { ok: false, errors };
    }
    return { ok: true, frontmatter: parsed.data, body: body.body };
}
