/**
 * Static TEST:V6:31 guard: retired partner tier and lifecycle date names must
 * not return to application or package code.
 *
 * Exit 0 means clean; exit 1 means a violation or a broken/empty scan.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PartnerLegacyViolation {
    readonly file: string;
    readonly line: number;
    readonly name: string;
}

const PARTNER_FIELD_NAMES = ['tier', 'startsAt', 'endsAt', 'starts_at', 'ends_at'] as const;
const GLOBAL_LEGACY_NAMES = [
    'PartnerTierEnum',
    'PartnerTierPgEnum',
    'PartnerTierEnumSchema',
    'PartnerTierSchema',
    'partner_tier_enum',
    'partners_tier_idx',
    'partners_startsAt_idx',
    'partners_lifecycleState_endsAt_idx'
] as const;
const SOURCE_EXTENSION = /\.(?:ts|tsx|astro|mjs|cjs)$/;
const HISTORICAL_FILE_EXCLUSIONS = [
    // These tests construct the pre-HOS-1481 schema to prove the structural migration.
    'packages/db/test/integration/partners-v7-schema-from-empty.test.ts',
    // This test inserts legacy partner columns before asserting the migration removes them.
    'packages/db/test/integration/partners-v7-schema-over-data.test.ts',
    // This no-op migration documents that the old fixture rows need no data rewrite.
    'packages/seed/src/data-migrations/0119-hos1481-partner-fixtures-without-tier-and-dates.ts',
    // This test verifies the migration marker and its no-op result.
    'packages/seed/test/data-migrations/0119-hos1481-partner-fixtures-without-tier-and-dates.test.ts'
] as const;

/** Removes line and block comments while preserving source line positions. */
function stripComments(source: string): string {
    const output: string[] = [];
    let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' | 'html' = 'code';
    let escaped = false;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index] ?? '';
        const next = source[index + 1] ?? '';

        if (state === 'line') {
            if (char === '\n') {
                output.push('\n');
                state = 'code';
            } else {
                output.push(' ');
            }
            continue;
        }
        if (state === 'html') {
            if (char === '-' && next === '-' && source[index + 2] === '>') {
                output.push('   ');
                index += 2;
                state = 'code';
            } else {
                output.push(char === '\n' ? '\n' : ' ');
            }
            continue;
        }
        if (state === 'block') {
            if (char === '*' && next === '/') {
                output.push('  ');
                index += 1;
                state = 'code';
            } else {
                output.push(char === '\n' ? '\n' : ' ');
            }
            continue;
        }
        if (state !== 'code') {
            output.push(char);
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (
                (state === 'single' && char === "'") ||
                (state === 'double' && char === '"') ||
                (state === 'template' && char === '`')
            ) {
                state = 'code';
            }
            continue;
        }

        if (char === '<' && source.slice(index, index + 4) === '<!--') {
            output.push('    ');
            index += 3;
            state = 'html';
        } else if (char === '/' && next === '/') {
            output.push('  ');
            index += 1;
            state = 'line';
        } else if (char === '/' && next === '*') {
            output.push('  ');
            index += 1;
            state = 'block';
        } else {
            output.push(char);
            if (char === "'") state = 'single';
            else if (char === '"') state = 'double';
            else if (char === '`') state = 'template';
        }
    }

    return output.join('');
}

/** Removes string contents only for deciding whether code names the table identifier. */
function stripLiterals(source: string): string {
    return source.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/gs, (value) =>
        value.replace(/[^\n]/g, ' ')
    );
}

function isExcluded(file: string): boolean {
    // The guard and its own tests contain forbidden spellings to define the check.
    if (file === 'scripts/check-partner-no-tier-and-dates.ts') return true;
    if (file === 'scripts/__tests__/check-partner-no-tier-and-dates.test.ts') return true;
    // Closed list: each item is a migration-history artifact, not a live reader.
    return (HISTORICAL_FILE_EXCLUSIONS as readonly string[]).includes(file);
}

/** A tier mention counts only when it is attached to the partners model/table. */
function isPartnerTierReference(line: string): boolean {
    return /\b(?:partners?|PartnerModel)\s*(?:\.\s*tier\b|\[['"]tier['"]\])/i.test(line);
}

/**
 * Finds retired partner field names in pure in-memory inputs.
 *
 * @param files - Repo-relative file names and source contents.
 * @returns Violations with the source line and matched name.
 */
export function findPartnerLegacyReferences(
    files: readonly { readonly file: string; readonly content: string }[]
): readonly PartnerLegacyViolation[] {
    const violations: PartnerLegacyViolation[] = [];
    const allNamesPattern = new RegExp(
        `\\b(${[...GLOBAL_LEGACY_NAMES, ...PARTNER_FIELD_NAMES].join('|')})\\b`,
        'g'
    );
    const partnerNamesPattern = new RegExp(`\\b(${PARTNER_FIELD_NAMES.join('|')})\\b`, 'g');
    const globalNames = new Set<string>(GLOBAL_LEGACY_NAMES);

    for (const { file, content } of files) {
        const code = stripComments(content);
        if (isExcluded(file)) continue;
        const isPartnerFile = /partner/i.test(file) || /\bpartners\b/.test(stripLiterals(code));
        const pattern = new RegExp(allNamesPattern.source, 'g');
        const lines = code.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
            const line = lines[lineIndex] ?? '';
            pattern.lastIndex = 0;
            for (const match of line.matchAll(pattern)) {
                const name = match[1] ?? '';
                const partnerFieldReference =
                    isPartnerFile &&
                    partnerNamesPattern.test(name) &&
                    (name !== 'tier' || isPartnerTierReference(line));
                if (globalNames.has(name) || partnerFieldReference) {
                    violations.push({ file, line: lineIndex + 1, name });
                }
                partnerNamesPattern.lastIndex = 0;
            }
        }
    }

    return violations;
}

function listScannedFiles(root: string): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => /^(?:apps|packages)\//.test(file))
        .filter((file) => SOURCE_EXTENSION.test(file));
}

/** Runs the repository scan and returns a report suitable for the CLI or tests. */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listScannedFiles(root);
    if (files.length === 0) {
        return {
            exitCode: 1,
            output: 'ERROR: scanned 0 files. The root is wrong or the scan is broken.'
        };
    }

    const inputs = files.map((file) => ({ file, content: readFileSync(join(root, file), 'utf8') }));
    const violations = findPartnerLegacyReferences(inputs);
    if (violations.length > 0) {
        const output = [
            `FAIL: ${violations.length} retired partner field/name reference(s):`,
            ...violations.map(({ file, line, name }) => `  ${file}:${line} — ${name}`)
        ].join('\n');
        return { exitCode: 1, output };
    }

    return {
        exitCode: 0,
        output: `OK: partner field/name guard passed across ${files.length} file(s).`
    };
}

/** CLI entry point. */
export function main(): number {
    try {
        const result = run();
        (result.exitCode === 0 ? console.log : console.error)(result.output);
        return result.exitCode;
    } catch (error) {
        console.error(
            `ERROR: scan failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return 1;
    }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
