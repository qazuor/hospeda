/**
 * @file extract-web-tokens.ts
 * @description SPEC-153 Phase 0 — parses apps/web/src/styles/global.css and
 * emits a canonical token manifest to packages/design-tokens/seed/web-baseline.json.
 *
 * The manifest is the source of truth that:
 *  - seeds packages/design-tokens during Phase 1 (T-153-05+) byte-for-byte,
 *  - drives the round-trip validator (T-153-17), and
 *  - documents what stays in web vs. what migrates to the shared package.
 *
 * Parsing strategy: a small line-by-line state machine. Sufficient because
 * global.css is hand-authored, has one declaration per line, and uses
 * predictable section delimiters (`/* --- Section name --- *\/`). A full
 * postcss parser would be overkill — the file is 406 lines and the cost
 * of a new dependency outweighs the parsing convenience.
 *
 * Tokens are bucketed into three blocks:
 *   - `light`   — declarations inside `:root { ... }`
 *   - `dark`    — declarations inside `[data-theme="dark"] { ... }`
 *   - `media`   — declarations inside `@media (...) { :root { ... } }`
 *
 * Out-of-scope sources (documented in the manifest but NOT extracted):
 *   - apps/web/src/styles/css-var-themes.css  (content-type themes)
 *   - apps/web/src/lib/colors.ts              (runtime color mappers)
 *
 * Usage: pnpm exec tsx scripts/extract-web-tokens.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root is one level above this script.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL_CSS = resolve(REPO_ROOT, 'apps/web/src/styles/global.css');
const OUTPUT = resolve(REPO_ROOT, 'packages/design-tokens/seed/web-baseline.json');

type TokenEntry = {
    readonly name: string;
    readonly value: string;
    readonly category: string;
    readonly line: number;
};

type ParseResult = {
    light: Record<string, TokenEntry>;
    dark: Record<string, TokenEntry>;
    media: Record<string, { condition: string; tokens: Record<string, TokenEntry> }>;
};

const SECTION_HEADER = /^\s*\/\*\s*---+\s*(.+?)\s*---+\s*(\*\/)?/;
const ROOT_BLOCK_OPEN = /^\s*:root\s*\{\s*$/;
const DARK_BLOCK_OPEN = /^\s*\[data-theme="dark"\]\s*\{\s*$/;
const MEDIA_BLOCK_OPEN = /^\s*@media\s+([^{]+?)\s*\{\s*$/;
const BLOCK_CLOSE = /^\s*\}\s*$/;
const TOKEN_DECL = /^\s*(--[a-z][a-z0-9-]*)\s*:\s*([^;]+);/;

function slugifyCategory(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parse(content: string): ParseResult {
    const result: ParseResult = { light: {}, dark: {}, media: {} };

    type Frame = 'none' | 'root' | 'dark' | 'media-root';
    let frame: Frame = 'none';
    let mediaCondition: string | null = null;
    let nestingInsideMedia = 0;
    let currentCategory = 'uncategorized';

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const lineNum = i + 1;

        // Section header: only meaningful inside :root or [data-theme=dark]
        // (we use them to bucket tokens by intent). Outside any block they
        // would still set state, which is fine — it just gets overwritten
        // on next block entry.
        const sectionMatch = line.match(SECTION_HEADER);
        if (sectionMatch?.[1]) {
            currentCategory = slugifyCategory(sectionMatch[1]);
            continue;
        }

        // Block transitions.
        if (frame === 'none') {
            if (ROOT_BLOCK_OPEN.test(line)) {
                frame = 'root';
                currentCategory = 'uncategorized';
                continue;
            }
            if (DARK_BLOCK_OPEN.test(line)) {
                frame = 'dark';
                currentCategory = 'uncategorized';
                continue;
            }
            const mediaMatch = line.match(MEDIA_BLOCK_OPEN);
            if (mediaMatch?.[1]) {
                mediaCondition = mediaMatch[1].trim();
                frame = 'media-root';
                nestingInsideMedia = 0;
                continue;
            }
            continue;
        }

        if (frame === 'media-root') {
            // Inside @media we expect a nested :root { ... }. Track nesting.
            if (ROOT_BLOCK_OPEN.test(line)) {
                nestingInsideMedia++;
                continue;
            }
            if (BLOCK_CLOSE.test(line)) {
                if (nestingInsideMedia > 0) {
                    nestingInsideMedia--;
                } else {
                    // closing @media itself
                    if (mediaCondition && !result.media[mediaCondition]) {
                        result.media[mediaCondition] = {
                            condition: mediaCondition,
                            tokens: {}
                        };
                    }
                    frame = 'none';
                    mediaCondition = null;
                }
                continue;
            }

            const tokenMatch = line.match(TOKEN_DECL);
            if (tokenMatch?.[1] && tokenMatch[2] && mediaCondition && nestingInsideMedia > 0) {
                const name = tokenMatch[1].slice(2);
                const value = tokenMatch[2].trim();
                if (!result.media[mediaCondition]) {
                    result.media[mediaCondition] = { condition: mediaCondition, tokens: {} };
                }
                result.media[mediaCondition].tokens[name] = {
                    name,
                    value,
                    category: currentCategory,
                    line: lineNum
                };
            }
            continue;
        }

        // Inside :root or [data-theme="dark"]
        if (BLOCK_CLOSE.test(line)) {
            frame = 'none';
            continue;
        }

        const tokenMatch = line.match(TOKEN_DECL);
        if (tokenMatch?.[1] && tokenMatch[2]) {
            const name = tokenMatch[1].slice(2);
            const value = tokenMatch[2].trim();
            const entry: TokenEntry = {
                name,
                value,
                category: currentCategory,
                line: lineNum
            };
            if (frame === 'root') {
                result.light[name] = entry;
            } else if (frame === 'dark') {
                result.dark[name] = entry;
            }
        }
    }

    return result;
}

function categoryIndex(tokens: Record<string, TokenEntry>): Record<string, string[]> {
    const index: Record<string, string[]> = {};
    for (const [name, entry] of Object.entries(tokens)) {
        if (!index[entry.category]) {
            index[entry.category] = [];
        }
        index[entry.category]?.push(name);
    }
    for (const cat of Object.keys(index)) {
        index[cat]?.sort();
    }
    return index;
}

function main(): void {
    const content = readFileSync(GLOBAL_CSS, 'utf-8');
    const parsed = parse(content);

    // Inherit category from the light counterpart for dark tokens. The dark
    // block uses inline comments without `---` delimiters that the parser
    // cannot match, so every dark entry would otherwise be 'uncategorized'.
    // Since dark MUST mirror light's set (sanity-checked below), category
    // inheritance is well-defined.
    for (const [name, entry] of Object.entries(parsed.dark)) {
        const lightCounterpart = parsed.light[name];
        if (lightCounterpart && entry.category === 'uncategorized') {
            parsed.dark[name] = {
                ...entry,
                category: lightCounterpart.category
            };
        }
    }

    // Drop empty media blocks. The CSS file contains
    // @media (prefers-reduced-motion: reduce) which is animation-override
    // only — no tokens declared there.
    for (const condition of Object.keys(parsed.media)) {
        const block = parsed.media[condition];
        if (block && Object.keys(block.tokens).length === 0) {
            delete parsed.media[condition];
        }
    }

    const lightCount = Object.keys(parsed.light).length;
    const darkCount = Object.keys(parsed.dark).length;
    const mediaCount = Object.values(parsed.media).reduce(
        (sum, block) => sum + Object.keys(block.tokens).length,
        0
    );

    // Sanity: every dark token MUST also exist in light (otherwise web is
    // declaring a dark-only variable, which would be a bug — dark overrides
    // a light default, never introduces new tokens).
    const darkWithoutLight = Object.keys(parsed.dark).filter((name) => !parsed.light[name]);

    const manifest = {
        $schema: 'spec/SPEC-153/web-baseline.schema.json',
        metadata: {
            source: 'apps/web/src/styles/global.css',
            extractor: 'scripts/extract-web-tokens.ts',
            extractedAt: new Date().toISOString(),
            specRef: 'SPEC-153',
            counts: {
                light: lightCount,
                dark: darkCount,
                media: mediaCount,
                total: lightCount + darkCount + mediaCount
            },
            integrityChecks: {
                darkTokensWithoutLightDefault: darkWithoutLight
            }
        },
        outOfScope: {
            'apps/web/src/styles/css-var-themes.css':
                'Content-type theming (event-categories, post-categories, accommodation-types via [data-event-category] / [data-post-category] attributes). Stays in apps/web — these are marketing-specific colorings, not foundational tokens. Doc 05 §3 Eje 8.',
            'apps/web/src/lib/colors.ts':
                'TypeScript color mapper functions (getAccommodationTypeColor, getEventCategoryColor, etc.) that compose tokens at runtime via oklch(from var(--token) ...) syntax. Stays in apps/web. The TOKEN_TO_CSS_VAR map inside this file references the tokens defined in global.css — it is a consumer, not a definer.',
            'apps/web/src/styles/components.css':
                'Component-level BEM classes (.section, .card, .btn-gradient, etc.). Pure consumers of the tokens in global.css. Stays in apps/web.',
            'apps/web/src/styles/feedback-overrides.css':
                'Feedback FAB visual overrides. Pure consumer. Stays in apps/web.'
        },
        tokens: {
            light: parsed.light,
            dark: parsed.dark,
            media: parsed.media
        },
        categories: {
            light: categoryIndex(parsed.light),
            dark: categoryIndex(parsed.dark)
        }
    };

    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

    // eslint-disable-next-line no-console
    console.log(
        `[extract-web-tokens] wrote ${OUTPUT}\n` +
            `  light: ${lightCount}, dark: ${darkCount}, media: ${mediaCount} ` +
            `(total ${lightCount + darkCount + mediaCount})`
    );

    if (darkWithoutLight.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
            `[extract-web-tokens] WARNING: ${darkWithoutLight.length} dark token(s) ` +
                `with no light default: ${darkWithoutLight.join(', ')}`
        );
    }
}

main();
