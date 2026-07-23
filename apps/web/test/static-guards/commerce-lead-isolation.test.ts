/**
 * @file commerce-lead-isolation.test.ts
 * @description Static guard enforcing HOS-166 D-4 (§6.1 — "the lead is a
 * DOOR, not a DEPENDENCY") on the web owner self-service commerce surface
 * (AC-14).
 *
 * The lead may PRE-FILL the create form as a convenience; it must never
 * CONDITION any step of create/complete/publish/pay. The cheapest, most
 * durable enforcement of that rule is exactly what the spec prescribes: a
 * static grep that fails the build if any file under the commerce owner
 * surface imports `CommerceLeadService` or references `commerce_leads` (the
 * DB table). Mirrors `packages/i18n/test/key-coverage.test.ts`'s plain
 * fs-based scanning style — no new tooling required.
 *
 * Scope: the create/publish/checkout path AND, per the spec's "ideally the
 * whole commerce owner surface" note, every other file under the same
 * `mi-cuenta/comercio` pages / `components/commerce` / `lib/commerce` trees,
 * since a violation anywhere in the owner surface is the same structural
 * mistake regardless of which specific file it lands in.
 *
 * @module test/static-guards/commerce-lead-isolation
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** Directories that make up the owner self-service commerce surface. */
const SCAN_DIRS = [
    path.join(WEB_SRC, 'pages/[lang]/mi-cuenta/comercio'),
    path.join(WEB_SRC, 'components/commerce'),
    path.join(WEB_SRC, 'lib/commerce')
];

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/** Forbidden patterns (HOS-166 §6.1's anti-pattern table). */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ readonly label: string; readonly regex: RegExp }> = [
    { label: 'CommerceLeadService import/reference', regex: /CommerceLeadService/ },
    { label: 'commerce_leads table reference', regex: /commerce_leads/ }
];

/** Recursively collects every file path under `dir` (skips node_modules-like noise defensively). */
function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            continue;
        }
        const ext = path.extname(entry.name);
        if (SCANNED_EXTENSIONS.has(ext)) {
            files.push(fullPath);
        }
    }

    return files;
}

describe('HOS-166 D-4 static guard — commerce owner surface never touches leads (AC-14)', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir));

    it('scans at least one file (guards against a silently-empty scope)', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    for (const { label, regex } of FORBIDDEN_PATTERNS) {
        it(`no file references ${label}`, () => {
            const offenders: string[] = [];

            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8');
                if (regex.test(content)) {
                    offenders.push(path.relative(WEB_SRC, file));
                }
            }

            expect(offenders, `Files violating HOS-166 D-4 (${label})`).toEqual([]);
        });
    }
});
