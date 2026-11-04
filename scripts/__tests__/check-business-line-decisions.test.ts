import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanBusinessLineDecisions } from '../business-line-decisions-scan';
import { run } from '../check-business-line-decisions';

const roots: string[] = [];
afterEach(() => {
    roots.splice(0).forEach((root) => {
        rmSync(root, { recursive: true, force: true });
    });
});
function fixture(source: string): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g-fac-03-'));
    roots.push(root);
    mkdirSync(path.join(root, 'apps/web/src'), { recursive: true });
    writeFileSync(
        path.join(root, 'apps/web/tsconfig.json'),
        JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' },
            include: ['src/**/*.ts', 'src/**/*.tsx']
        })
    );
    writeFileSync(
        path.join(root, 'apps/web/src/business-line.ts'),
        "export type BusinessLine = 'food' | 'nightlife';\n"
    );
    writeFileSync(path.join(root, 'apps/web/src/example.tsx'), source);
    return root;
}

describe('TEST:3.12:5 GUARD:G-FAC-03', () => {
    it('rejects a literal comparison through a BusinessLine[] receiver', () => {
        const root = fixture(
            "import type { BusinessLine } from './business-line'; const listing: { businessLines: BusinessLine[] } = { businessLines: ['food'] }; listing.businessLines.includes('nightlife');"
        );
        const result = scanBusinessLineDecisions(root);
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0]?.reason).toContain('includes');
    });

    it('rejects callback comparisons where the callback parameter is BusinessLine', () => {
        const root = fixture(
            "import type { BusinessLine } from './business-line'; declare const nightlifeValue: BusinessLine; declare const lines: BusinessLine[]; lines.some((l) => l === nightlifeValue);"
        );
        expect(scanBusinessLineDecisions(root).decisions).toHaveLength(2);
    });

    it('keeps string style comparisons and rating object keys green', () => {
        const root = fixture(
            "const style = 'standard'; style === 'standard'; const rating = { food: { average: 5 } };"
        );
        expect(scanBusinessLineDecisions(root).decisions).toHaveLength(0);
    });

    it('fails closed when the inventory row count is stale and when the scan floor is missed', () => {
        const root = fixture(
            "import type { BusinessLine } from './business-line'; const listing: { businessLines: BusinessLine[] } = { businessLines: ['food'] }; listing.businessLines.includes('nightlife');"
        );
        const inventoryPath = path.join(root, 'inventory.json');
        const hit = scanBusinessLineDecisions(root).readers[0]!;
        writeFileSync(
            inventoryPath,
            JSON.stringify({
                readers: [{ ...hit, count: 2, category: 'facts', spec: 'docs/06-guards.md:176' }],
                imports: []
            })
        );
        const extra = run({ root, inventoryPath, minScannedFiles: 0 });
        expect(extra.exitCode).toBe(1);
        expect(extra.output).toContain('count mismatch');
        writeFileSync(
            inventoryPath,
            JSON.stringify({
                readers: [{ ...hit, count: 0, category: 'facts', spec: 'docs/06-guards.md:176' }],
                imports: []
            })
        );
        const missing = run({ root, inventoryPath, minScannedFiles: 0 });
        expect(missing.output).toContain('count mismatch');
        const floor = run({ root, inventoryPath, minScannedFiles: 100 });
        expect(floor.output).toContain('expected at least 100');
    });
});
