import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(import.meta.dirname, '../../scripts/cutover-v6-step-3.ts');

describe('V6 cutover step 3 script wiring', () => {
    it('composes listeners before running step 3 and stops them before closing the pool', () => {
        const source = readFileSync(scriptPath, 'utf8').replace(/\s+/g, ' ');
        const composeIndex = source.indexOf('composeStep3Process(');
        const runIndex = source.indexOf('runStep3(');
        const finallyIndex = source.indexOf('finally {');
        const stopIndex = source.indexOf('await composition?.stop()', finallyIndex);
        const poolEndIndex = source.indexOf('await pool.end()', finallyIndex);

        expect(composeIndex).toBeGreaterThanOrEqual(0);
        expect(runIndex).toBeGreaterThanOrEqual(0);
        expect(composeIndex).toBeLessThan(runIndex);
        expect(finallyIndex).toBeGreaterThanOrEqual(0);
        expect(stopIndex).toBeGreaterThan(finallyIndex);
        expect(poolEndIndex).toBeGreaterThan(stopIndex);
    });
});
