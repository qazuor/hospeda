/** TEST:V5:5 — GUARD:G2 (c) detects writes to a listing's vertical. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findImmutableVerticalWrites, run } from '../check-vertical-immutable';

const tempDirs: string[] = [];
afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree(files: Readonly<Record<string, string>>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g2c-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, source] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}

describe('TEST:V5:5 GUARD:G2 (c)', () => {
    it('accepts the current branch and a listing update without a vertical field', () => {
        expect(run().exitCode).toBe(0);
        const root = makeTree({
            'packages/service-core/src/services/gastronomy/gastronomy.service.ts':
                'db.update(gastronomies).set({ name: "New name" });\n'
        });
        expect(run({ root, minScannedFiles: 1 }).exitCode).toBe(0);
    });

    it('rejects a mutated listing service update with file and line', () => {
        const file = 'packages/service-core/src/services/gastronomy/gastronomy.service.ts';
        const root = makeTree({
            [file]:
                'const unchanged = 1;\n' +
                'db.update(gastronomies).set({ vertical: "accommodation" });\n'
        });
        const result = run({ root, minScannedFiles: 1 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`G2 (c): ${file}:2`);
        expect(result.output).toContain('set writes vertical');
    });

    it('rejects a listing update schema that declares productDomain', () => {
        const file = 'packages/schemas/src/entities/experience/experience.crud.schema.ts';
        const root = makeTree({
            [file]: 'export const ExperienceUpdateInputSchema = z.object({ productDomain: z.string() });\n'
        });
        expect(run({ root, minScannedFiles: 1 }).output).toContain(`G2 (c): ${file}:1`);
    });

    it('ignores comments and test files, and rejects too-small scans', () => {
        const file = 'apps/api/src/routes/accommodation/patch.ts';
        expect(
            findImmutableVerticalWrites({
                file,
                source: '// db.update(accommodations).set({ vertical: "gastronomy" });\n'
            })
        ).toEqual([]);
        const root = makeTree({
            'apps/api/src/routes/accommodation/patch.test.ts':
                'db.update(accommodations).set({ vertical: "gastronomy" });\n'
        });
        expect(run({ root, minScannedFiles: 1 }).output).toContain('expected at least 1');
    });
});
