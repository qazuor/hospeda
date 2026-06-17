/**
 * @file env-examples.guard.test.ts
 * @description Guards that the committed `.env.example` files are consistent
 * with the `ENV_REGISTRY`. Fails on:
 *   - A key present in a `.env.example` that is NOT registered for that app
 *     (phantom var leaked in from a hand-edit or forgotten entry).
 *   - A registry var for an app that is MISSING from its `.env.example`
 *     (var was added to the registry without regenerating).
 *   - The committed file content differs from what the generator would produce
 *     today (drift > 0: run `pnpm gen:env-examples` to fix).
 *
 * Run via:
 *   pnpm env:check:examples
 *   pnpm --filter @repo/config test packages/config/src/__tests__/env-examples.guard.test.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppId, EnvVarDefinition } from '../env-registry-types.js';
import { ENV_REGISTRY } from '../env-registry.js';

// ---------------------------------------------------------------------------
// Constants — must match scripts/generate-env-examples.ts
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '../../../..');

/** Maps each app to its committed .env.example path. */
const EXAMPLE_PATHS: Record<AppId, string | null> = {
    api: resolve(ROOT, 'apps/api/.env.example'),
    web: resolve(ROOT, 'apps/web/.env.example'),
    admin: resolve(ROOT, 'apps/admin/.env.example'),
    mobile: resolve(ROOT, 'apps/mobile/.env.example'),
    // docker and seed do not have .env.example files
    docker: null,
    seed: null
};

// ---------------------------------------------------------------------------
// Re-implemented generator logic (must stay in sync)
// ---------------------------------------------------------------------------

function getVarsForApp(appId: AppId): readonly EnvVarDefinition[] {
    return ENV_REGISTRY.filter((entry) => (entry.apps as readonly string[]).includes(appId)).sort(
        (a, b) => {
            const catCmp = a.category.localeCompare(b.category);
            return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
        }
    );
}

function wrapText(text: string, maxWidth: number): string[] {
    if (text.length <= maxWidth) return [text];
    const words = text.split(' ');
    const result: string[] = [];
    let current = '';
    for (const word of words) {
        if (current.length === 0) {
            current = word;
        } else if (current.length + 1 + word.length <= maxWidth) {
            current += ` ${word}`;
        } else {
            result.push(current);
            current = word;
        }
    }
    if (current.length > 0) result.push(current);
    return result;
}

function formatVar(entry: EnvVarDefinition): string {
    const lines: string[] = [];
    for (const line of wrapText(entry.description, 78)) lines.push(`# ${line}`);
    if (entry.howToObtain) {
        for (const line of wrapText(`How to obtain: ${entry.howToObtain}`, 78))
            lines.push(`# ${line}`);
    }
    if (entry.helpUrl) lines.push(`# See: ${entry.helpUrl}`);
    if (entry.secret) lines.push('# SECRET');
    const assignment = `${entry.name}=${entry.exampleValue}`;
    if (entry.platformInjected) {
        lines.push('# (injected by the platform — do not set manually)');
        lines.push(`# ${assignment}`);
    } else if (entry.requiredScope === 'always' || (entry.required && !entry.requiredScope)) {
        lines.push(assignment);
    } else if (entry.requiredScope === 'production') {
        lines.push('# (required in production)');
        lines.push(`# ${assignment}`);
    } else if (entry.requiredScope === 'conditional') {
        const when = entry.requiredWhen ?? 'specific condition';
        lines.push(`# (required when ${when})`);
        lines.push(`# ${assignment}`);
    } else {
        lines.push(`# ${assignment}`);
    }
    return lines.join('\n');
}

function generateContent(appId: AppId, displayName: string): string {
    const vars = getVarsForApp(appId);
    if (vars.length === 0) {
        return `# =============================================================================
# ${displayName} — Environment Variables
# =============================================================================
#
# No environment variables registered for this app.
# =============================================================================
`;
    }
    const grouped = new Map<string, EnvVarDefinition[]>();
    for (const entry of vars) {
        const existing = grouped.get(entry.category);
        if (existing) existing.push(entry);
        else grouped.set(entry.category, [entry]);
    }
    const sections: string[] = [];
    for (const [category, entries] of grouped) {
        const header = `# ${'='.repeat(77)}\n# ${category.toUpperCase()}\n# ${'='.repeat(77)}`;
        const varBlocks = entries.map((e) => formatVar(e));
        sections.push([header, ...varBlocks].join('\n\n'));
    }
    const header = `# =============================================================================
# ${displayName} — Environment Variables
# =============================================================================
#
# Copy this file to .env.local and fill in the required values.
#
#   cp .env.example .env.local
#
# Required vars are uncommented with a placeholder value.
# Optional vars are commented out; uncomment and adjust as needed.
# Production-only vars are commented with "(required in production)".
# Conditional vars note when they become required.
# Platform-injected vars (CI, VERCEL, etc.) are for reference only.
# SECRET vars contain sensitive credentials — never commit real values.
# =============================================================================
`;
    return `${header}\n${sections.join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts env var names from a `.env.example` file content.
 * Looks for lines matching `NAME=...` or `# NAME=...` (assignment lines only).
 */
function extractKeysFromExample(content: string): Set<string> {
    const keys = new Set<string>();
    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        // Skip pure comment lines (no assignment) and blank lines
        const assignLine = line.startsWith('#') ? line.slice(1).trim() : line;
        const match = /^([A-Z][A-Z0-9_]*)=/.exec(assignLine);
        if (match?.[1]) keys.add(match[1]);
    }
    return keys;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const APPS_WITH_EXAMPLES: Array<{ id: AppId; displayName: string }> = [
    { id: 'api', displayName: 'apps/api' },
    { id: 'web', displayName: 'apps/web' },
    { id: 'admin', displayName: 'apps/admin' },
    { id: 'mobile', displayName: 'apps/mobile' }
];

describe('env-examples guard', () => {
    for (const { id, displayName } of APPS_WITH_EXAMPLES) {
        const examplePath = EXAMPLE_PATHS[id];
        if (!examplePath) continue;

        describe(`${displayName}/.env.example`, () => {
            let committed: string;
            try {
                committed = readFileSync(examplePath, 'utf-8');
            } catch {
                committed = '';
            }

            const registryKeys = new Set(getVarsForApp(id).map((e) => e.name));
            const committedKeys = extractKeysFromExample(committed);

            it('should not contain phantom keys (keys not registered for this app)', () => {
                const phantoms: string[] = [];
                for (const key of committedKeys) {
                    if (!registryKeys.has(key)) phantoms.push(key);
                }
                expect(
                    phantoms,
                    `${displayName}/.env.example contains keys not registered for '${id}':\n${phantoms.map((k) => `  - ${k}`).join('\n')}\n\nFix: remove the key from the registry or run pnpm gen:env-examples`
                ).toHaveLength(0);
            });

            it('should contain every registry key registered for this app', () => {
                const missing: string[] = [];
                for (const key of registryKeys) {
                    if (!committedKeys.has(key)) missing.push(key);
                }
                expect(
                    missing,
                    `${displayName}/.env.example is missing registry keys for '${id}':\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nFix: run pnpm gen:env-examples`
                ).toHaveLength(0);
            });

            it('should match freshly-generated output (drift = 0)', () => {
                const fresh = generateContent(id, displayName);
                expect(
                    committed,
                    `${displayName}/.env.example differs from generated output.\n\nFix: run pnpm gen:env-examples and commit the result.`
                ).toBe(fresh);
            });
        });
    }
});
