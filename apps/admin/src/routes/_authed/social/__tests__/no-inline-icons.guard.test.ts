/**
 * @file G-9 Icon-Cleanup Guard — Social Admin Subtree (HOS-66 T-020, AC-6)
 *
 * Static-analysis guard asserting that NO production source file under
 * `apps/admin/src/routes/_authed/social/` contains an inline `<svg>` element
 * or a direct `phosphor-react` / `@phosphor-icons` import. All icons in this
 * subtree must come from `@repo/icons` (the canonical icon package per the
 * repo dependency policy).
 *
 * Context: the T-017 audit found the subtree already 100% clean — this guard
 * exists to keep it that way, failing CI if a future PR reintroduces an inline
 * SVG or a direct phosphor import here.
 *
 * Scope: PRODUCTION code only. `*.test.ts(x)` files and `__tests__/` dirs are
 * deliberately excluded — legitimate `vi.mock('@repo/icons', ...)` stubs render
 * `<svg data-testid=...>` to fake the real icons, and those are correct test
 * doubles, not violations.
 *
 * DO NOT add `.skip` / `.only` — the guard must be able to go red in CI.
 *
 * @see HOS-66 T-017 (audit) / T-020 (this guard)
 * @see apps/admin/test/routes/__root.ssr-guard.test.ts (guard pattern mirrored)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The social admin subtree root (this file lives at `<subtree>/__tests__/`). */
const SOCIAL_ROOT = resolve(__dirname, '..');

/**
 * The two forbidden patterns. Kind labels drive the failure message.
 * - `inline-svg`: an inline JSX `<svg` opening tag.
 * - `phosphor-import`: a direct `phosphor-react` / `@phosphor-icons` reference.
 */
const INLINE_SVG_RE = /<svg[\s/>]/;
const PHOSPHOR_RE = /phosphor-react|@phosphor-icons/;

// ---------------------------------------------------------------------------
// Detector (pure, string-in → violations-out, exercised by self-tests below)
// ---------------------------------------------------------------------------

interface Violation {
    readonly file: string;
    readonly line: number;
    readonly kind: 'inline-svg' | 'phosphor-import';
    readonly snippet: string;
}

/**
 * Scans a single source string line-by-line for forbidden icon patterns.
 *
 * @param params.source - The file contents to scan.
 * @param params.fileLabel - A label (usually the relative path) for reporting.
 * @returns The list of violations found (empty when the source is clean).
 */
function detectIconViolations(params: { source: string; fileLabel: string }): Violation[] {
    const { source, fileLabel } = params;
    const violations: Violation[] = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (INLINE_SVG_RE.test(line)) {
            violations.push({
                file: fileLabel,
                line: i + 1,
                kind: 'inline-svg',
                snippet: line.trim()
            });
        }
        if (PHOSPHOR_RE.test(line)) {
            violations.push({
                file: fileLabel,
                line: i + 1,
                kind: 'phosphor-import',
                snippet: line.trim()
            });
        }
    }

    return violations;
}

// ---------------------------------------------------------------------------
// Filesystem walk (production source files only)
// ---------------------------------------------------------------------------

/**
 * Recursively collects production `.ts` / `.tsx` files under `dir`, skipping
 * `*.test.*` files and any `__tests__/` directory.
 */
function collectProductionSources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__') continue;
            out.push(...collectProductionSources(full));
            continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (/\.test\.tsx?$/.test(entry.name)) continue;
        out.push(full);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Real-tree guard
// ---------------------------------------------------------------------------

describe('G-9 guard — no inline SVG / phosphor imports in social admin (HOS-66 AC-6)', () => {
    it('every production file under routes/_authed/social/ uses @repo/icons only', () => {
        // Arrange
        const files = collectProductionSources(SOCIAL_ROOT);

        // Act
        const violations = files.flatMap((absPath) =>
            detectIconViolations({
                source: readFileSync(absPath, 'utf-8'),
                fileLabel: relative(SOCIAL_ROOT, absPath)
            })
        );

        // Assert
        expect(
            violations,
            violations.length > 0
                ? [
                      `Found ${violations.length} forbidden icon usage(s) under routes/_authed/social/.`,
                      'Icons in this subtree must come from @repo/icons — no inline <svg>, no direct',
                      'phosphor-react / @phosphor-icons imports.',
                      '',
                      ...violations.map(
                          (v) => `  social/${v.file}:${v.line} [${v.kind}] — ${v.snippet}`
                      )
                  ].join('\n')
                : ''
        ).toHaveLength(0);
    });

    it('actually scanned a non-trivial number of files (sanity: walk is not empty)', () => {
        // Guards against a silently-broken walk that finds nothing and thus
        // "passes" vacuously.
        const files = collectProductionSources(SOCIAL_ROOT);
        expect(files.length).toBeGreaterThan(10);
    });
});

// ---------------------------------------------------------------------------
// Self-tests: prove the detector catches violations and passes clean source.
// The forbidden literals are assembled from fragments so this guard file never
// contains a verbatim `<svg`/phosphor token (keeping the file itself clean even
// if the __tests__ exclusion were ever removed).
// ---------------------------------------------------------------------------

const SVG_OPEN = `<${'svg'} width="24" />`;
const PHOSPHOR_IMPORT = `import { House } from '${'phosphor'}-react';`;
const PHOSPHOR_ICONS_IMPORT = `import { House } from '@${'phosphor'}-icons/react';`;

describe('G-9 guard — detector self-tests', () => {
    it('flags an inline svg opening tag', () => {
        const source = ['export function C() {', `  return ${SVG_OPEN};`, '}'].join('\n');
        const found = detectIconViolations({ source, fileLabel: 'synthetic-svg.tsx' });
        expect(found).toHaveLength(1);
        expect(found[0]?.kind).toBe('inline-svg');
        expect(found[0]?.line).toBe(2);
    });

    it('flags a direct phosphor-react import', () => {
        const source = [PHOSPHOR_IMPORT, 'export const x = House;'].join('\n');
        const found = detectIconViolations({ source, fileLabel: 'synthetic-phosphor.tsx' });
        expect(found).toHaveLength(1);
        expect(found[0]?.kind).toBe('phosphor-import');
        expect(found[0]?.line).toBe(1);
    });

    it('flags a direct @phosphor-icons import', () => {
        const source = [PHOSPHOR_ICONS_IMPORT].join('\n');
        const found = detectIconViolations({ source, fileLabel: 'synthetic-phosphor-icons.tsx' });
        expect(found).toHaveLength(1);
        expect(found[0]?.kind).toBe('phosphor-import');
    });

    it('passes clean source importing from @repo/icons', () => {
        const source = [
            "import { FacebookIcon, InstagramIcon, XIcon } from '@repo/icons';",
            'export function Icons() {',
            '  return [FacebookIcon, InstagramIcon, XIcon];',
            '}'
        ].join('\n');
        const found = detectIconViolations({ source, fileLabel: 'synthetic-clean.tsx' });
        expect(found).toHaveLength(0);
    });

    it('does not false-positive on a .svg filename string (not a tag)', () => {
        const source = ["const asset = 'icons/logo.svg';"].join('\n');
        const found = detectIconViolations({ source, fileLabel: 'synthetic-filename.ts' });
        expect(found).toHaveLength(0);
    });
});
