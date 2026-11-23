/**
 * HOS-2176 guard: integration fixtures must not seed `plan_version.rank` with `Math.random()`.
 *
 * The rank feeds the partial unique index `uq_plan_version_sellable_current_rank` while the
 * integration database is shared by all workers, so a random draw reopens the duplicate-key race
 * this helper (`services/support/plan-version-rank.ts`) closed. Every fixture that needs a rank
 * imports `nextPlanVersionRank()` instead. A line may carry the marker `ALLOW_MATH_RANDOM:` when a
 * future, rank-unrelated use of `Math.random` is genuinely justified.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const integrationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const guardFile = path.basename(fileURLToPath(import.meta.url));
const randomCall = /\bMath\.random\s*\(/;

async function findSourceFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return findSourceFiles(entryPath);
            return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
        })
    );
    return nested.flat();
}

describe('no Math.random in integration fixtures', () => {
    it('rejects Math.random outside an explicit ALLOW_MATH_RANDOM marker', async () => {
        const files = await findSourceFiles(integrationRoot);
        const violations: string[] = [];

        for (const file of files) {
            if (path.basename(file) === guardFile) continue;
            const lines = (await readFile(file, 'utf8')).split('\n');
            for (const [index, line] of lines.entries()) {
                if (!randomCall.test(line)) continue;
                // The marker may sit on the offending line or directly above it.
                const marked =
                    line.includes('ALLOW_MATH_RANDOM:') ||
                    (index > 0 && (lines[index - 1] ?? '').includes('ALLOW_MATH_RANDOM:'));
                if (!marked)
                    violations.push(`${path.relative(integrationRoot, file)}:${index + 1}`);
            }
        }

        expect(violations).toEqual([]);
    });
});
