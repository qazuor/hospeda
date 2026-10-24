/**
 * @module test/helpers/css-contract
 * @description Minimal CSS rule parser for "CSS contract" tests: asserts which
 * declarations apply to a selector (optionally under a media query) instead of
 * regexing source text. Handles nested at-rules, `:global()` unwrapping and
 * comment stripping. It is deliberately not a full CSS parser.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '../../src');

/** One parsed style rule. */
export interface ParsedRule {
    /** Selector with `:global(...)` unwrapped and whitespace collapsed. */
    readonly selector: string;
    /** Enclosing at-rule preludes (e.g. `@media (max-width: 767px)`), outermost first. */
    readonly media: readonly string[];
    readonly decls: Readonly<Record<string, string>>;
    /** Source order, to assert "declared after". */
    readonly order: number;
}

/** Reads a file relative to `apps/web/src`. */
export function readSrc({ path }: { readonly path: string }): string {
    return readFileSync(resolve(SRC, path), 'utf8');
}

/** Extracts the first `<style>` block of an .astro file, or returns plain CSS as is. */
export function styleOf({ source }: { readonly source: string }): string {
    return source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? source;
}

/** Flat parse of CSS rules, keeping each rule's enclosing at-rules. */
export function parseRules({ css }: { readonly css: string }): ParsedRule[] {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules: ParsedRule[] = [];
    let order = 0;
    const walk = (text: string, media: readonly string[]): void => {
        let i = 0;
        while (i < text.length) {
            const open = text.indexOf('{', i);
            if (open === -1) return;
            const head = text.slice(i, open).trim();
            let depth = 1;
            let j = open + 1;
            while (j < text.length && depth > 0) {
                if (text[j] === '{') depth++;
                else if (text[j] === '}') depth--;
                j++;
            }
            const body = text.slice(open + 1, j - 1);
            if (head.startsWith('@media') || head.startsWith('@supports')) {
                walk(body, [...media, head.replace(/\s+/g, ' ')]);
            } else if (!head.startsWith('@')) {
                const decls: Record<string, string> = {};
                for (const part of body.split(';')) {
                    const idx = part.indexOf(':');
                    if (idx > 0) decls[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
                }
                for (const sel of head.split(',')) {
                    const selector = sel
                        .replace(/:global\(((?:[^()]|\([^)]*\))*)\)/g, '$1')
                        .replace(/\s+/g, ' ')
                        .trim();
                    rules.push({ selector, media, decls, order: order++ });
                }
            }
            i = j;
        }
    };
    walk(clean, []);
    return rules;
}

/** Parses the `<style>` block (or plain CSS) of a file relative to `apps/web/src`. */
export function parseFile({ path }: { readonly path: string }): ParsedRule[] {
    return parseRules({ css: styleOf({ source: readSrc({ path }) }) });
}

/**
 * Last declared value of `prop` for `selector` among rules that apply with NO
 * media query, in source order (later wins on equal specificity).
 */
export function baseValue({
    rules,
    selector,
    prop
}: {
    readonly rules: readonly ParsedRule[];
    readonly selector: string;
    readonly prop: string;
}): string | undefined {
    return rules
        .filter((r) => r.selector === selector && r.media.length === 0 && prop in r.decls)
        .sort((a, b) => a.order - b.order)
        .at(-1)?.decls[prop];
}
