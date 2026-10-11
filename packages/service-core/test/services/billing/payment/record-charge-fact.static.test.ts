import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(process.cwd(), 'src/services/billing/payment/record-charge-fact.service.ts'),
    'utf8'
);

describe('TEST:B5:23 record charge insert discipline', () => {
    it('attempts INSERT before any payment SELECT and contains no lock', () => {
        const insertAt = source.indexOf('.insert(payments)');
        expect(insertAt).toBeGreaterThanOrEqual(0);
        expect(source.slice(0, insertAt)).not.toMatch(/\.from\(payments\)/);
        expect(source).not.toMatch(/FOR\s+UPDATE|\.for\s*\(|pg_advisory|\block\b/i);
    });
});
