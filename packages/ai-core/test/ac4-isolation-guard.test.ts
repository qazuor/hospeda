/**
 * AC-4 static isolation guard (SPEC-173 T-036).
 *
 * Scans every TypeScript source file under `src/` and asserts the package
 * isolation rules from SPEC-173 AC-4:
 *
 * 1. NO `process.env` access anywhere in `src/**` — credentials and
 *    configuration always arrive by parameter.
 * 2. NO `@repo/db` import outside `src/storage/` — the storage layer is the
 *    single DB boundary.
 * 3. NO `ai` / `@ai-sdk/*` import outside `src/providers/` — the provider
 *    adapters are the single SDK boundary.
 * 4. NO `@repo/notifications` import anywhere — alert delivery lives in
 *    `apps/api` (the package must stay dependency-light).
 *
 * Comments and JSDoc are stripped before scanning, so documentation that
 * MENTIONS `process.env` (e.g. "never read from process.env") does not trip
 * the guard. The guard also validates itself against synthetic fixtures so a
 * broken scanner can never silently pass (the guard IS the test).
 *
 * This file runs as part of the package test suite, so the rule is enforced
 * on every `pnpm --filter @repo/ai-core test` run and in CI.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------

const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url));

/** Recursively collects every `.ts` file under `dir`. */
const collectTsFiles = (dir: string): readonly string[] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            return collectTsFiles(full);
        }
        return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
    });
};

/**
 * Strips block comments, line comments, and string/template literals so the
 * scan only sees executable code and import specifiers.
 *
 * Import specifiers are preserved because import statements are re-appended
 * verbatim: we first capture all `import`/`export ... from '...'` specifier
 * lines, then strip comments/strings from the rest.
 */
const toScannableCode = (source: string): { code: string; importSpecifiers: readonly string[] } => {
    const importSpecifiers: string[] = [];
    const importRe = /(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g;
    let match = importRe.exec(source);
    while (match !== null) {
        const specifier = match[1];
        if (specifier !== undefined) {
            importSpecifiers.push(specifier);
        }
        match = importRe.exec(source);
    }

    const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments + JSDoc
        .replace(/\/\/[^\n]*/g, '') // line comments
        .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, "''"); // string literals

    return { code, importSpecifiers };
};

interface ScannedFile {
    /** Path relative to `src/`, POSIX-style. */
    readonly relPath: string;
    /** Comment- and string-stripped source. */
    readonly code: string;
    /** Every import/re-export module specifier in the file. */
    readonly importSpecifiers: readonly string[];
}

const scanAllSources = (): readonly ScannedFile[] =>
    collectTsFiles(SRC_ROOT).map((file) => {
        const source = readFileSync(file, 'utf8');
        const { code, importSpecifiers } = toScannableCode(source);
        return {
            relPath: relative(SRC_ROOT, file).split(sep).join('/'),
            code,
            importSpecifiers
        };
    });

// ---------------------------------------------------------------------------
// Violation predicates
// ---------------------------------------------------------------------------

const hasProcessEnvAccess = (code: string): boolean => /\bprocess\s*\.\s*env\b/.test(code);

const isDbImport = (specifier: string): boolean =>
    specifier === '@repo/db' || specifier.startsWith('@repo/db/');

const isAiSdkImport = (specifier: string): boolean =>
    specifier === 'ai' || specifier.startsWith('ai/') || specifier.startsWith('@ai-sdk/');

const isNotificationsImport = (specifier: string): boolean =>
    specifier === '@repo/notifications' || specifier.startsWith('@repo/notifications/');

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

describe('AC-4 static isolation guard (T-036)', () => {
    const files = scanAllSources();

    it('should scan a non-trivial number of source files (sanity)', () => {
        // Arrange + Act done at describe scope.
        // Assert — if discovery breaks and returns [], every guard below would
        // vacuously pass; this pins the suite to a real scan.
        expect(files.length).toBeGreaterThan(20);
    });

    it('should find NO process.env access anywhere in src/** (AC-4 rule 1)', () => {
        // Act
        const offenders = files.filter((f) => hasProcessEnvAccess(f.code)).map((f) => f.relPath);

        // Assert
        expect(offenders).toEqual([]);
    });

    it('should find NO @repo/db import outside src/storage/ (AC-4 rule 2)', () => {
        // Act
        const offenders = files
            .filter((f) => !f.relPath.startsWith('storage/'))
            .filter((f) => f.importSpecifiers.some(isDbImport))
            .map((f) => f.relPath);

        // Assert
        expect(offenders).toEqual([]);
    });

    it('should find NO ai / @ai-sdk import outside src/providers/ (AC-4 rule 3)', () => {
        // Act
        const offenders = files
            .filter((f) => !f.relPath.startsWith('providers/'))
            .filter((f) => f.importSpecifiers.some(isAiSdkImport))
            .map((f) => f.relPath);

        // Assert
        expect(offenders).toEqual([]);
    });

    it('should find NO @repo/notifications import anywhere (AC-4 rule 4)', () => {
        // Act
        const offenders = files
            .filter((f) => f.importSpecifiers.some(isNotificationsImport))
            .map((f) => f.relPath);

        // Assert
        expect(offenders).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Scanner self-tests — a broken scanner must never silently pass
// ---------------------------------------------------------------------------

describe('AC-4 guard scanner self-tests', () => {
    it('should detect process.env access in real code', () => {
        // Arrange
        const fixture = 'export const key = process.env.SECRET_KEY;';

        // Act
        const { code } = toScannableCode(fixture);

        // Assert
        expect(hasProcessEnvAccess(code)).toBe(true);
    });

    it('should NOT flag process.env mentioned only in comments or strings', () => {
        // Arrange
        const fixture = [
            '/** Never read from process.env (AC-4). */',
            '// process.env is forbidden here',
            "const doc = 'reads process.env at runtime';",
            'export const x = 1;'
        ].join('\n');

        // Act
        const { code } = toScannableCode(fixture);

        // Assert
        expect(hasProcessEnvAccess(code)).toBe(false);
    });

    it('should extract import specifiers including multi-line imports', () => {
        // Arrange
        const fixture = [
            "import { getDb } from '@repo/db';",
            'import {',
            '    generateText',
            "} from 'ai';",
            "import type { Foo } from '@ai-sdk/openai';",
            "export { bar } from '@repo/notifications';"
        ].join('\n');

        // Act
        const { importSpecifiers } = toScannableCode(fixture);

        // Assert
        expect(importSpecifiers).toContain('@repo/db');
        expect(importSpecifiers).toContain('ai');
        expect(importSpecifiers).toContain('@ai-sdk/openai');
        expect(importSpecifiers).toContain('@repo/notifications');
    });

    it('should not confuse lookalike specifiers with guarded packages', () => {
        // Arrange — 'ai-core', '@repo/db-utils' and 'main' must NOT match.
        const fixture = [
            "import { x } from '@repo/ai-core';",
            "import { y } from '@repo/db-utils';",
            "import { z } from 'main';"
        ].join('\n');

        // Act
        const { importSpecifiers } = toScannableCode(fixture);

        // Assert
        expect(importSpecifiers.some(isDbImport)).toBe(false);
        expect(importSpecifiers.some(isAiSdkImport)).toBe(false);
        expect(importSpecifiers.some(isNotificationsImport)).toBe(false);
    });
});
