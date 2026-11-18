/**
 * HOS-2247 — static guards of out-of-band confirmation:
 *
 * - AC-C65: every registered tool that takes a `confirmationToken` declares
 *   `confirmation: { elicitation: true }` and has an `ELICITATION_STRICT` entry,
 *   and the policy names no tool that does not. A new two-step tool that skips
 *   the declaration fails here.
 * - AC-C62 / D-18: no 2025-era push (`elicitInput`) exists anywhere in the API
 *   source, and the SDK's legacy shim (which would turn an `input_required` into
 *   such a push) is disabled on the server.
 *
 * @module test/mcp/tools/elicitation-registry.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ELICITATION_STRICT } from '../../../src/mcp/tools/elicitation-policy';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';

const SRC_DIR = join(__dirname, '../../../src');

/** Source text without comments: a comment may NAME the push it rules out. */
function codeOf(file: string): string {
    return readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

/** Every `.ts` file under `src`. */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory()
            ? sourceFiles(path)
            : path.endsWith('.ts')
              ? [path]
              : [];
    });
}

const tokenTools = MCP_TOOL_DEFINITIONS.filter(
    (definition) => 'confirmationToken' in definition.inputSchema.shape
);

describe('every token-confirmed tool declares out-of-band confirmation (AC-C65)', () => {
    it('finds the token-confirmed tools by their input schema', () => {
        // Assert: a broken detector would make the next tests vacuous.
        expect(tokenTools.map((definition) => definition.name).sort()).toEqual([
            'confirm_benefit_usage',
            'create_listing',
            'reject_benefit_usage',
            'reply_inquiry',
            'set_listing_publication'
        ]);
    });

    it.each(
        tokenTools.map((definition) => [definition.name, definition] as const)
    )('%s declares elicitation and has a strict-policy entry', (name, definition) => {
        // Assert
        expect(definition.confirmation).toEqual({ elicitation: true });
        expect(Object.keys(ELICITATION_STRICT)).toContain(name);
    });

    it('the policy covers registered, declaring tools only', () => {
        // Arrange
        const byName = new Map(
            MCP_TOOL_DEFINITIONS.map((definition) => [definition.name, definition])
        );

        // Assert
        for (const name of Object.keys(ELICITATION_STRICT)) {
            expect(byName.get(name)?.confirmation).toEqual({ elicitation: true });
        }
        const declaring = MCP_TOOL_DEFINITIONS.filter((definition) => definition.confirmation);
        expect(declaring.map((definition) => definition.name).sort()).toEqual(
            Object.keys(ELICITATION_STRICT).sort()
        );
    });
});

describe('no 2025-era elicitation push (AC-C62, D-18)', () => {
    it('no API source file calls elicitInput', () => {
        // Arrange
        const files = sourceFiles(SRC_DIR);

        // Act
        const offenders = files
            .filter((file) => /\belicitInput\b/.test(codeOf(file)))
            .map((file) => relative(SRC_DIR, file));

        // Assert
        expect(files.length).toBeGreaterThan(100);
        expect(offenders).toEqual([]);
    });

    it('the server disables the SDK legacy shim', () => {
        // Arrange
        const server = readFileSync(join(SRC_DIR, 'lib/mcp/server.ts'), 'utf8');

        // Assert
        expect(server).toMatch(/inputRequired:\s*\{\s*legacyShim:\s*false\s*\}/);
    });
});
