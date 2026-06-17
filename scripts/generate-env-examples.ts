/**
 * @file generate-env-examples.ts
 * @description Generates `.env.example` files for each app from the
 * `@repo/config` ENV_REGISTRY. This is the single source of truth — run this
 * script whenever the registry changes to keep examples in sync.
 *
 * Usage:
 *   pnpm gen:env-examples
 *
 * Output:
 *   apps/api/.env.example
 *   apps/web/.env.example
 *   apps/admin/.env.example
 *   apps/mobile/.env.example
 *
 * Rules:
 *   - `requiredScope === 'always'` or `required === true` → uncommented line
 *   - `requiredScope === 'production'` → commented with "(required in production)" note
 *   - `requiredScope === 'conditional'` → commented with "required when <requiredWhen>" note
 *   - `platformInjected === true` → commented with "injected by the platform" note
 *   - everything else (optional) → commented line
 *   - `secret === true` → "# SECRET" marker before the line
 *   - grouped by `category`, deterministic ordering (category alpha, then name alpha)
 *   - phantom vars (not in registry) automatically absent
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppId, EnvVarDefinition } from '../packages/config/src/env-registry-types.js';
import { ENV_REGISTRY } from '../packages/config/src/env-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for a single app's .env.example output. */
interface AppConfig {
    /** AppId used to filter the registry. */
    readonly appId: AppId;
    /** Display name used in the file header (e.g. "apps/api"). */
    readonly displayName: string;
    /** Absolute path to write the .env.example file. */
    readonly outputPath: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

const APPS: readonly AppConfig[] = [
    {
        appId: 'api',
        displayName: 'apps/api',
        outputPath: resolve(ROOT, 'apps/api/.env.example')
    },
    {
        appId: 'web',
        displayName: 'apps/web',
        outputPath: resolve(ROOT, 'apps/web/.env.example')
    },
    {
        appId: 'admin',
        displayName: 'apps/admin',
        outputPath: resolve(ROOT, 'apps/admin/.env.example')
    },
    {
        appId: 'mobile',
        displayName: 'apps/mobile',
        outputPath: resolve(ROOT, 'apps/mobile/.env.example')
    }
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns all registry entries for the given app, sorted deterministically:
 * first by category (alphabetical), then by name (alphabetical) within each
 * category. Determinism ensures `git diff` is empty on repeated runs.
 */
function getVarsForApp(appId: AppId): readonly EnvVarDefinition[] {
    return ENV_REGISTRY.filter((entry) => (entry.apps as readonly string[]).includes(appId)).sort(
        (a, b) => {
            const catCmp = a.category.localeCompare(b.category);
            return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
        }
    );
}

/**
 * Formats a single env var definition into one or more lines of
 * `.env.example` content (no trailing newline).
 */
function formatVar(entry: EnvVarDefinition): string {
    const lines: string[] = [];

    // Description comment
    // Wrap description at 78 chars (allow for the leading "# ")
    const descLines = wrapText(entry.description, 78);
    for (const line of descLines) {
        lines.push(`# ${line}`);
    }

    // Optional howToObtain hint
    if (entry.howToObtain) {
        const hintLines = wrapText(`How to obtain: ${entry.howToObtain}`, 78);
        for (const line of hintLines) {
            lines.push(`# ${line}`);
        }
    }

    // Optional helpUrl hint
    if (entry.helpUrl) {
        lines.push(`# See: ${entry.helpUrl}`);
    }

    // Secret marker
    if (entry.secret) {
        lines.push('# SECRET');
    }

    // Assignment line
    const assignment = `${entry.name}=${entry.exampleValue}`;

    if (entry.platformInjected) {
        // Never set manually — comment with note
        lines.push('# (injected by the platform — do not set manually)');
        lines.push(`# ${assignment}`);
    } else if (entry.requiredScope === 'always' || (entry.required && !entry.requiredScope)) {
        // Always required — uncommented
        lines.push(assignment);
    } else if (entry.requiredScope === 'production') {
        lines.push('# (required in production)');
        lines.push(`# ${assignment}`);
    } else if (entry.requiredScope === 'conditional') {
        const when = entry.requiredWhen ?? 'specific condition';
        lines.push(`# (required when ${when})`);
        lines.push(`# ${assignment}`);
    } else {
        // Optional
        lines.push(`# ${assignment}`);
    }

    return lines.join('\n');
}

/**
 * Wraps `text` to at most `maxWidth` characters per line, breaking at spaces.
 * Returns an array of line strings (without leading `# `).
 */
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

    if (current.length > 0) {
        result.push(current);
    }

    return result;
}

/**
 * Generates the full `.env.example` file content for a single app.
 */
function generateContent(app: AppConfig): string {
    const vars = getVarsForApp(app.appId);

    if (vars.length === 0) {
        return `# =============================================================================
# ${app.displayName} — Environment Variables
# =============================================================================
#
# No environment variables registered for this app.
# =============================================================================
`;
    }

    // Group by category (preserve the sorted order from getVarsForApp)
    const grouped = new Map<string, EnvVarDefinition[]>();
    for (const entry of vars) {
        const existing = grouped.get(entry.category);
        if (existing) {
            existing.push(entry);
        } else {
            grouped.set(entry.category, [entry]);
        }
    }

    const sections: string[] = [];

    for (const [category, entries] of grouped) {
        const header = `# ${'='.repeat(77)}\n# ${category.toUpperCase()}\n# ${'='.repeat(77)}`;
        const varBlocks = entries.map((e) => formatVar(e));
        sections.push([header, ...varBlocks].join('\n\n'));
    }

    const header = `# =============================================================================
# ${app.displayName} — Environment Variables
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
// Main
// ---------------------------------------------------------------------------

/**
 * Entry point: generates `.env.example` for all configured apps.
 */
function main(): void {
    for (const app of APPS) {
        const content = generateContent(app);
        writeFileSync(app.outputPath, content, 'utf-8');
        console.log(`Generated ${app.outputPath}`);
    }
    console.log('\nDone. All .env.example files are up to date.');
}

main();
