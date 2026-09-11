/**
 * @file client-visible-null-first-render.test.ts
 * @description Static guard: a component mounted with `client:visible` must
 * not render `null` on its first paint (HOS-1031).
 *
 * WHY THIS GUARD EXISTS. `FeaturedToggleSection.client.tsx` fetched its
 * entitlement on mount and started with `useState(true)` for `isLoading`, then
 * `if (isLoading) { return null; }` before anything else — so its SSR output,
 * and its very first client render, was always `null`. Astro's `<astro-island>`
 * wrapper carries a fixed `display: contents` rule, which collapses to a
 * zero-size box when it has no rendered children. `client:visible` hydrates
 * through an `IntersectionObserver`, which needs a non-zero observed area to
 * ever fire — so the island never hydrated, the toggle never appeared, and
 * nothing in the console said why. The fix was to mount with `client:idle`
 * instead, which does not depend on layout size (see
 * `CompareCardSelect.client.tsx` for the same fix applied earlier, HOS-85).
 *
 * WHAT IT CHECKS. For every JSX tag carrying `client:visible` in a `.astro`
 * file, resolve the mounted component's source (via the astro file's own
 * import) and flag it if the component both (a) initializes a state variable
 * with `useState(true)` and (b) has an unconditional `if (<thatVar>) { return
 * null; }` guarding its render — the exact shape of the bug above. A loading
 * state that renders a skeleton/placeholder instead of `null`
 * (`RecommendationsFeed.client.tsx`) is not flagged: rendering SOMETHING keeps
 * the wrapper non-zero-size, which is what actually matters here.
 *
 * WHAT IT DOES NOT SEE, so a green run is not mistaken for more:
 *   - A `return null` gated on a prop instead of an owned loading state (e.g.
 *     `ExternalReviews.client.tsx`'s `if (visible.length === 0) return null`)
 *     — that value is known at SSR time from server-rendered props, so the
 *     wrapper already has the right size (0 or not) before the browser ever
 *     gets to decide, and no observer race exists.
 *   - A loading flag not literally named via `useState(true)` (e.g. derived
 *     from a ref, a reducer, or `useState(someVariable)`). This is a text
 *     heuristic, not a data-flow analysis; it catches the shape that has
 *     actually recurred in this codebase, not every way the bug could in
 *     principle be written.
 *   - Components mounted through indirection (e.g. an `.astro` file that
 *     re-exports a wrapper before mounting it) whose import cannot be
 *     resolved by a direct `import ... from '...'` match in the same file.
 *
 * @module test/static-guards/client-visible-null-first-render
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = path.resolve(__dirname, '../..');
const WEB_SRC = path.join(WEB_ROOT, 'src');

/**
 * Components allowed to keep this shape.
 *
 * Empty on purpose (HOS-1031): every live `client:visible` mount in `src/` was
 * swept when this guard was written and none carries the bug. Adding an entry
 * here requires a reason written next to it AND a check that removing it makes
 * this guard fail — see the sibling guards in this directory for the pattern.
 */
const EXEMPTIONS: readonly string[] = [];

/** Recursively collect every `.astro` file under `dir`. */
function collectAstroFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...collectAstroFiles(full));
            continue;
        }
        if (entry.name.endsWith('.astro')) {
            found.push(full);
        }
    }
    return found;
}

/**
 * Component tag names mounted with `client:visible` in an `.astro` source.
 *
 * Anchored on the opening `<ComponentName` through the tag's closing `>`, with
 * `client:visible` required to appear as a whole word inside that same span —
 * so a comment merely mentioning `client:visible` (several files in this repo
 * document a PAST bug that way) never matches, because comments don't open
 * with `<UppercaseName`.
 */
function findClientVisibleMounts(source: string): string[] {
    const pattern = /<([A-Z][A-Za-z0-9]*)\b[^>]*?\bclient:visible\b[^>]*?\/?>/gs;
    const names = new Set<string>();
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
    while ((match = pattern.exec(source))) {
        names.add(match[1]);
    }
    return [...names];
}

/** Where a locally-used component name comes from, per the file's imports. */
interface ImportSource {
    readonly modulePath: string;
    /** The name exported by the module (may differ from the local alias). */
    readonly exportedName: string;
}

/**
 * Resolves a local JSX tag name to the module specifier and exported name it
 * was imported from, by reading the `.astro` file's own `import` statements
 * (named and default forms, including `X as Y` aliasing).
 */
function findImportSource({
    source,
    localName
}: {
    readonly source: string;
    readonly localName: string;
}): ImportSource | null {
    const namedImportRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
    let namedMatch: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
    while ((namedMatch = namedImportRe.exec(source))) {
        const specifiers = namedMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        for (const specifier of specifiers) {
            const aliasMatch = specifier.match(/^(\w+)\s+as\s+(\w+)$/);
            const exportedName = aliasMatch ? aliasMatch[1] : specifier;
            const resolvedLocalName = aliasMatch ? aliasMatch[2] : specifier;
            if (resolvedLocalName === localName) {
                return { modulePath: namedMatch[2], exportedName };
            }
        }
    }

    const defaultImportRe = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+)['"]/g;
    let defaultMatch: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
    while ((defaultMatch = defaultImportRe.exec(source))) {
        if (defaultMatch[1] === localName) {
            return { modulePath: defaultMatch[2], exportedName: localName };
        }
    }

    return null;
}

/**
 * Resolves a module specifier (either the `@/` alias or a relative path) to an
 * existing `.ts`/`.tsx` file on disk, trying the plain extension and an
 * `index` file in that order.
 */
function resolveModuleFile({
    modulePath,
    fromFile
}: {
    readonly modulePath: string;
    readonly fromFile: string;
}): string | null {
    let base: string;
    if (modulePath.startsWith('@/')) {
        base = path.join(WEB_SRC, modulePath.slice(2));
    } else if (modulePath.startsWith('.')) {
        base = path.resolve(path.dirname(fromFile), modulePath);
    } else {
        // A package import (React, a shared package, etc.) — not a component
        // this guard can or should inspect.
        return null;
    }

    const candidates = [
        `${base}.tsx`,
        `${base}.ts`,
        path.join(base, 'index.tsx'),
        path.join(base, 'index.ts')
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/**
 * Extracts the source of a named component's function body (function
 * declaration or arrow-function-with-parens form).
 *
 * Finds the parameter list's `(...)` first and bracket-matches PARENS to find
 * where it ends, THEN looks for the body's opening `{` after that — not the
 * naive "first `{` after the function name", which lands on a destructured
 * parameter's own `{ locale, accommodationId }` instead of the function body
 * for every component in this codebase (they all destructure props inline).
 */
function extractComponentBody({
    source,
    exportedName
}: {
    readonly source: string;
    readonly exportedName: string;
}): string | null {
    const functionDeclRe = new RegExp(`function\\s+${exportedName}\\s*\\(`);
    const arrowAssignRe = new RegExp(`const\\s+${exportedName}\\s*(?::[^=]+)?=\\s*\\(`);

    let paramsStart = -1;
    const declMatch = functionDeclRe.exec(source);
    if (declMatch) {
        paramsStart = declMatch.index + declMatch[0].length - 1;
    } else {
        const arrowMatch = arrowAssignRe.exec(source);
        if (arrowMatch) {
            paramsStart = arrowMatch.index + arrowMatch[0].length - 1;
        }
    }
    if (paramsStart === -1 || source[paramsStart] !== '(') return null;

    let parenDepth = 0;
    let paramsEnd = -1;
    for (let i = paramsStart; i < source.length; i++) {
        if (source[i] === '(') parenDepth++;
        else if (source[i] === ')') {
            parenDepth--;
            if (parenDepth === 0) {
                paramsEnd = i;
                break;
            }
        }
    }
    if (paramsEnd === -1) return null;

    const braceOffset = source.indexOf('{', paramsEnd + 1);
    if (braceOffset === -1) return null;

    let braceDepth = 0;
    for (let i = braceOffset; i < source.length; i++) {
        if (source[i] === '{') braceDepth++;
        else if (source[i] === '}') {
            braceDepth--;
            if (braceDepth === 0) return source.slice(braceOffset, i + 1);
        }
    }
    return null;
}

/**
 * The bug shape itself: a state variable seeded `true` (i.e. "loading" by
 * default) with an unconditional `if (<var>) { return null; }` gating the
 * component's render.
 *
 * @returns The offending state variable's name, or `null` if the body is clean.
 */
function findNullOnLoadVariable(body: string): string | null {
    const stateBindingRe =
        /const\s*\[\s*(\w+)\s*,\s*set\w+\s*]\s*=\s*useState(?:<[^>]*>)?\(\s*true\s*\)/g;
    const candidates: string[] = [];
    let bindingMatch: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
    while ((bindingMatch = stateBindingRe.exec(body))) {
        candidates.push(bindingMatch[1]);
    }

    for (const varName of candidates) {
        const nullReturnRe = new RegExp(
            `if\\s*\\(\\s*${varName}\\s*\\)\\s*\\{?\\s*return null\\s*;`
        );
        if (nullReturnRe.test(body)) return varName;
    }
    return null;
}

/** One flagged mount: which `.astro` file mounts which component, and why. */
interface Violation {
    readonly astroFile: string;
    readonly componentFile: string;
    readonly stateVar: string;
}

function findViolations({ exemptions }: { readonly exemptions: readonly string[] }): Violation[] {
    const violations: Violation[] = [];

    for (const astroFile of collectAstroFiles(WEB_SRC)) {
        const relativeAstroFile = path.relative(WEB_SRC, astroFile);
        if (exemptions.includes(relativeAstroFile)) continue;

        const astroSource = fs.readFileSync(astroFile, 'utf8');
        const mountedNames = findClientVisibleMounts(astroSource);
        if (mountedNames.length === 0) continue;

        for (const localName of mountedNames) {
            const importSource = findImportSource({ source: astroSource, localName });
            if (!importSource) continue;

            const componentFile = resolveModuleFile({
                modulePath: importSource.modulePath,
                fromFile: astroFile
            });
            if (!componentFile) continue;

            const componentSource = fs.readFileSync(componentFile, 'utf8');
            const body = extractComponentBody({
                source: componentSource,
                exportedName: importSource.exportedName
            });
            if (!body) continue;

            const stateVar = findNullOnLoadVariable(body);
            if (stateVar) {
                violations.push({
                    astroFile: relativeAstroFile,
                    componentFile: path.relative(WEB_SRC, componentFile),
                    stateVar
                });
            }
        }
    }

    return violations;
}

describe('a client:visible island never renders null on its first paint', () => {
    it('no mounted component renders null while a useState(true) loading flag is set', () => {
        const violations = findViolations({ exemptions: EXEMPTIONS });
        expect(violations).toEqual([]);
    });

    it('recognises the exact shape that caused HOS-1031 (the guard is not vacuous)', () => {
        const removedShape = `
export function FeaturedToggleSection({ locale, accommodationId }: Props) {
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {}, []);
    if (isLoading) {
        return null;
    }
    return <div />;
}`;
        const body = extractComponentBody({
            source: removedShape,
            exportedName: 'FeaturedToggleSection'
        });
        expect(body).not.toBeNull();
        expect(findNullOnLoadVariable(body ?? '')).toBe('isLoading');
    });

    it('does not fire on a loading state that renders a placeholder instead of null', () => {
        const safeShape = `
export function RecommendationsFeed({ locale }: Props) {
    const [loading, setLoading] = useState(true);
    if (loading) {
        return <Skeleton />;
    }
    return <div />;
}`;
        const body = extractComponentBody({
            source: safeShape,
            exportedName: 'RecommendationsFeed'
        });
        expect(body).not.toBeNull();
        expect(findNullOnLoadVariable(body ?? '')).toBeNull();
    });

    it('does not fire on a return null gated by a prop rather than an owned loading state', () => {
        const propGatedShape = `
export function ExternalReviews({ snippets }: Props) {
    const visible = snippets.slice(0, 5);
    if (visible.length === 0) {
        return null;
    }
    return <div />;
}`;
        const body = extractComponentBody({
            source: propGatedShape,
            exportedName: 'ExternalReviews'
        });
        expect(body).not.toBeNull();
        expect(findNullOnLoadVariable(body ?? '')).toBeNull();
    });

    it('recognises client:visible on a real JSX mount but not inside a comment', () => {
        const realMount = '<CommentThreadIsland entityId={id} client:visible />';
        const commentedMount = '{/* was mounted with client:visible before HOS-1031 */}';
        expect(findClientVisibleMounts(realMount)).toEqual(['CommentThreadIsland']);
        expect(findClientVisibleMounts(commentedMount)).toEqual([]);
    });
});
