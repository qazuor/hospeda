/**
 * @file i18n-namespace-prefix.guard.test.ts
 * @description Fails when a `t()` / `tPlural()` call names a namespace that the
 * catalogue does not register, so the key can never resolve.
 *
 * Why this guard exists (H-45, smoke agosto 2026). The destination detail page
 * shipped `t('destination.detailPage.accommodationsIn', 'Alojamientos en')`.
 * `packages/i18n/src/config.shared.ts` registers `destination.json` under the
 * namespace `destinations` — plural. The singular key therefore never existed,
 * `resolve()` fell through to the inline fallback on every request, and 22
 * destinations × 3 locales served the Spanish fallback. `/en/` rendered
 * "Alojamientos en Concepción del Uruguay" directly beneath a correctly
 * translated "In this destination".
 *
 * The failure is invisible by construction, which is why review never caught it
 * across 47 call sites:
 *   - it does not throw, log, or 500 — `resolve()` returns the fallback;
 *   - the fallback is well-written Spanish, so `/es/` looks perfect;
 *   - the locale-parity guards (`check-locales.ts`, `key-coverage.test.ts`) pass,
 *     because the JSON files are complete and in sync. They audit the catalogue,
 *     never the call sites, so a key nobody can reach is invisible to them;
 *   - `[MISSING: …]` is emitted only under `import.meta.env.DEV`, and only when
 *     the call site passes no fallback at all.
 *
 * This guard asks the one question those guards do not: can this key be reached?
 * It reports two distinct defects that share that single symptom —
 *   (a) a misspelled namespace, where the translation exists and is simply never
 *       read (`destination.` → `destinations.`), and
 *   (b) a namespace that does not exist at all, where the inline fallback is the
 *       only copy that was ever written (`articles.*`).
 * Both serve one language to every locale; only the remedy differs.
 *
 * Scope note: the predicate is namespace reachability, nothing more. A key whose
 * namespace resolves but whose leaf is absent still falls back silently — that
 * is a different question, and this guard does not claim to answer it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve as resolvePath } from 'node:path';
import { namespaces } from '@repo/i18n/web';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolvePath(__dirname, '../../../..');
const WEB_SRC = join(REPO_ROOT, 'apps/web/src');

const ALL_NAMESPACES: ReadonlySet<string> = new Set(namespaces as readonly string[]);

/**
 * A translation call whose key is a literal with at least two dotted segments.
 *
 * The leading `(?<![.\w])` is what keeps `format(`, `.at(`, and `assert(` out:
 * only a bare `t(` / `tPlural(` qualifies, never a method call or a longer
 * identifier ending in those letters. Template literals are matched too, since
 * `` t(`destination.${x}`) `` fails in exactly the same way — the namespace head
 * is static even when the tail is not.
 */
const TRANSLATION_CALL = /(?<![.\w])(?:t|tPlural)\(\s*['"`]([A-Za-z0-9_-]+)\.[A-Za-z0-9_.-]/g;

/**
 * `\s*` above must be able to cross a newline, so the scan runs over the whole
 * file rather than line by line. A per-line scan silently misses the very
 * common prettier output
 *
 *   t(
 *       'destination.detail.title',
 *       'Sobre el destino'
 *   )
 *
 * and a guard that cannot see a call site cannot report it — the clean run
 * would be an artefact of the scan shape, not of the tree.
 */
const lineOf = (source: string, index: number): number => source.slice(0, index).split('\n').length;

const SOURCE_FILE = /\.(astro|tsx?|mts)$/;
const isTestFile = (file: string): boolean =>
    /\.test\.[cm]?tsx?$/.test(file) || file.includes('__tests__') || file.includes('/test/');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (SOURCE_FILE.test(full) && !isTestFile(full)) out.push(full);
    }
    return out;
}

/**
 * Blanks comments so a documented bad example cannot fail the build, while
 * preserving every newline so reported line numbers stay true to the file.
 */
const blankComments = (src: string): string =>
    src
        .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
        .replace(/^([ \t]*)\/\/.*$/gm, (_line, indent: string) => indent);

type Offence = { readonly namespace: string; readonly where: string };

function findUnreachableCalls(files: readonly string[]): Offence[] {
    const offences: Offence[] = [];
    for (const file of files) {
        // Comments are blanked, not deleted, so reported line numbers keep
        // matching the file on disk. Stripping them outright collapses a block
        // comment to nothing and shifts every line below it.
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(TRANSLATION_CALL)) {
            const namespace = match[1] as string;
            if (ALL_NAMESPACES.has(namespace)) continue;
            offences.push({
                namespace,
                where: `${relative(REPO_ROOT, file)}:${lineOf(source, match.index)}`
            });
        }
    }
    return offences;
}

describe('H-45 — every translated key names a registered namespace', () => {
    const files = walk(WEB_SRC);

    it('scans a non-empty source tree', () => {
        // A silent empty scan reads exactly like "no offences found". If the
        // path or the extension filter ever drifts, fail here rather than
        // reporting a clean run over nothing.
        expect(files.length).toBeGreaterThan(500);
        expect(ALL_NAMESPACES.size).toBeGreaterThan(40);
    });

    it('detects an unreachable namespace when one is present', () => {
        // Verifies the instrument, not the tree: a guard that cannot fail on a
        // known-bad input proves nothing when it passes on the real one.
        const sample = "const label = t('destinationX.detailPage.title', 'Título');";
        const heads = [...blankComments(sample).matchAll(TRANSLATION_CALL)].map((m) => m[1]);
        expect(heads).toEqual(['destinationX']);
        expect(ALL_NAMESPACES.has('destinationX')).toBe(false);
    });

    it('sees a call whose key sits on the next line', () => {
        // The blind spot this guard shipped with: a per-line scan reports a
        // clean tree because it never looks across the newline. Formatting a
        // call across lines must not launder it.
        const wrapped = [
            'const label = t(',
            "    'destinationX.detail.title',",
            "    'Sobre'",
            ');'
        ].join('\n');
        const heads = [...blankComments(wrapped).matchAll(TRANSLATION_CALL)].map((m) => m[1]);
        expect(heads).toEqual(['destinationX']);
    });

    it('reports the line the call actually sits on', () => {
        const withBlockComment = ['/*', ' * filler', ' */', "t('destinationX.a.b');"].join('\n');
        const blanked = blankComments(withBlockComment);
        const match = [...blanked.matchAll(TRANSLATION_CALL)][0];
        expect(match).toBeDefined();
        expect(lineOf(blanked, (match as RegExpMatchArray).index as number)).toBe(4);
    });

    it('ignores calls that are not translation calls', () => {
        const decoys = [
            "format('destination.foo')",
            "expect('destination.foo').toBe(x)",
            "arr.at('destination.foo')",
            "somet('destination.foo')"
        ].join('\n');
        expect([...decoys.matchAll(TRANSLATION_CALL)]).toEqual([]);
    });

    it('names no namespace the catalogue does not register', () => {
        const offences = findUnreachableCalls(files);
        const byNamespace = new Map<string, string[]>();
        for (const { namespace, where } of offences) {
            byNamespace.set(namespace, [...(byNamespace.get(namespace) ?? []), where]);
        }
        const report = [...byNamespace.entries()]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([ns, sites]) => `  ${ns}  — ${sites.length} call site(s), e.g. ${sites[0]}`)
            .join('\n');

        expect(
            offences,
            'These keys name a namespace that @repo/i18n never registers, so ' +
                'resolve() can never read the catalogue and serves the inline ' +
                'fallback — one language, in every locale:\n' +
                `${report}\n` +
                'Registered namespaces come from webNamespaces in ' +
                'packages/i18n/src/config.shared.ts. Note that a file name is not ' +
                'a namespace: destination.json registers as `destinations`.'
        ).toEqual([]);
    });
});
