/**
 * HOS-142 AC-4 — guards against `docs/deployment/first-time-setup.md` Phase 4
 * drifting away from actually seeding the POI catalog on a fresh production
 * DB. A doc-only edit with no matching CLI/orchestrator wiring (or a future
 * edit that silently drops the flag again) would ship a fresh production
 * database with zero points of interest, discovered only much later — R-3 in
 * the HOS-142 spec.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOC_PATH = join(__dirname, '../../../docs/deployment/first-time-setup.md');

describe('docs/deployment/first-time-setup.md Phase 4 (HOS-142 AC-4)', () => {
    const doc = readFileSync(DOC_PATH, 'utf-8');

    it('the production day-1 bootstrap command includes --poi-catalog', () => {
        expect(doc).toMatch(
            /pnpm --filter @repo\/seed seed --required --poi-catalog --exclude=users/
        );
    });

    it('still excludes --example and users, and does not use --reset', () => {
        // Scope to the Phase 4 bootstrap line specifically (`--exclude=users`) —
        // the doc also shows an unrelated `--reset --required --example` example
        // earlier for local dev, which must NOT be confused with the prod command.
        const match = doc.match(/pnpm --filter @repo\/seed seed [^\n`]*--exclude=users[^\n`]*/);
        expect(match).not.toBeNull();
        const command = match?.[0] ?? '';
        expect(command).toContain('--exclude=users');
        expect(command).not.toContain('--example');
        expect(command).not.toContain('--reset');
    });

    it('documents --poi-catalog in the flags notes section', () => {
        expect(doc).toMatch(/\*\*`--poi-catalog`\*\*/);
    });
});
