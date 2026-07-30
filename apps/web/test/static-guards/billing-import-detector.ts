/**
 * @file billing-import-detector.ts
 * @description Detector primitives for the HOS-360 static guard
 * (`billing-barrel-client-isolation.test.ts`).
 *
 * Kept in a plain module rather than exported from the guard's own `.test.ts`:
 * importing a test file from another re-registers its suites AND re-runs its
 * module-scope corpus walk inside the importer. Nothing here runs at import
 * time.
 *
 * @module test/static-guards/billing-import-detector
 */

import fs from 'node:fs';
import path from 'node:path';

/** Absolute path of `apps/web/src`, the corpus root for every helper here. */
export const WEB_SRC = path.resolve(__dirname, '../../src');

/** The package whose barrel must never enter the client module graph. */
export const FORBIDDEN_PACKAGE = '@repo/billing';

/** Extensions tried, in order, when resolving an extensionless import. */
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'] as const;

/** Matches `@repo/billing` and any subpath entry (`@repo/billing/plans`). */
const FORBIDDEN_SPECIFIER = `${FORBIDDEN_PACKAGE}(?:/[^'"]*)?`;

/**
 * Source of the `import`/`export` … `from` prefix shared by every matcher here,
 * capturing the clause in group 1.
 *
 * The clause is bounded three ways, each one closing a way for an EARLIER
 * statement to bleed into it and get the clause misread:
 *
 * - `'` / `"` — a quote means the previous statement's specifier.
 * - `;` — a statement terminator.
 * - `=` — an assignment or a type alias. Without it,
 *   `export type Foo = { a: number }` followed by a real
 *   `import { EntitlementKey } from '@repo/billing';` matched from the `export`,
 *   producing a clause that STARTS with `type` — so a runtime import was
 *   classified type-only and the whole subgraph below it silently pruned.
 *   No legal ESM import/export clause contains `=`.
 * - a tempered lookahead forbidding a nested `import`/`export` keyword, which
 *   covers the semicolon-less shapes (`export type { A }` on its own line)
 *   that the `;` bound alone would miss.
 *
 * Newlines are deliberately still allowed: multi-line `import {\n A,\n B\n}
 * from '…'` clauses are everywhere in this corpus.
 */
const FROM_PREFIX = String.raw`\b(?:import|export)\b\s*((?:(?!\b(?:import|export)\b)[^'";=])*?)\bfrom\s*`;

/**
 * Source of a side-effect import (`import './x';`), anchored at the start of a
 * line.
 *
 * The anchor is load-bearing, not cosmetic. Unanchored, `\bimport\b\s*['"]` hit
 * the word `import` inside a string literal —
 * `webLogger.info('CreatePropertyMiniForm: prefilled from import', { … })` in
 * `components/host/CreatePropertyMiniForm.client.tsx` — where `import'` opened
 * the match and `[^'"]+` ran to the next quote, capturing a 687-character
 * "specifier" spanning 31 lines. `resolveLocal` returned `null` so the walk
 * survived, but the `g` flag had already advanced `lastIndex` past the whole
 * span: any genuine `import './side-effect';` inside it would never be emitted
 * as an edge. Measured 2026-07-29: exactly one such match in the corpus, and
 * zero after anchoring.
 */
const SIDE_EFFECT_PREFIX = String.raw`^[ \t]*import\s*`;

/** Recursively collects files under `dir` whose name matches `predicate`. */
export function collectFiles(dir: string, predicate: (name: string) => boolean): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath, predicate));
            continue;
        }
        if (predicate(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
}

/** Counts backticks not preceded by a backslash. */
function countUnescapedBackticks(line: string): number {
    let count = 0;

    for (let i = 0; i < line.length; i += 1) {
        if (line[i] === '\\') {
            i += 1;
            continue;
        }
        if (line[i] === '`') {
            count += 1;
        }
    }

    return count;
}

/**
 * Blanks comments that OWN a whole line, leaving every other character of the
 * source at its original offset-in-line.
 *
 * Stripping is needed because prose routinely puts the word `import` next to a
 * `@repo/billing` mention, and a regex anchored on `import … from
 * '@repo/billing'` happily spans the JSDoc block in between. Not hypothetical:
 * the first version of this guard reported `lib/billing/fetch-plans.ts` — whose
 * only import of the package is type-only — because its docblock says
 * "`PlanDefinition.limits` in @repo/billing is …".
 *
 * **Direction of failure**: removing too much here DELETES a real import and
 * turns the guard silently green, so this is line-oriented rather than a
 * character-level scanner. A character-level scanner has no notion of a regex
 * literal: `raw.replace(/^https?:\/\//i, '')` reads as a `//` line comment at
 * the `\/`, and a regex whose character class contains a slash-star pair opens
 * a block scan running to the next terminator or EOF — verified, one such
 * scanner turns `const weird = /[/*]/.test(value);\nimport { B } from './b';`
 * into `const weird = /[` and the import is gone.
 *
 * Measured on this corpus (2026-07-29, 432 `.ts`/`.tsx` files, against a
 * faithful reconstruction of that character-level design): it truncates 5 lines
 * of real code — 2 in `components/host/editor/SocialNetworksSection.client.tsx`
 * and 3 in `lib/middleware-helpers.ts`, all of them `/^https?:\/\//`-shaped
 * regexes — and leaves 3 files (`lib/render-plain.ts`, `lib/extract-toc.ts`,
 * `lib/sanitize-html.ts`) in a desynced quote state at EOF. It loses an import
 * statement in **0** of the 432, and `hasRuntimeBillingImport` differs on
 * **0**. So the realized damage today is source truncation, NOT a lost edge —
 * the line-oriented design is chosen because the failure mode is silent and one
 * unlucky regex away, not because a violation was ever actually hidden.
 *
 * Rules, and what each one costs:
 *
 * - A `//` or `/*` that is not the first non-blank thing on its line is left
 *   verbatim, so no regex literal, string or template can be truncated. The
 *   cost is that a TRAILING comment survives and can make
 *   {@link hasRuntimeBillingImport} report prose as a violation — the LOUD
 *   direction: a false positive fails the build, a false negative ships the
 *   barrel.
 * - The only text ever removed from a line is a LEADING comment prefix: when a
 *   whole-line comment closes mid-line the tail is kept
 *   (`    /* c *\/ import { A } from './a';` → ` import { A } from './a';`).
 *   Nothing is ever cut from the middle or the end of a line.
 * - Backticks are counted per emitted line, and while that count is odd nothing
 *   on the following lines is treated as a comment. Without this, a line-initial
 *   `/*` inside a template literal set the block flag and blanked every
 *   remaining line up to the next `*\/` — or, with no `*\/` at all, to EOF,
 *   deleting real imports and returning `false` from
 *   {@link hasRuntimeBillingImport}. Verified: on
 *   `const css = \`\n/* opened inside the template\n\`;\nimport { EntitlementKey }
 *   from '@repo/billing';` the guard-less version returns "const css = `" plus
 *   three blank lines. Across the 725 `.ts`/`.tsx`/`.astro` files under `src`
 *   the guard changes the result on exactly one (2026-07-29):
 *   `layouts/BaseLayout.astro`, whose inline `<script>` bootstrap really does
 *   open a line-initial `/*` inside a template literal. Over-detecting the
 *   template state is safe (it only leaves comments in place, the loud
 *   direction); under-detecting is caught by the throw below.
 * - A block comment that never closes before EOF THROWS rather than blanking the
 *   remainder. Blanking to EOF is precisely how a real import disappears without
 *   a trace. No file in the corpus triggers this today — it is a tripwire, not a
 *   fix for a live case.
 *
 * @param content - Raw source text.
 * @returns The source with whole-line comments replaced by empty lines.
 * @throws When a block comment is opened and never closed.
 */
export function stripComments(content: string): string {
    const lines = content.split('\n');
    const out: string[] = [];
    let inBlock = false;
    let blockOpenedAtLine = 0;
    let inTemplate = false;

    const emit = (text: string): void => {
        if (countUnescapedBackticks(text) % 2 === 1) {
            inTemplate = !inTemplate;
        }
        out.push(text);
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] as string;

        if (inBlock) {
            const end = line.indexOf('*/');
            if (end === -1) {
                out.push('');
                continue;
            }
            inBlock = false;
            emit(line.slice(end + 2));
            continue;
        }

        const trimmed = line.trimStart();

        // Inside an open template literal nothing is a comment.
        if (!inTemplate) {
            if (trimmed.startsWith('//')) {
                out.push('');
                continue;
            }

            if (trimmed.startsWith('/*')) {
                const bodyStart = line.length - trimmed.length + 2;
                const end = line.indexOf('*/', bodyStart);
                if (end === -1) {
                    inBlock = true;
                    blockOpenedAtLine = index + 1;
                    out.push('');
                    continue;
                }
                emit(line.slice(end + 2));
                continue;
            }
        }

        emit(line);
    }

    if (inBlock) {
        throw new Error(
            `stripComments: a block comment opened at line ${blockOpenedAtLine} never closes. ` +
                'Refusing to blank the rest of the file, which would silently delete import ' +
                'statements and turn this guard green on a real violation.'
        );
    }

    return out.join('\n');
}

/** Replaces every character of `span` except newlines, preserving offsets. */
const blankSpan = (span: string): string => span.replace(/[^\n]/g, ' ');

/**
 * Blanks `<!-- … -->` and `{/* … *\/}` spans in an `.astro` TEMPLATE, keeping
 * every other character at its original offset.
 *
 * {@link stripComments} knows `//` and `/* *\/` only, so neither markup comment
 * form is removed by it — and both are used in this corpus to DOCUMENT
 * hydration choices in prose. Measured 2026-07-29: 4 `.astro` files carry a
 * `client:*` token inside an HTML comment
 * (`components/shared/cards/AccommodationCard.astro`,
 * `components/shared/navigation/MobileMenuIsland.astro`,
 * `pages/[lang]/destinos/[...path].astro`, `pages/[lang]/publicar/index.astro`)
 * and `layouts/Footer.astro` carries one inside a `{/* … *\/}` block.
 *
 * Today those only produce a duplicate island (absorbed by the entrypoint
 * `Set`) or a directive the tag scan happens to drop. Neither is by design: a
 * comment placed after an unrelated `<Capitalized` tag attributes the prose
 * directive to that tag and injects a bogus entrypoint.
 *
 * Blanking with spaces rather than deleting keeps offsets and line structure
 * intact, so the nearest-preceding-tag scan below reads the same positions it
 * would have read without comments.
 */
export function blankMarkupComments(template: string): string {
    return template
        .replace(/<!--[\s\S]*?-->/g, blankSpan)
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blankSpan);
}

/**
 * Blanks every `/* … *\/` REGION of a source, wherever it sits on its line.
 *
 * Used only to build the baseline for the corpus safety net in the guard suite:
 * a deliberately commented-out `/*\nimport { K } from './k';\n*\/` is normal
 * debugging practice, and counting it against the raw source would report
 * {@link stripComments} as having "lost" an import it was right to remove.
 *
 * This is a naive regex with no string/regex-literal awareness, which is
 * acceptable HERE and nowhere else: it only ever weakens the baseline (fewer
 * expected edges), so it can make that test more permissive but never falsely
 * red.
 */
export function blankBlockCommentRegions(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, blankSpan);
}

/**
 * Decides whether an import/export CLAUSE survives TypeScript's type erasure.
 *
 * @param clause - Everything between the `import`/`export` keyword and `from`:
 *        `type { A }`, `{ A, type B }`, `Default, { type B }`, `* as ns`, `*`.
 * @returns `true` when the statement still executes at runtime.
 */
export function clauseSurvivesErasure(clause: string): boolean {
    const trimmed = clause.trim();

    // `import type …` / `export type { … }` — erased wholesale.
    if (/^type\b/.test(trimmed)) {
        return false;
    }

    const brace = /\{([^}]*)\}/.exec(trimmed);

    // No named-binding group at all: default, namespace, or `export * from`.
    if (brace === null) {
        return true;
    }

    // A default binding sitting outside the braces (`import EK, { type L } from`)
    // is a value binding regardless of what is inside them.
    const outside = (trimmed.slice(0, brace.index) + trimmed.slice(brace.index + brace[0].length))
        .replace(/,/g, ' ')
        .trim();
    if (outside.length > 0) {
        return true;
    }

    const specifiers = brace[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // `import {} from 'x'` binds nothing but still executes the module.
    if (specifiers.length === 0) {
        return true;
    }

    return specifiers.some((s) => !/^type\b/.test(s));
}

/**
 * Reports whether `content` pulls {@link FORBIDDEN_PACKAGE} into the emitted
 * module graph, in ANY of the forms that survive compilation:
 *
 * - `import … from` / `import` (side effect) / `import(…)` (dynamic)
 * - `export … from` / `export * from` — a re-export puts the package in the
 *   graph of everyone importing the re-exporter
 * - with or without whitespace (`import{X}from'…'`), either quote style, bare
 *   package or any subpath entry
 *
 * Fully type-only clauses are erased and therefore allowed. Pass
 * {@link stripComments} output, not raw source.
 */
export function hasRuntimeBillingImport(content: string): boolean {
    const fromPattern = new RegExp(`${FROM_PREFIX}['"]${FORBIDDEN_SPECIFIER}['"]`, 'g');

    let match = fromPattern.exec(content);
    while (match !== null) {
        if (clauseSurvivesErasure(match[1] ?? '')) {
            return true;
        }
        match = fromPattern.exec(content);
    }

    // Side-effect import: `import '@repo/billing';`
    if (new RegExp(`${SIDE_EFFECT_PREFIX}['"]${FORBIDDEN_SPECIFIER}['"]`, 'm').test(content)) {
        return true;
    }

    // Dynamic import: `await import('@repo/billing')`
    return new RegExp(`\\bimport\\b\\s*\\(\\s*['"]${FORBIDDEN_SPECIFIER}['"]`).test(content);
}

/** A single module-graph edge discovered in a source file. */
export interface ImportEdge {
    /** The raw module specifier as written. */
    readonly specifier: string;
    /** `true` when the whole statement is erased by the TS compiler. */
    readonly typeOnly: boolean;
}

/**
 * Extracts every module specifier imported (or re-exported) by `content`,
 * flagging the ones whose statement is fully type-only. Type-only edges are NOT
 * real graph edges: `import type { PublicPlanData } from
 * '@/lib/billing/fetch-plans'` never puts `fetch-plans` in the browser bundle,
 * so following it would judge an SSR-only module by a client-side rule.
 */
export function extractImportEdges(content: string): ImportEdge[] {
    const edges: ImportEdge[] = [];

    const fromPattern = new RegExp(`${FROM_PREFIX}['"]([^'"\\n]+)['"]`, 'g');
    let match = fromPattern.exec(content);
    while (match !== null) {
        const specifier = match[2];
        if (specifier !== undefined) {
            edges.push({ specifier, typeOnly: !clauseSurvivesErasure(match[1] ?? '') });
        }
        match = fromPattern.exec(content);
    }

    for (const pattern of [
        new RegExp(`${SIDE_EFFECT_PREFIX}['"]([^'"\\n]+)['"]`, 'gm'),
        /\bimport\b\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
    ]) {
        let hit = pattern.exec(content);
        while (hit !== null) {
            const specifier = hit[1];
            if (specifier !== undefined) {
                edges.push({ specifier, typeOnly: false });
            }
            hit = pattern.exec(content);
        }
    }

    return edges;
}

/**
 * Resolves a relative or `@/`-aliased specifier to an on-disk file path.
 *
 * @returns The absolute path, or `null` for bare specifiers and anything not on
 *          disk (e.g. `.css` side-effect imports).
 */
export function resolveLocal(specifier: string, fromFile: string): string | null {
    let base: string;

    if (specifier.startsWith('@/')) {
        base = path.join(WEB_SRC, specifier.slice(2));
    } else if (specifier.startsWith('.')) {
        base = path.resolve(path.dirname(fromFile), specifier);
    } else {
        return null;
    }

    // `./foo.js` in TS source maps to `./foo.ts` on disk (NodeNext style).
    const candidates = base.endsWith('.js') ? [base.slice(0, -3), base] : [base];

    for (const candidate of candidates) {
        for (const suffix of RESOLVE_SUFFIXES) {
            const full = `${candidate}${suffix}`;
            if (fs.existsSync(full) && fs.statSync(full).isFile()) {
                return full;
            }
        }
    }

    return null;
}

/** A hydrated island discovered through a `client:*` directive. */
export interface AstroHydratedIsland {
    /** Absolute path of the hydrated module, `null` when it is not local. */
    readonly file: string | null;
    /** The `.astro` file carrying the directive, relative to `src`. */
    readonly from: string;
    /** The component's import specifier as written in the frontmatter. */
    readonly specifier: string | null;
    /** Tag name as written in the template. */
    readonly tag: string;
}

/** Everything the `.astro` hydration sweep found, INCLUDING what it dropped. */
export interface AstroHydrationScan {
    /** One entry per `client:*` directive successfully attributed to a tag. */
    readonly islands: readonly AstroHydratedIsland[];
    /**
     * `client:*` directives whose owning tag could not be determined, one
     * `<file>: …<preceding context>` line each. Silently `continue`-ing these
     * is how the guard's scope shrinks without anyone noticing, so they are
     * returned and pinned by the suite instead. The context, not a byte offset,
     * is what identifies them: an offset moves on any edit to the file, while
     * the surrounding words moving is exactly when someone should re-look.
     */
    readonly unattributed: readonly string[];
    /**
     * `.astro` files skipped because no `---` frontmatter fence was found. Such
     * a file contributes ZERO islands, so an unnoticed entry here silently
     * removes every entrypoint that file would have provided.
     */
    readonly skippedFiles: readonly string[];
}

/** Maps each value binding in an `.astro` frontmatter to its module specifier. */
function collectFrontmatterBindings(frontmatter: string): Map<string, string> {
    const bindings = new Map<string, string>();
    const pattern = new RegExp(`${FROM_PREFIX}['"]([^'"\\n]+)['"]`, 'g');

    let match = pattern.exec(frontmatter);
    while (match !== null) {
        const clause = (match[1] ?? '').trim();
        const specifier = match[2];

        if (specifier !== undefined && clauseSurvivesErasure(clause)) {
            const defaultBinding = /^([A-Za-z_$][\w$]*)/.exec(clause);
            if (defaultBinding?.[1] !== undefined) {
                bindings.set(defaultBinding[1], specifier);
            }

            const namespaceBinding = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
            if (namespaceBinding?.[1] !== undefined) {
                bindings.set(namespaceBinding[1], specifier);
            }

            const inner = /\{([^}]*)\}/.exec(clause)?.[1];
            if (inner !== undefined) {
                for (const raw of inner.split(',')) {
                    const part = raw.trim();
                    if (part.length === 0 || /^type\b/.test(part)) {
                        continue;
                    }
                    const aliased = /^[\w$]+\s+as\s+([\w$]+)$/.exec(part);
                    bindings.set(aliased?.[1] ?? part, specifier);
                }
            }
        }

        match = pattern.exec(frontmatter);
    }

    return bindings;
}

/**
 * Finds every component hydrated by a `client:*` directive in an `.astro` file.
 *
 * `*.client.tsx` is a NAMING CONVENTION, not the hydration surface: three
 * islands here are hydrated from modules without the suffix
 * (`AiChatWidget.tsx`, `PriceAlertButton.tsx`, `EditableNote.tsx`), plus
 * `FeedbackForm` from the bare `@repo/feedback`. A filename sweep never scans
 * any of them, and "outside the sweep" is reason enough — none of the three
 * imports `@repo/billing` today, directly or transitively.
 *
 * Each directive is attributed to the nearest preceding `<Capitalized` tag with
 * no intervening `<`, then resolved through the frontmatter imports. Directives
 * that cannot be attributed, and files without a frontmatter fence, are
 * REPORTED rather than dropped — see {@link AstroHydrationScan}.
 */
export function scanAstroHydration(): AstroHydrationScan {
    const islands: AstroHydratedIsland[] = [];
    const unattributed: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of collectFiles(WEB_SRC, (name) => name.endsWith('.astro'))) {
        const from = path.relative(WEB_SRC, file);
        const content = stripComments(fs.readFileSync(file, 'utf-8'));
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
        if (frontmatter === null) {
            skippedFiles.push(from);
            continue;
        }

        const bindings = collectFrontmatterBindings(frontmatter[1] ?? '');
        const template = blankMarkupComments(content.slice(frontmatter[0].length));

        const directive = /\bclient:(?:load|idle|visible|only|media)\b/g;
        let hit = directive.exec(template);
        while (hit !== null) {
            const head = template.slice(0, hit.index);
            const tag = /<([A-Z][\w$.]*)[^<]*$/.exec(head)?.[1];
            hit = directive.exec(template);

            if (tag === undefined) {
                unattributed.push(`${from}: …${head.slice(-70).replace(/\s+/g, ' ').trim()}`);
                continue;
            }

            const specifier = bindings.get(tag.split('.')[0] ?? tag) ?? null;
            const resolved = specifier === null ? null : resolveLocal(specifier, file);
            islands.push({
                tag,
                from,
                specifier,
                // A `.astro` component is server-only markup and can never be a
                // hydrated island, so it is never a client entrypoint.
                file: resolved?.endsWith('.astro') ? null : resolved
            });
        }
    }

    return { islands, unattributed, skippedFiles };
}

/**
 * Every client-bundle entrypoint: the `*.client.tsx` filename sweep UNIONed
 * with the `.astro`-derived hydration surface. Neither alone is complete.
 */
export function collectEntrypoints(): string[] {
    const entrypoints = new Set(collectFiles(WEB_SRC, (name) => name.endsWith('.client.tsx')));

    for (const island of scanAstroHydration().islands) {
        if (island.file !== null) {
            entrypoints.add(island.file);
        }
    }

    return [...entrypoints].sort();
}

/** A module reached from a client entrypoint that imports the forbidden barrel. */
export interface Offender {
    /** The offending module, relative to `src`. */
    readonly module: string;
    /** Shortest known import chain from an entrypoint down to it. */
    readonly chain: readonly string[];
}

/**
 * Comment-stripped source, keyed by absolute path.
 *
 * `findOffenders` restarts its BFS at every entrypoint, so a widely-shared leaf
 * (`lib/cn.ts` is reached from 83 of the 162 entrypoints, measured 2026-07-29)
 * was read and stripped once per walk
 * per entrypoint — and the suite performs five full walks. Caching removes the
 * future incentive to weaken the mutation tests for speed.
 */
const strippedCache = new Map<string, string>();

/**
 * Drops the {@link strippedCache}. MUST be called by any test that mutates what
 * `fs.readFileSync` returns, on both sides of the mutation — otherwise the walk
 * either misses the planted violation or keeps seeing it after restore.
 */
export function clearStrippedCache(): void {
    strippedCache.clear();
}

function readStripped(file: string): string {
    const cached = strippedCache.get(file);
    if (cached !== undefined) {
        return cached;
    }

    const stripped = stripComments(fs.readFileSync(file, 'utf-8'));
    strippedCache.set(file, stripped);
    return stripped;
}

/**
 * Walks the transitive local import graph from every entrypoint, returning
 * each module that carries a runtime `@repo/billing` import.
 *
 * Results are de-duplicated BY OFFENDING MODULE, keeping the shortest chain:
 * one violating shared module is one bug, not one bug per island reaching it
 * (planting a violation in `lib/cn.ts` otherwise reported 83 identical rows).
 * Type-only edges are not followed — see {@link extractImportEdges}.
 *
 * @param entries - Absolute paths of the client entrypoints.
 * @param visited - Populated with every module the walk reached.
 */
export function findOffenders(entries: readonly string[], visited: Set<string>): Offender[] {
    const shortestChainByModule = new Map<string, readonly string[]>();

    for (const entry of entries) {
        const seen = new Set<string>();
        const queue: Array<{ file: string; chain: string[] }> = [
            { file: entry, chain: [path.relative(WEB_SRC, entry)] }
        ];

        while (queue.length > 0) {
            const next = queue.shift();
            if (next === undefined) {
                break;
            }

            const { file, chain } = next;
            if (seen.has(file)) {
                continue;
            }
            seen.add(file);
            visited.add(file);

            const content = readStripped(file);

            if (hasRuntimeBillingImport(content)) {
                const key = path.relative(WEB_SRC, file);
                const known = shortestChainByModule.get(key);
                if (known === undefined || chain.length < known.length) {
                    shortestChainByModule.set(key, chain);
                }
            }

            for (const edge of extractImportEdges(content)) {
                if (edge.typeOnly) {
                    continue;
                }
                const resolved = resolveLocal(edge.specifier, file);
                if (resolved !== null && !seen.has(resolved)) {
                    queue.push({
                        file: resolved,
                        chain: [...chain, path.relative(WEB_SRC, resolved)]
                    });
                }
            }
        }
    }

    return [...shortestChainByModule.entries()]
        .map(([module, chain]) => ({ module, chain }))
        .sort((a, b) => a.module.localeCompare(b.module));
}

/**
 * Counts `import` / `export … from` STATEMENTS. Anchored at line start with
 * only horizontal whitespace allowed before the keyword, so JSDoc body lines
 * (` * import …`) and commented-out code (`// import …`) cannot inflate a count.
 *
 * Deliberately imprecise in one direction: `^[ \t]*import\b` also matches a bare
 * `import.meta.env.SSR;` expression statement (one occurrence in the corpus,
 * `lib/api/client.ts`). That is harmless for the before/after DELTA this is used
 * for — the same line is counted on both sides — but do not read the absolute
 * number as "number of import declarations".
 */
export function countImportStatements(source: string): number {
    const statements = source.match(/^[ \t]*import\b/gm)?.length ?? 0;
    const reExports = source.match(/^[ \t]*export\b[^\n]*\bfrom\b/gm)?.length ?? 0;
    return statements + reExports;
}
