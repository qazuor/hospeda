import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMMANDS } from '../src/registry.ts';

const PACKAGE_DIR = join(import.meta.dir, '..');
const WORKFLOWS_DIR = join(PACKAGE_DIR, '..', '..', '.github', 'workflows');

/** One `bun run bin/<name>` invocation found in a workflow file. */
interface BinReference {
    readonly workflow: string;
    readonly bin: string;
}

/**
 * Collects every `bun run bin/<name>` a GitHub workflow runs from this package.
 *
 * @returns The references, one per occurrence.
 */
function collectBinReferences(): readonly BinReference[] {
    const references: BinReference[] = [];
    for (const workflow of readdirSync(WORKFLOWS_DIR)) {
        if (!workflow.endsWith('.yml') && !workflow.endsWith('.yaml')) continue;
        const source = readFileSync(join(WORKFLOWS_DIR, workflow), 'utf8');
        for (const match of source.matchAll(/bun run bin\/([A-Za-z0-9_-]+)/g)) {
            const bin = match[1];
            if (bin !== undefined) references.push({ workflow, bin });
        }
    }
    return references;
}

/**
 * Regression guard: commit cfe0730c24 deleted `bin/hops-whats-new` and its
 * registry entry while `whats-new-gate.yml` still ran `bun run
 * bin/hops-whats-new pending|audit`. Every unit test stayed green; the gate
 * only died with `Script not found` on the next staging -> main promotion.
 */
describe('workflow references to client-tools binaries', () => {
    const references = collectBinReferences();

    it('should find the whats-new gate references (the scan is not vacuous)', () => {
        expect(references).toContainEqual({
            workflow: 'whats-new-gate.yml',
            bin: 'hops-whats-new'
        });
    });

    it('should point every `bun run bin/<name>` at a wrapper that exists', () => {
        const missing = references.filter(({ bin }) => !existsSync(join(PACKAGE_DIR, 'bin', bin)));
        expect(missing).toEqual([]);
    });

    it('should point every `bun run bin/hops-<name>` at a registered command', () => {
        const registered = new Set(COMMANDS.map((command) => `hops-${command.name}`));
        const unregistered = references.filter(({ bin }) => bin !== 'hops' && !registered.has(bin));
        expect(unregistered).toEqual([]);
    });
});
