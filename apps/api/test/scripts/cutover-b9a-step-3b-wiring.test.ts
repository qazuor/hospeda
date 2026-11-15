import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(import.meta.dirname, '../../scripts/cutover-b9a-step-3b.ts');

describe('B9a cutover step 3b script wiring', () => {
    it('composes listeners before running step 3b and stops them before closing the pool', () => {
        const source = readFileSync(scriptPath, 'utf8').replace(/\s+/g, ' ');
        const composeIndex = source.indexOf('composeStep3bProcess(');
        const runIndex = source.indexOf('runStep3b({');
        const finallyIndex = source.indexOf('finally {');
        const stopIndex = source.indexOf('await processComposition?.stop()', finallyIndex);
        const poolEndIndex = source.indexOf('await pool.end()', finallyIndex);

        expect(composeIndex).toBeGreaterThanOrEqual(0);
        expect(runIndex).toBeGreaterThan(composeIndex);
        expect(finallyIndex).toBeGreaterThanOrEqual(0);
        expect(stopIndex).toBeGreaterThan(finallyIndex);
        expect(poolEndIndex).toBeGreaterThan(stopIndex);
    });
});
